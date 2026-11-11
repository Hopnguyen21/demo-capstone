using System.Collections.Concurrent;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Pgvector;
using SmartFarm.Application.Common.Exceptions;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Application.Features.Platform;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;

namespace SmartFarm.Infrastructure.Platform;

public class BackupService : IBackupService
{
    private const string CurrentFormatVersion = "1.0";
    private const string SupportedScope = "OperationalDomainSnapshot";
    private const string ManifestEntryName = "manifest.json";
    private const string DataEntryName = "data.json";

    public static readonly string[] SupportedScopeTables =
    [
        "Tenants",
        "AppUsers",
        "Crops",
        "CropVarieties",
        "GrowthProfiles",
        "GrowthStages",
        "EnvironmentalRequirements",
        "Farms",
        "Fields",
        "Zones",
        "UserZoneAccesses",
        "Gateways",
        "Devices",
        "DeviceSensors",
        "DeviceActuators",
        "DeviceAssignmentHistory",
        "DeviceConnectionTests",
        "DeviceDiagnosticJobs",
        "FirmwareJobs",
        "PlantingSeasons",
        "FarmingSeasons",
        "SeasonAppliedRequirements",
        "SeasonStageTransitions",
        "DeviceModelDefinitions",
        "DeviceModelCapabilities",
        "DeploymentRequests",
        "DeploymentPlanItems",
        "DeploymentSurveys",
        "DeploymentDecisionHistory",
        "ServiceRequests",
        "ServiceRequestHistories",
        "DeviceReplacements",
        "ServiceRequestQuotations",
        "ServiceRequestQuotationItems",
        "ServiceRequestPayments",
        "AlertRules",
        "AlertRuleEvaluationStates",
        "Alerts",
        "AlertHistoryEvents",
        "ControlSchedules",
        "AutoControlRules",
        "ActuatorCommands",
        "ActuatorCommandEvents",
        "AiConsultationRequests",
        "AiRecommendations",
        "AiRecommendationDecisions",
        "InventoryItems",
        "MaterialRequirementLinks",
        "InventoryTransactions",
        "LowStockAlerts",
        "FarmTasks",
        "FarmTaskHistory",
        "FarmTaskAssignments",
        "FarmInvitations",
        "FinanceTransactions",
        "Notifications",
        "PlatformSettings",
        "PlatformHardwareItems",
        "ZoneContracts",
        "ZoneContractRenewals",
        "DeviceDepreciations",
        "AgricultureDocuments",
        "AgricultureKnowledgeChunks"
    ];

    public static readonly string[] RequiredCoreTables = SupportedScopeTables;

    private readonly SmartFarmDbContext _dbContext;
    private readonly IConfiguration _configuration;
    private readonly ILogger<BackupService> _logger;
    private readonly TimeProvider _timeProvider;
    private readonly string _storageDirectory;

    private static readonly ConcurrentDictionary<string, byte> _activeFiles = new(StringComparer.OrdinalIgnoreCase);

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true,
        WriteIndented = false
    };

    public BackupService(
        SmartFarmDbContext dbContext,
        IConfiguration configuration,
        ILogger<BackupService> logger,
        TimeProvider timeProvider)
    {
        _dbContext = dbContext;
        _configuration = configuration;
        _logger = logger;
        _timeProvider = timeProvider;

        var configuredDir = _configuration["BackupStorage:Directory"];
        _storageDirectory = !string.IsNullOrWhiteSpace(configuredDir)
            ? Path.GetFullPath(configuredDir)
            : Path.Combine(AppContext.BaseDirectory, "App_Data", "Backups");

        if (!Directory.Exists(_storageDirectory))
        {
            Directory.CreateDirectory(_storageDirectory);
        }
    }

    public Task<BackupSystemStatusView> GetSystemStatusAsync(CancellationToken ct)
    {
        var allowLiveRestore = _configuration.GetValue("BackupStorage:AllowLiveRestore", false);
        var retentionDays = Math.Clamp(_configuration.GetValue("BackupStorage:RetentionDays", 30), 1, 365);
        var maxBackups = Math.Clamp(_configuration.GetValue("BackupStorage:MaxBackups", 20), 1, 100);
        var maxFileSizeBytes = _configuration.GetValue("BackupStorage:MaxBackupFileSizeBytes", 50L * 1024 * 1024);
        var maxUncompressedBytes = _configuration.GetValue("BackupStorage:MaxUncompressedSizeBytes", 200L * 1024 * 1024);

        var totalFiles = Directory.Exists(_storageDirectory)
            ? Directory.GetFiles(_storageDirectory, "*.sfbackup").Length
            : 0;

        return Task.FromResult(new BackupSystemStatusView(
            AllowLiveRestore: allowLiveRestore,
            RetentionDays: retentionDays,
            MaxBackups: maxBackups,
            MaxBackupFileSizeBytes: maxFileSizeBytes,
            MaxUncompressedSizeBytes: maxUncompressedBytes,
            StorageDirectory: _storageDirectory,
            TotalBackupsAvailable: totalFiles));
    }

    public Task<IReadOnlyList<BackupMetadataView>> ListBackupsAsync(CancellationToken ct)
    {
        var result = new List<BackupMetadataView>();
        if (!Directory.Exists(_storageDirectory))
        {
            return Task.FromResult<IReadOnlyList<BackupMetadataView>>(result);
        }

        var files = Directory.GetFiles(_storageDirectory, "*.sfbackup")
            .OrderByDescending(File.GetCreationTimeUtc);

        foreach (var file in files)
        {
            try
            {
                var fileInfo = new FileInfo(file);
                var manifest = ReadManifest(file);
                if (manifest != null)
                {
                    result.Add(new BackupMetadataView(
                        FileName: fileInfo.Name,
                        SizeBytes: fileInfo.Length,
                        CreatedAtUtc: manifest.CreatedAtUtc,
                        TotalRecords: manifest.TotalRecords,
                        ChecksumSha256: manifest.PayloadSha256,
                        CreatedByEmail: manifest.CreatedByEmail,
                        FormatVersion: manifest.FormatVersion,
                        SupportedScope: manifest.SupportedScope,
                        TableRecordCounts: manifest.TableRecordCounts));
                }
                else
                {
                    result.Add(new BackupMetadataView(
                        FileName: fileInfo.Name,
                        SizeBytes: fileInfo.Length,
                        CreatedAtUtc: fileInfo.CreationTimeUtc,
                        TotalRecords: 0,
                        ChecksumSha256: string.Empty,
                        CreatedByEmail: "unknown",
                        FormatVersion: "legacy",
                        SupportedScope: "LegacySnapshot",
                        TableRecordCounts: new Dictionary<string, int>()));
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to read backup metadata for {FileName}", Path.GetFileName(file));
            }
        }

        return Task.FromResult<IReadOnlyList<BackupMetadataView>>(result);
    }

    public async Task<CreateBackupResult> CreateBackupAsync(Guid adminUserId, CancellationToken ct)
    {
        var admin = await ValidateAdminUserAsync(adminUserId, ct);
        return await CreateBackupInternalAsync(admin, isPreRestoreSnapshot: false, ct);
    }

    public async Task<(byte[] Content, string ContentType, string FileName)> DownloadBackupAsync(
        string fileName,
        Guid adminUserId,
        CancellationToken ct)
    {
        await ValidateAdminUserAsync(adminUserId, ct);
        var fullPath = ValidateBackupPath(fileName);

        if (!File.Exists(fullPath))
        {
            throw new ResourceNotFoundException("Tệp sao lưu không tồn tại trên hệ thống.");
        }

        var maxFileSizeBytes = _configuration.GetValue("BackupStorage:MaxBackupFileSizeBytes", 50L * 1024 * 1024);
        var fileInfo = new FileInfo(fullPath);
        if (fileInfo.Length > maxFileSizeBytes)
        {
            throw new RequestValidationException("fileSize", $"Tệp sao lưu vượt quá kích thước cho phép ({maxFileSizeBytes} bytes).");
        }

        var bytes = await File.ReadAllBytesAsync(fullPath, ct);
        return (bytes, "application/octet-stream", fileInfo.Name);
    }

    public async Task<VerifyBackupResult> VerifyBackupAsync(string fileName, Guid adminUserId, CancellationToken ct)
    {
        await ValidateAdminUserAsync(adminUserId, ct);
        var fullPath = ValidateBackupPath(fileName);

        if (!File.Exists(fullPath))
        {
            throw new ResourceNotFoundException("Tệp sao lưu cần kiểm tra không tồn tại.");
        }

        return await VerifyBackupFileInternalAsync(fullPath, ct);
    }

    public async Task<RestoreBackupResult> RestoreBackupAsync(
        string fileName,
        RestoreBackupRequest request,
        Guid adminUserId,
        CancellationToken ct)
    {
        var admin = await ValidateAdminUserAsync(adminUserId, ct);

        if (!request.Confirm || request.OverwriteConfirmation != "CONFIRM_RESTORE")
        {
            throw new RequestValidationException("confirmation", "Yêu cầu xác nhận khôi phục không hợp lệ. Vui lòng bật cờ xác nhận và cung cấp chuỗi 'CONFIRM_RESTORE'.");
        }

        var fullPath = ValidateBackupPath(fileName);
        if (!File.Exists(fullPath))
        {
            throw new ResourceNotFoundException("Tệp sao lưu cần khôi phục không tồn tại.");
        }

        // Lock file during restoration
        if (!_activeFiles.TryAdd(Path.GetFileName(fullPath), 1))
        {
            throw new ResourceConflictException("Tệp sao lưu này đang được xử lý trong một tác vụ khác.");
        }

        try
        {
            // Step 1: Deep verification before doing anything
            var verification = await VerifyBackupFileInternalAsync(fullPath, ct);
            if (!verification.IsValid || !verification.ChecksumVerified)
            {
                throw new RequestValidationException("backup", $"Tệp sao lưu không vượt qua thẩm định tính toàn vẹn: {verification.Message}");
            }

            var now = _timeProvider.GetUtcNow().UtcDateTime;
            var allowLiveRestore = _configuration.GetValue("BackupStorage:AllowLiveRestore", false);

            // Step 2: Strict enforcement of AllowLiveRestore
            if (!allowLiveRestore)
            {
                var auditMessage = $"Yêu cầu khôi phục bị từ chối: Chế độ Live Restore đang tắt theo cấu hình (BackupStorage:AllowLiveRestore=false). Thẩm định tệp {fileName} hợp lệ.";
                await TryRecordAuditLogAsync(adminUserId, admin.FullName, admin.Role.ToString(), "RESTORE_DATABASE_DRYRUN", fileName, auditMessage, now, ct);

                return new RestoreBackupResult(
                    FileName: fileName,
                    Success: false,
                    IsDryRunOnly: true,
                    Message: "Bảo vệ an toàn hệ thống: Chế độ khôi phục thực tế đang tắt (BackupStorage:AllowLiveRestore=false). Hệ thống đã kiểm tra tính toàn vẹn SHA-256 và cấu trúc dữ liệu thành công. Không có dữ liệu nào bị thay đổi.",
                    RestoredAtUtc: now,
                    RestoredRecords: 0,
                    RestoredTables: Array.Empty<string>(),
                    PreRestoreBackupFileName: null,
                    ChecksumSha256: verification.ChecksumSha256);
            }

            // Step 3: Mandatory pre-restore backup to prevent any data loss
            string? preRestoreBackupFileName = null;
            try
            {
                var preBackup = await CreateBackupInternalAsync(admin, isPreRestoreSnapshot: true, ct);
                preRestoreBackupFileName = preBackup.FileName;
                _logger.LogInformation("Mandatory pre-restore backup created: {PreBackupFile}", preRestoreBackupFileName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to create mandatory pre-restore snapshot. Aborting restore to prevent data loss.");
                await TryRecordAuditLogAsync(adminUserId, admin.FullName, admin.Role.ToString(), "RESTORE_DATABASE_ABORTED", fileName, $"Khôi phục bị hủy do không thể tạo bản sao lưu an toàn trước khôi phục: {ex.Message}", now, ct);
                throw new InvalidOperationException($"Không thể tạo bản sao lưu an toàn (pre-restore backup) trước khi khôi phục: {ex.Message}. Quá trình khôi phục bị dừng để bảo vệ dữ liệu hiện có.", ex);
            }

            // Step 4: Decompress and deserialize data payload
            var tablesPayload = await ExtractAndParseTablesPayloadAsync(fullPath, ct);

            if (tablesPayload.ValueKind != JsonValueKind.Object)
            {
                throw new RequestValidationException("backup", "Cấu trúc dữ liệu trong data.json không phải là một đối tượng JSON hợp lệ.");
            }

            // Enforce presence of all required tables before starting transaction
            var missingRequiredTables = SupportedScopeTables.Where(t => !tablesPayload.TryGetProperty(t, out _)).ToList();
            if (missingRequiredTables.Count > 0)
            {
                throw new RequestValidationException("backup", $"Tệp sao lưu thiếu các bảng dữ liệu cốt lõi bắt buộc: {string.Join(", ", missingRequiredTables)}");
            }

            var extraPayloadTables = tablesPayload.EnumerateObject()
                .Where(p => !SupportedScopeTables.Contains(p.Name))
                .Select(p => p.Name)
                .ToList();
            if (extraPayloadTables.Count > 0)
            {
                throw new RequestValidationException("backup", $"Tệp sao lưu chứa các bảng nằm ngoài phạm vi được hỗ trợ: {string.Join(", ", extraPayloadTables)}");
            }

            foreach (var prop in tablesPayload.EnumerateObject())
            {
                if (prop.Value.ValueKind != JsonValueKind.Array)
                {
                    throw new RequestValidationException("backup", $"Bảng '{prop.Name}' trong payload không đúng định dạng danh sách mảng JSON.");
                }

                if (verification.TableRecordCounts.TryGetValue(prop.Name, out var expectedCount))
                {
                    var actualCount = prop.Value.GetArrayLength();
                    if (actualCount != expectedCount)
                    {
                        throw new RequestValidationException("backup", $"Số lượng bản ghi của bảng '{prop.Name}' ({actualCount}) không khớp với bản khai trong manifest ({expectedCount}).");
                    }
                }
                else
                {
                    throw new RequestValidationException("backup", $"Bảng '{prop.Name}' không có trong bản khai manifest.");
                }
            }

            // Step 5: Execute restore in database transaction
            var restoredTables = new List<string>();
            var restoredRecordCount = 0;

            await using var transaction = await _dbContext.Database.BeginTransactionAsync(ct);
            try
            {
                restoredRecordCount = await ApplyRestorationPayloadAsync(tablesPayload, admin.Id, restoredTables, ct);

                if (restoredRecordCount == 0 && tablesPayload.EnumerateObject().Any(p => p.Value.ValueKind == JsonValueKind.Array && p.Value.GetArrayLength() > 0))
                {
                    throw new InvalidOperationException("Không thể khôi phục dữ liệu: Số lượng bản ghi sau khôi phục bằng 0 mặc dù payload có dữ liệu.");
                }

                await transaction.CommitAsync(ct);
                _logger.LogInformation("Database successfully restored from {FileName} with {Records} records", fileName, restoredRecordCount);
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(ct);
                _logger.LogError(ex, "Restoration failed and transaction was rolled back for {FileName}", fileName);

                await TryRecordAuditLogAsync(adminUserId, admin.FullName, admin.Role.ToString(), "RESTORE_DATABASE_FAILED", fileName, $"Khôi phục thất bại và đã rollback transaction: {ex.Message}", now, ct);
                throw new InvalidOperationException($"Lỗi trong quá trình khôi phục cơ sở dữ liệu: {ex.Message}", ex);
            }

            // Step 6: Audit log
            var successDetails = $"Khôi phục cơ sở dữ liệu thành công từ {fileName}. Tổng bản ghi: {restoredRecordCount} trên {restoredTables.Count} bảng. Pre-restore: {preRestoreBackupFileName ?? "N/A"}. SHA-256: {verification.ChecksumSha256}";
            await TryRecordAuditLogAsync(adminUserId, admin.FullName, admin.Role.ToString(), "RESTORE_DATABASE_SUCCESS", fileName, successDetails, now, ct);

            return new RestoreBackupResult(
                FileName: fileName,
                Success: true,
                IsDryRunOnly: false,
                Message: $"Đã khôi phục thành công {restoredRecordCount} bản ghi trên {restoredTables.Count} bảng dữ liệu từ bản sao lưu {fileName}.",
                RestoredAtUtc: now,
                RestoredRecords: restoredRecordCount,
                RestoredTables: restoredTables,
                PreRestoreBackupFileName: preRestoreBackupFileName,
                ChecksumSha256: verification.ChecksumSha256);
        }
        finally
        {
            _activeFiles.TryRemove(Path.GetFileName(fullPath), out _);
        }
    }

    protected virtual async Task<CreateBackupResult> CreateBackupInternalAsync(AppUser admin, bool isPreRestoreSnapshot, CancellationToken ct)
    {
        var now = _timeProvider.GetUtcNow().UtcDateTime;
        var prefix = isPreRestoreSnapshot ? "SmartFarm_PreRestore" : "SmartFarm_Backup";
        var fileName = $"{prefix}_{now:yyyyMMdd_HHmmss}_{Guid.NewGuid().ToString("N")[..8]}.sfbackup";
        var fullPath = Path.Combine(_storageDirectory, fileName);

        if (!_activeFiles.TryAdd(fileName, 1))
        {
            throw new ResourceConflictException("Không thể tạo tệp sao lưu do xung đột tên tệp.");
        }

        try
        {
            // Gather all operational and domain data, explicitly excluding secrets
            var snapshot = await ExtractDatabaseSnapshotAsync(ct);

            // Serialize data payload to UTF-8 bytes
            var dataJsonBytes = JsonSerializer.SerializeToUtf8Bytes(snapshot.Tables, JsonOpts);
            var payloadSha256 = Convert.ToHexString(SHA256.HashData(dataJsonBytes));

            // Create Manifest
            var manifest = new BackupManifest(
                FormatVersion: CurrentFormatVersion,
                AppVersion: "SmartFarm-1.0",
                CreatedAtUtc: now,
                CreatedByEmail: admin.Email,
                DatabaseProvider: _dbContext.Database.ProviderName ?? "Unknown",
                PayloadSha256: payloadSha256,
                PayloadSizeBytes: dataJsonBytes.Length,
                TotalRecords: snapshot.TotalRecords,
                TableRecordCounts: snapshot.RecordCounts,
                SupportedScope: SupportedScope,
                ExcludedTables: new[] { "RefreshTokens", "TelemetryReadings" },
                ExcludedFields: new Dictionary<string, string[]>
                {
                    ["AppUsers"] = new[] { "PasswordHash", "NormalizedEmail" }
                },
                SecurityNotice: "Mật khẩu người dùng và token phiên đăng nhập bị loại trừ vì lý do an toàn. Người dùng cần đặt lại mật khẩu sau khi khôi phục.");

            var manifestJsonBytes = JsonSerializer.SerializeToUtf8Bytes(manifest, JsonOpts);

            // Write as ZipArchive with manifest.json and data.json
            await using (var fileStream = new FileStream(fullPath, FileMode.Create, FileAccess.Write, FileShare.None))
            using (var zipArchive = new ZipArchive(fileStream, ZipArchiveMode.Create, leaveOpen: false))
            {
                var manifestEntry = zipArchive.CreateEntry(ManifestEntryName, CompressionLevel.Optimal);
                await using (var manifestStream = manifestEntry.Open())
                {
                    await manifestStream.WriteAsync(manifestJsonBytes, ct);
                }

                var dataEntry = zipArchive.CreateEntry(DataEntryName, CompressionLevel.Optimal);
                await using (var dataStream = dataEntry.Open())
                {
                    await dataStream.WriteAsync(dataJsonBytes, ct);
                }
            }

            var fileInfo = new FileInfo(fullPath);

            // Audit log
            var auditAction = isPreRestoreSnapshot ? "CREATE_PRE_RESTORE_BACKUP" : "CREATE_BACKUP";
            await TryRecordAuditLogAsync(
                admin.Id,
                admin.FullName,
                admin.Role.ToString(),
                auditAction,
                fileName,
                $"Tạo bản sao lưu {fileName} gồm {snapshot.TotalRecords} bản ghi ({snapshot.RecordCounts.Count} bảng), dung lượng {fileInfo.Length} bytes, SHA-256: {payloadSha256}",
                now,
                ct);

            // Prune old backups (only for regular backups, never pre-restore backups)
            if (!isPreRestoreSnapshot)
            {
                PruneOldBackups();
            }

            _logger.LogInformation("Created backup archive {FileName}: {Records} records, SHA256: {Checksum}", fileName, snapshot.TotalRecords, payloadSha256);

            return new CreateBackupResult(
                FileName: fileName,
                SizeBytes: fileInfo.Length,
                CreatedAtUtc: now,
                TotalRecords: snapshot.TotalRecords,
                ChecksumSha256: payloadSha256,
                TableRecordCounts: snapshot.RecordCounts);
        }
        finally
        {
            _activeFiles.TryRemove(fileName, out _);
        }
    }

    private async Task<VerifyBackupResult> VerifyBackupFileInternalAsync(string fullPath, CancellationToken ct)
    {
        var fileName = Path.GetFileName(fullPath);
        var maxFileSizeBytes = _configuration.GetValue("BackupStorage:MaxBackupFileSizeBytes", 50L * 1024 * 1024);
        var maxUncompressedBytes = _configuration.GetValue("BackupStorage:MaxUncompressedSizeBytes", 200L * 1024 * 1024);

        var fileInfo = new FileInfo(fullPath);
        if (fileInfo.Length > maxFileSizeBytes)
        {
            return new VerifyBackupResult(
                FileName: fileName,
                IsValid: false,
                ChecksumSha256: string.Empty,
                ChecksumVerified: false,
                FormatVersion: "unknown",
                TotalRecords: 0,
                TableRecordCounts: new Dictionary<string, int>(),
                MissingRequiredTables: Array.Empty<string>(),
                Warnings: new[] { $"Kích thước tệp ({fileInfo.Length} bytes) vượt quá giới hạn cho phép ({maxFileSizeBytes} bytes)." },
                Message: "Tệp sao lưu quá lớn.",
                VerifiedAtUtc: _timeProvider.GetUtcNow().UtcDateTime);
        }

        try
        {
            await using var fileStream = new FileStream(fullPath, FileMode.Open, FileAccess.Read, FileShare.Read);
            using var zipArchive = new ZipArchive(fileStream, ZipArchiveMode.Read, leaveOpen: false);

            var manifestEntry = zipArchive.GetEntry(ManifestEntryName);
            var dataEntry = zipArchive.GetEntry(DataEntryName);

            if (manifestEntry == null || dataEntry == null)
            {
                return new VerifyBackupResult(
                    FileName: fileName,
                    IsValid: false,
                    ChecksumSha256: string.Empty,
                    ChecksumVerified: false,
                    FormatVersion: "unknown",
                    TotalRecords: 0,
                    TableRecordCounts: new Dictionary<string, int>(),
                    MissingRequiredTables: Array.Empty<string>(),
                    Warnings: new[] { "Tệp sao lưu thiếu manifest.json hoặc data.json bắt buộc." },
                    Message: "Định dạng tệp sao lưu không hợp lệ.",
                    VerifiedAtUtc: _timeProvider.GetUtcNow().UtcDateTime);
            }

            // Read manifest
            BackupManifest? manifest;
            await using (var manifestStream = manifestEntry.Open())
            {
                manifest = await JsonSerializer.DeserializeAsync<BackupManifest>(manifestStream, JsonOpts, ct);
            }

            if (manifest == null || manifest.FormatVersion != CurrentFormatVersion)
            {
                return new VerifyBackupResult(
                    FileName: fileName,
                    IsValid: false,
                    ChecksumSha256: manifest?.PayloadSha256 ?? string.Empty,
                    ChecksumVerified: false,
                    FormatVersion: manifest?.FormatVersion ?? "unknown",
                    TotalRecords: manifest?.TotalRecords ?? 0,
                    TableRecordCounts: manifest?.TableRecordCounts ?? new Dictionary<string, int>(),
                    MissingRequiredTables: Array.Empty<string>(),
                    Warnings: new[] { $"Phiên bản định dạng '{manifest?.FormatVersion}' không tương thích (yêu cầu {CurrentFormatVersion})." },
                    Message: "Phiên bản tệp sao lưu không tương thích.",
                    VerifiedAtUtc: _timeProvider.GetUtcNow().UtcDateTime);
            }

            // Check declared uncompressed size against zip bomb threshold
            if (dataEntry.Length > maxUncompressedBytes)
            {
                return new VerifyBackupResult(
                    FileName: fileName,
                    IsValid: false,
                    ChecksumSha256: manifest.PayloadSha256,
                    ChecksumVerified: false,
                    FormatVersion: manifest.FormatVersion,
                    TotalRecords: manifest.TotalRecords,
                    TableRecordCounts: manifest.TableRecordCounts,
                    MissingRequiredTables: Array.Empty<string>(),
                    Warnings: new[] { $"Kích thước giải nén ({dataEntry.Length} bytes) vượt quá giới hạn an toàn ({maxUncompressedBytes} bytes)." },
                    Message: "Phát hiện tệp có dấu hiệu Zip Bomb hoặc dung lượng giải nén quá lớn.",
                    VerifiedAtUtc: _timeProvider.GetUtcNow().UtcDateTime);
            }

            // Stream and compute SHA-256 with byte limit protection
            using var sha256 = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
            long totalRead = 0;
            var buffer = new byte[81920]; // 80 KB buffer

            await using (var dataStream = dataEntry.Open())
            await using (var memoryCopy = new MemoryStream())
            {
                int bytesRead;
                while ((bytesRead = await dataStream.ReadAsync(buffer, ct)) > 0)
                {
                    totalRead += bytesRead;
                    if (totalRead > maxUncompressedBytes)
                    {
                        return new VerifyBackupResult(
                            FileName: fileName,
                            IsValid: false,
                            ChecksumSha256: manifest.PayloadSha256,
                            ChecksumVerified: false,
                            FormatVersion: manifest.FormatVersion,
                            TotalRecords: manifest.TotalRecords,
                            TableRecordCounts: manifest.TableRecordCounts,
                            MissingRequiredTables: Array.Empty<string>(),
                            Warnings: new[] { "Dữ liệu giải nén thực tế vượt ngưỡng an toàn trong khi đọc luồng." },
                            Message: "Giải nén thất bại do vượt ngưỡng dung lượng tối đa.",
                            VerifiedAtUtc: _timeProvider.GetUtcNow().UtcDateTime);
                    }

                    sha256.AppendData(buffer, 0, bytesRead);
                    await memoryCopy.WriteAsync(buffer.AsMemory(0, bytesRead), ct);
                }

                var computedHashHex = Convert.ToHexString(sha256.GetHashAndReset());
                var declaredHashBytes = Convert.FromHexString(manifest.PayloadSha256);
                var computedHashBytes = Convert.FromHexString(computedHashHex);

                var isHashValid = CryptographicOperations.FixedTimeEquals(declaredHashBytes, computedHashBytes);
                if (!isHashValid)
                {
                    return new VerifyBackupResult(
                        FileName: fileName,
                        IsValid: false,
                        ChecksumSha256: computedHashHex,
                        ChecksumVerified: false,
                        FormatVersion: manifest.FormatVersion,
                        TotalRecords: manifest.TotalRecords,
                        TableRecordCounts: manifest.TableRecordCounts,
                        MissingRequiredTables: Array.Empty<string>(),
                        Warnings: new[] { $"Mã SHA-256 tính toán ({computedHashHex}) không khớp với bản khai ({manifest.PayloadSha256})." },
                        Message: "Mã băm SHA-256 không khớp. Tệp sao lưu đã bị thay đổi, chỉnh sửa hoặc hư hỏng.",
                        VerifiedAtUtc: _timeProvider.GetUtcNow().UtcDateTime);
                }

                if (manifest.PayloadSizeBytes != totalRead)
                {
                    return new VerifyBackupResult(
                        FileName: fileName,
                        IsValid: false,
                        ChecksumSha256: computedHashHex,
                        ChecksumVerified: false,
                        FormatVersion: manifest.FormatVersion,
                        TotalRecords: manifest.TotalRecords,
                        TableRecordCounts: manifest.TableRecordCounts,
                        MissingRequiredTables: Array.Empty<string>(),
                        Warnings: new[] { $"Dung lượng payload thực tế ({totalRead} bytes) không khớp với manifest ({manifest.PayloadSizeBytes} bytes)." },
                        Message: "Dung lượng dữ liệu giải nén không khớp với bản khai trong manifest.",
                        VerifiedAtUtc: _timeProvider.GetUtcNow().UtcDateTime);
                }

                var calculatedSumRecords = manifest.TableRecordCounts.Values.Sum();
                if (manifest.TotalRecords != calculatedSumRecords)
                {
                    return new VerifyBackupResult(
                        FileName: fileName,
                        IsValid: false,
                        ChecksumSha256: computedHashHex,
                        ChecksumVerified: false,
                        FormatVersion: manifest.FormatVersion,
                        TotalRecords: manifest.TotalRecords,
                        TableRecordCounts: manifest.TableRecordCounts,
                        MissingRequiredTables: Array.Empty<string>(),
                        Warnings: new[] { $"Tổng số bản ghi trong manifest ({manifest.TotalRecords}) không khớp với tổng các bảng ({calculatedSumRecords})." },
                        Message: "Bất nhất số lượng bản ghi trong manifest sao lưu.",
                        VerifiedAtUtc: _timeProvider.GetUtcNow().UtcDateTime);
                }

                // Check manifest table set against SupportedScopeTables
                var missingManifestTables = SupportedScopeTables.Where(t => !manifest.TableRecordCounts.ContainsKey(t)).ToList();
                var extraManifestTables = manifest.TableRecordCounts.Keys.Where(t => !SupportedScopeTables.Contains(t)).ToList();

                var warnings = new List<string>();
                if (missingManifestTables.Count > 0)
                {
                    warnings.Add($"Manifest thiếu các bảng bắt buộc: {string.Join(", ", missingManifestTables)}");
                }
                if (extraManifestTables.Count > 0)
                {
                    warnings.Add($"Manifest chứa các bảng không thuộc phạm vi hỗ trợ: {string.Join(", ", extraManifestTables)}");
                }

                // Parse and validate data payload
                memoryCopy.Position = 0;
                using var jsonDoc = await JsonDocument.ParseAsync(memoryCopy, cancellationToken: ct);
                var root = jsonDoc.RootElement;

                if (root.ValueKind != JsonValueKind.Object)
                {
                    warnings.Add("Payload trong data.json không phải là một JSON Object hợp lệ.");
                    return new VerifyBackupResult(
                        FileName: fileName,
                        IsValid: false,
                        ChecksumSha256: computedHashHex,
                        ChecksumVerified: true,
                        FormatVersion: manifest.FormatVersion,
                        TotalRecords: manifest.TotalRecords,
                        TableRecordCounts: manifest.TableRecordCounts,
                        MissingRequiredTables: missingManifestTables,
                        Warnings: warnings,
                        Message: "Cấu trúc dữ liệu payload không hợp lệ.",
                        VerifiedAtUtc: _timeProvider.GetUtcNow().UtcDateTime);
                }

                var missingPayloadTables = SupportedScopeTables.Where(t => !root.TryGetProperty(t, out _)).ToList();
                if (missingPayloadTables.Count > 0)
                {
                    warnings.Add($"Payload thiếu các bảng dữ liệu bắt buộc: {string.Join(", ", missingPayloadTables)}");
                }

                var extraPayloadTables = root.EnumerateObject()
                    .Where(p => !SupportedScopeTables.Contains(p.Name))
                    .Select(p => p.Name)
                    .ToList();
                if (extraPayloadTables.Count > 0)
                {
                    warnings.Add($"Payload chứa các bảng nằm ngoài phạm vi hỗ trợ: {string.Join(", ", extraPayloadTables)}");
                }

                var actualTotalRecords = 0;
                foreach (var prop in root.EnumerateObject())
                {
                    if (prop.Value.ValueKind != JsonValueKind.Array)
                    {
                        warnings.Add($"Bảng '{prop.Name}' trong payload không phải là một JSON Array.");
                        continue;
                    }

                    var actualCount = prop.Value.GetArrayLength();
                    actualTotalRecords += actualCount;

                    if (manifest.TableRecordCounts.TryGetValue(prop.Name, out var manifestCount))
                    {
                        if (actualCount != manifestCount)
                        {
                            warnings.Add($"Bảng '{prop.Name}' có số phần tử thực tế ({actualCount}) khác manifest ({manifestCount}).");
                        }
                    }
                    else
                    {
                        warnings.Add($"Bảng '{prop.Name}' trong payload không tồn tại trong manifest.");
                    }
                }

                if (manifest.TotalRecords != actualTotalRecords)
                {
                    warnings.Add($"Tổng số bản ghi thực tế trong payload ({actualTotalRecords}) không khớp với manifest ({manifest.TotalRecords}).");
                }

                var allMissingTables = missingManifestTables.Union(missingPayloadTables).Distinct().ToList();
                var isValid = warnings.Count == 0;
                var message = isValid
                    ? $"Thẩm định tính toàn vẹn thành công: Mã SHA-256 khớp tuyệt đối, cấu trúc đầy đủ {manifest.TableRecordCounts.Count} bảng và {manifest.TotalRecords} bản ghi hợp lệ."
                    : $"Tệp sao lưu không hợp lệ: {string.Join("; ", warnings)}";

                return new VerifyBackupResult(
                    FileName: fileName,
                    IsValid: isValid,
                    ChecksumSha256: computedHashHex,
                    ChecksumVerified: true,
                    FormatVersion: manifest.FormatVersion,
                    TotalRecords: manifest.TotalRecords,
                    TableRecordCounts: manifest.TableRecordCounts,
                    MissingRequiredTables: allMissingTables,
                    Warnings: warnings,
                    Message: message,
                    VerifiedAtUtc: _timeProvider.GetUtcNow().UtcDateTime);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Verification failed for backup file: {FileName}", fileName);
            return new VerifyBackupResult(
                FileName: fileName,
                IsValid: false,
                ChecksumSha256: string.Empty,
                ChecksumVerified: false,
                FormatVersion: "unknown",
                TotalRecords: 0,
                TableRecordCounts: new Dictionary<string, int>(),
                MissingRequiredTables: Array.Empty<string>(),
                Warnings: new[] { $"Lỗi phân tích cú pháp tệp: {ex.Message}" },
                Message: $"Không thể đọc tệp sao lưu: {ex.Message}",
                VerifiedAtUtc: _timeProvider.GetUtcNow().UtcDateTime);
        }
    }

    private async Task<JsonElement> ExtractAndParseTablesPayloadAsync(string fullPath, CancellationToken ct)
    {
        await using var fileStream = new FileStream(fullPath, FileMode.Open, FileAccess.Read, FileShare.Read);
        using var zipArchive = new ZipArchive(fileStream, ZipArchiveMode.Read, leaveOpen: false);

        var dataEntry = zipArchive.GetEntry(DataEntryName)
            ?? throw new RequestValidationException("backup", "Tệp sao lưu thiếu thành phần data.json.");

        await using var dataStream = dataEntry.Open();
        using var doc = await JsonDocument.ParseAsync(dataStream, cancellationToken: ct);
        return doc.RootElement.Clone();
    }

    protected virtual async Task<int> ApplyRestorationPayloadAsync(
        JsonElement tables,
        Guid currentAdminUserId,
        List<string> restoredTables,
        CancellationToken ct)
    {
        // ─── Phase 1: Clean existing data in reverse topological order ────────────────
        // Preserve current active admin credentials and system audit logs
        var currentAdmin = await _dbContext.AppUsers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == currentAdminUserId, ct);

        _dbContext.Notifications.RemoveRange(await _dbContext.Notifications.ToListAsync(ct));
        _dbContext.FinanceTransactions.RemoveRange(await _dbContext.FinanceTransactions.ToListAsync(ct));
        _dbContext.AiRecommendationDecisions.RemoveRange(await _dbContext.AiRecommendationDecisions.ToListAsync(ct));
        _dbContext.AiRecommendations.RemoveRange(await _dbContext.AiRecommendations.ToListAsync(ct));
        _dbContext.AiConsultationRequests.RemoveRange(await _dbContext.AiConsultationRequests.ToListAsync(ct));
        _dbContext.AlertHistoryEvents.RemoveRange(await _dbContext.AlertHistoryEvents.ToListAsync(ct));
        _dbContext.Alerts.RemoveRange(await _dbContext.Alerts.ToListAsync(ct));
        _dbContext.AlertRuleEvaluationStates.RemoveRange(await _dbContext.AlertRuleEvaluationStates.ToListAsync(ct));
        _dbContext.AlertRules.RemoveRange(await _dbContext.AlertRules.ToListAsync(ct));
        _dbContext.ActuatorCommandEvents.RemoveRange(await _dbContext.ActuatorCommandEvents.ToListAsync(ct));
        _dbContext.ActuatorCommands.RemoveRange(await _dbContext.ActuatorCommands.ToListAsync(ct));
        _dbContext.ControlSchedules.RemoveRange(await _dbContext.ControlSchedules.ToListAsync(ct));
        _dbContext.AutoControlRules.RemoveRange(await _dbContext.AutoControlRules.ToListAsync(ct));
        _dbContext.ServiceRequestPayments.RemoveRange(await _dbContext.ServiceRequestPayments.ToListAsync(ct));
        _dbContext.ServiceRequestQuotationItems.RemoveRange(await _dbContext.ServiceRequestQuotationItems.ToListAsync(ct));
        _dbContext.ServiceRequestQuotations.RemoveRange(await _dbContext.ServiceRequestQuotations.ToListAsync(ct));
        _dbContext.DeviceReplacements.RemoveRange(await _dbContext.DeviceReplacements.ToListAsync(ct));
        _dbContext.ServiceRequestHistories.RemoveRange(await _dbContext.ServiceRequestHistories.ToListAsync(ct));
        _dbContext.ServiceRequests.RemoveRange(await _dbContext.ServiceRequests.ToListAsync(ct));
        _dbContext.LowStockAlerts.RemoveRange(await _dbContext.LowStockAlerts.ToListAsync(ct));
        _dbContext.InventoryTransactions.RemoveRange(await _dbContext.InventoryTransactions.ToListAsync(ct));
        _dbContext.MaterialRequirementLinks.RemoveRange(await _dbContext.MaterialRequirementLinks.ToListAsync(ct));
        _dbContext.InventoryItems.RemoveRange(await _dbContext.InventoryItems.ToListAsync(ct));
        _dbContext.DeviceDiagnosticJobs.RemoveRange(await _dbContext.DeviceDiagnosticJobs.ToListAsync(ct));
        _dbContext.DeviceConnectionTests.RemoveRange(await _dbContext.DeviceConnectionTests.ToListAsync(ct));
        _dbContext.DeviceAssignmentHistory.RemoveRange(await _dbContext.DeviceAssignmentHistory.ToListAsync(ct));
        _dbContext.DeviceActuators.RemoveRange(await _dbContext.DeviceActuators.ToListAsync(ct));
        _dbContext.DeviceSensors.RemoveRange(await _dbContext.DeviceSensors.ToListAsync(ct));
        _dbContext.Devices.RemoveRange(await _dbContext.Devices.ToListAsync(ct));
        _dbContext.FirmwareJobs.RemoveRange(await _dbContext.FirmwareJobs.ToListAsync(ct));
        _dbContext.Gateways.RemoveRange(await _dbContext.Gateways.ToListAsync(ct));
        _dbContext.DeploymentDecisionHistory.RemoveRange(await _dbContext.DeploymentDecisionHistory.ToListAsync(ct));
        _dbContext.DeploymentSurveys.RemoveRange(await _dbContext.DeploymentSurveys.ToListAsync(ct));
        _dbContext.DeploymentPlanItems.RemoveRange(await _dbContext.DeploymentPlanItems.ToListAsync(ct));
        _dbContext.DeploymentRequests.RemoveRange(await _dbContext.DeploymentRequests.ToListAsync(ct));
        _dbContext.DeviceDepreciations.RemoveRange(await _dbContext.DeviceDepreciations.ToListAsync(ct));
        _dbContext.ZoneContractRenewals.RemoveRange(await _dbContext.ZoneContractRenewals.ToListAsync(ct));
        _dbContext.ZoneContracts.RemoveRange(await _dbContext.ZoneContracts.ToListAsync(ct));
        _dbContext.FarmTaskAssignments.RemoveRange(await _dbContext.FarmTaskAssignments.ToListAsync(ct));
        _dbContext.FarmTaskHistory.RemoveRange(await _dbContext.FarmTaskHistory.ToListAsync(ct));
        _dbContext.FarmTasks.RemoveRange(await _dbContext.FarmTasks.ToListAsync(ct));
        _dbContext.FarmInvitations.RemoveRange(await _dbContext.FarmInvitations.ToListAsync(ct));
        _dbContext.UserZoneAccesses.RemoveRange(await _dbContext.UserZoneAccesses.ToListAsync(ct));
        _dbContext.SeasonStageTransitions.RemoveRange(await _dbContext.SeasonStageTransitions.ToListAsync(ct));
        _dbContext.SeasonAppliedRequirements.RemoveRange(await _dbContext.SeasonAppliedRequirements.ToListAsync(ct));
        _dbContext.PlantingSeasons.RemoveRange(await _dbContext.PlantingSeasons.ToListAsync(ct));
        _dbContext.FarmingSeasons.RemoveRange(await _dbContext.FarmingSeasons.ToListAsync(ct));
        _dbContext.Zones.RemoveRange(await _dbContext.Zones.ToListAsync(ct));
        _dbContext.Fields.RemoveRange(await _dbContext.Fields.ToListAsync(ct));
        _dbContext.Farms.RemoveRange(await _dbContext.Farms.ToListAsync(ct));
        _dbContext.EnvironmentalRequirements.RemoveRange(await _dbContext.EnvironmentalRequirements.ToListAsync(ct));
        _dbContext.GrowthStages.RemoveRange(await _dbContext.GrowthStages.ToListAsync(ct));
        _dbContext.GrowthProfiles.RemoveRange(await _dbContext.GrowthProfiles.ToListAsync(ct));
        _dbContext.CropVarieties.RemoveRange(await _dbContext.CropVarieties.ToListAsync(ct));
        _dbContext.Crops.RemoveRange(await _dbContext.Crops.ToListAsync(ct));
        _dbContext.DeviceModelCapabilities.RemoveRange(await _dbContext.DeviceModelCapabilities.ToListAsync(ct));
        _dbContext.DeviceModelDefinitions.RemoveRange(await _dbContext.DeviceModelDefinitions.ToListAsync(ct));
        _dbContext.PlatformHardwareItems.RemoveRange(await _dbContext.PlatformHardwareItems.ToListAsync(ct));
        _dbContext.PlatformSettings.RemoveRange(await _dbContext.PlatformSettings.ToListAsync(ct));
        _dbContext.AgricultureKnowledgeChunks.RemoveRange(await _dbContext.AgricultureKnowledgeChunks.ToListAsync(ct));
        _dbContext.AgricultureDocuments.RemoveRange(await _dbContext.AgricultureDocuments.ToListAsync(ct));

        // Delete users except current admin
        var usersToDelete = await _dbContext.AppUsers.Where(u => u.Id != currentAdminUserId).ToListAsync(ct);
        _dbContext.AppUsers.RemoveRange(usersToDelete);

        _dbContext.Tenants.RemoveRange(await _dbContext.Tenants.ToListAsync(ct));

        await _dbContext.SaveChangesAsync(ct);

        // ─── Phase 2: Insert in forward topological dependency order ──────────────────
        var totalRestored = 0;

        // Level 0: Independent entities
        if (tables.TryGetProperty("Tenants", out var tProp))
        {
            if (!restoredTables.Contains("Tenants")) restoredTables.Add("Tenants");
            var tenants = JsonSerializer.Deserialize<List<Tenant>>(tProp.GetRawText(), JsonOpts) ?? [];
            if (tenants.Count > 0)
            {
                await _dbContext.Tenants.AddRangeAsync(tenants, ct);
                await _dbContext.SaveChangesAsync(ct);
                totalRestored += tenants.Count;
            }
        }

        // Level 1: AppUsers (with password security preservation)
        if (tables.TryGetProperty("AppUsers", out var uProp))
        {
            if (!restoredTables.Contains("AppUsers")) restoredTables.Add("AppUsers");
            var userRecords = JsonSerializer.Deserialize<List<AppUserBackupRecord>>(uProp.GetRawText(), JsonOpts) ?? [];
            var usersToAdd = new List<AppUser>();

            foreach (var rec in userRecords)
            {
                if (rec.Id == currentAdminUserId && currentAdmin != null)
                {
                    // Update current admin metadata but preserve existing valid password and security state
                    var activeAdmin = await _dbContext.AppUsers.FindAsync(new object[] { currentAdminUserId }, ct);
                    if (activeAdmin != null)
                    {
                        activeAdmin.FullName = rec.FullName;
                        activeAdmin.Phone = rec.Phone;
                        await _dbContext.SaveChangesAsync(ct);
                    }
                    if (!restoredTables.Contains("AppUsers")) restoredTables.Add("AppUsers");
                    totalRestored++;
                    continue;
                }

                usersToAdd.Add(new AppUser
                {
                    Id = rec.Id,
                    Email = rec.Email,
                    NormalizedEmail = rec.Email.ToUpperInvariant(),
                    FullName = rec.FullName,
                    Phone = rec.Phone,
                    Role = rec.Role,
                    Status = rec.Status,
                    TenantId = rec.TenantId,
                    FarmId = rec.FarmId,
                    CreatedAtUtc = rec.CreatedAtUtc,
                    // Secure placeholder requiring password reset for users whose password was stripped
                    PasswordHash = "RESET_PASSWORD_REQUIRED_" + Guid.NewGuid().ToString("N")
                });
            }

            if (usersToAdd.Count > 0)
            {
                await _dbContext.AppUsers.AddRangeAsync(usersToAdd, ct);
                await _dbContext.SaveChangesAsync(ct);
                restoredTables.Add("AppUsers");
                totalRestored += usersToAdd.Count;
            }
        }

        // Crops & Profiles
        totalRestored += await RestoreTableAsync(_dbContext.Crops, tables, "Crops", restoredTables, ct);
        totalRestored += await RestoreTableAsync(_dbContext.GrowthProfiles, tables, "GrowthProfiles", restoredTables, ct);
        totalRestored += await RestoreTableAsync(_dbContext.PlatformSettings, tables, "PlatformSettings", restoredTables, ct);
        totalRestored += await RestoreTableAsync(_dbContext.PlatformHardwareItems, tables, "PlatformHardwareItems", restoredTables, ct);
        totalRestored += await RestoreTableAsync(_dbContext.DeviceModelDefinitions, tables, "DeviceModelDefinitions", restoredTables, ct);
        totalRestored += await RestoreTableAsync(_dbContext.AgricultureDocuments, tables, "AgricultureDocuments", restoredTables, ct);

        // Level 2
        totalRestored += await RestoreTableAsync(_dbContext.CropVarieties, tables, "CropVarieties", restoredTables, ct);
        totalRestored += await RestoreTableAsync(_dbContext.GrowthStages, tables, "GrowthStages", restoredTables, ct);
        totalRestored += await RestoreTableAsync(_dbContext.Farms, tables, "Farms", restoredTables, ct);
        totalRestored += await RestoreTableAsync(_dbContext.DeviceModelCapabilities, tables, "DeviceModelCapabilities", restoredTables, ct);

        // Level 3
        totalRestored += await RestoreTableAsync(_dbContext.Fields, tables, "Fields", restoredTables, ct);
        totalRestored += await RestoreTableAsync(_dbContext.EnvironmentalRequirements, tables, "EnvironmentalRequirements", restoredTables, ct);

        // Level 4
        totalRestored += await RestoreTableAsync(_dbContext.Zones, tables, "Zones", restoredTables, ct);

        // Level 5
        totalRestored += await RestoreTableAsync(_dbContext.DeploymentRequests, tables, "DeploymentRequests", restoredTables, ct);
        totalRestored += await RestoreTableAsync(_dbContext.FarmingSeasons, tables, "FarmingSeasons", restoredTables, ct);
        totalRestored += await RestoreTableAsync(_dbContext.PlantingSeasons, tables, "PlantingSeasons", restoredTables, ct);
        totalRestored += await RestoreTableAsync(_dbContext.Gateways, tables, "Gateways", restoredTables, ct);
        totalRestored += await RestoreTableAsync(_dbContext.InventoryItems, tables, "InventoryItems", restoredTables, ct);
        totalRestored += await RestoreTableAsync(_dbContext.FarmTasks, tables, "FarmTasks", restoredTables, ct);
        totalRestored += await RestoreTableAsync(_dbContext.ZoneContracts, tables, "ZoneContracts", restoredTables, ct);

        // Level 6
        totalRestored += await RestoreTableAsync(_dbContext.DeploymentPlanItems, tables, "DeploymentPlanItems", restoredTables, ct);
        totalRestored += await RestoreTableAsync(_dbContext.DeploymentSurveys, tables, "DeploymentSurveys", restoredTables, ct);
        totalRestored += await RestoreTableAsync(_dbContext.DeploymentDecisionHistory, tables, "DeploymentDecisionHistory", restoredTables, ct);
        totalRestored += await RestoreTableAsync(_dbContext.Devices, tables, "Devices", restoredTables, ct);
        totalRestored += await RestoreTableAsync(_dbContext.SeasonAppliedRequirements, tables, "SeasonAppliedRequirements", restoredTables, ct);
        totalRestored += await RestoreTableAsync(_dbContext.SeasonStageTransitions, tables, "SeasonStageTransitions", restoredTables, ct);
        totalRestored += await RestoreTableAsync(_dbContext.UserZoneAccesses, tables, "UserZoneAccesses", restoredTables, ct);
        totalRestored += await RestoreTableAsync(_dbContext.ZoneContractRenewals, tables, "ZoneContractRenewals", restoredTables, ct);
        totalRestored += await RestoreTableAsync(_dbContext.DeviceDepreciations, tables, "DeviceDepreciations", restoredTables, ct);
        totalRestored += await RestoreTableAsync(_dbContext.FarmTaskAssignments, tables, "FarmTaskAssignments", restoredTables, ct);
        totalRestored += await RestoreTableAsync(_dbContext.FarmTaskHistory, tables, "FarmTaskHistory", restoredTables, ct);
        totalRestored += await RestoreTableAsync(_dbContext.FarmInvitations, tables, "FarmInvitations", restoredTables, ct);

        // Level 7
        totalRestored += await RestoreTableAsync(_dbContext.DeviceSensors, tables, "DeviceSensors", restoredTables, ct);
        totalRestored += await RestoreTableAsync(_dbContext.DeviceActuators, tables, "DeviceActuators", restoredTables, ct);
        totalRestored += await RestoreTableAsync(_dbContext.DeviceAssignmentHistory, tables, "DeviceAssignmentHistory", restoredTables, ct);
        totalRestored += await RestoreTableAsync(_dbContext.DeviceConnectionTests, tables, "DeviceConnectionTests", restoredTables, ct);
        totalRestored += await RestoreTableAsync(_dbContext.DeviceDiagnosticJobs, tables, "DeviceDiagnosticJobs", restoredTables, ct);
        totalRestored += await RestoreTableAsync(_dbContext.FirmwareJobs, tables, "FirmwareJobs", restoredTables, ct);
        totalRestored += await RestoreTableAsync(_dbContext.ServiceRequests, tables, "ServiceRequests", restoredTables, ct);
        totalRestored += await RestoreTableAsync(_dbContext.ControlSchedules, tables, "ControlSchedules", restoredTables, ct);
        totalRestored += await RestoreTableAsync(_dbContext.AutoControlRules, tables, "AutoControlRules", restoredTables, ct);
        totalRestored += await RestoreTableAsync(_dbContext.MaterialRequirementLinks, tables, "MaterialRequirementLinks", restoredTables, ct);
        totalRestored += await RestoreTableAsync(_dbContext.InventoryTransactions, tables, "InventoryTransactions", restoredTables, ct);
        totalRestored += await RestoreTableAsync(_dbContext.LowStockAlerts, tables, "LowStockAlerts", restoredTables, ct);

        // Level 8
        totalRestored += await RestoreTableAsync(_dbContext.ServiceRequestHistories, tables, "ServiceRequestHistories", restoredTables, ct);
        totalRestored += await RestoreTableAsync(_dbContext.DeviceReplacements, tables, "DeviceReplacements", restoredTables, ct);
        totalRestored += await RestoreTableAsync(_dbContext.ServiceRequestQuotations, tables, "ServiceRequestQuotations", restoredTables, ct);
        totalRestored += await RestoreTableAsync(_dbContext.ActuatorCommands, tables, "ActuatorCommands", restoredTables, ct);
        totalRestored += await RestoreTableAsync(_dbContext.AlertRules, tables, "AlertRules", restoredTables, ct);

        // Level 9
        totalRestored += await RestoreTableAsync(_dbContext.ServiceRequestQuotationItems, tables, "ServiceRequestQuotationItems", restoredTables, ct);
        totalRestored += await RestoreTableAsync(_dbContext.ServiceRequestPayments, tables, "ServiceRequestPayments", restoredTables, ct);
        totalRestored += await RestoreTableAsync(_dbContext.ActuatorCommandEvents, tables, "ActuatorCommandEvents", restoredTables, ct);
        totalRestored += await RestoreTableAsync(_dbContext.AlertRuleEvaluationStates, tables, "AlertRuleEvaluationStates", restoredTables, ct);
        totalRestored += await RestoreTableAsync(_dbContext.Alerts, tables, "Alerts", restoredTables, ct);
        totalRestored += await RestoreTableAsync(_dbContext.AlertHistoryEvents, tables, "AlertHistoryEvents", restoredTables, ct);
        totalRestored += await RestoreTableAsync(_dbContext.AiConsultationRequests, tables, "AiConsultationRequests", restoredTables, ct);
        totalRestored += await RestoreTableAsync(_dbContext.AiRecommendations, tables, "AiRecommendations", restoredTables, ct);
        totalRestored += await RestoreTableAsync(_dbContext.AiRecommendationDecisions, tables, "AiRecommendationDecisions", restoredTables, ct);
        totalRestored += await RestoreTableAsync(_dbContext.Notifications, tables, "Notifications", restoredTables, ct);
        totalRestored += await RestoreTableAsync(_dbContext.FinanceTransactions, tables, "FinanceTransactions", restoredTables, ct);

        // Agriculture Knowledge Chunks with Vector handling
        if (tables.TryGetProperty("AgricultureKnowledgeChunks", out var chunkProp))
        {
            if (!restoredTables.Contains("AgricultureKnowledgeChunks")) restoredTables.Add("AgricultureKnowledgeChunks");
            var chunkRecords = JsonSerializer.Deserialize<List<ChunkBackupRecord>>(chunkProp.GetRawText(), JsonOpts) ?? [];
            var chunksToAdd = chunkRecords.Select(c => new AgricultureKnowledgeChunk
            {
                Id = c.Id,
                DocumentId = c.DocumentId,
                ChunkIndex = c.ChunkIndex,
                Content = c.Content,
                PageNumber = c.PageNumber,
                SectionTitle = c.SectionTitle,
                Topic = c.Topic,
                CropTags = c.CropTags,
                Keywords = c.Keywords,
                Status = c.Status,
                CreatedAtUtc = c.CreatedAtUtc,
                Embedding = c.EmbeddingFloats != null ? new Vector(c.EmbeddingFloats) : null
            }).ToList();

            if (chunksToAdd.Count > 0)
            {
                await _dbContext.AgricultureKnowledgeChunks.AddRangeAsync(chunksToAdd, ct);
                await _dbContext.SaveChangesAsync(ct);
                totalRestored += chunksToAdd.Count;
            }
        }

        return totalRestored;
    }

    private static async Task<int> RestoreTableAsync<T>(
        DbSet<T> dbSet,
        JsonElement tables,
        string tableName,
        List<string> restoredTables,
        CancellationToken ct) where T : class
    {
        if (tables.TryGetProperty(tableName, out var prop))
        {
            if (!restoredTables.Contains(tableName))
            {
                restoredTables.Add(tableName);
            }

            var items = JsonSerializer.Deserialize<List<T>>(prop.GetRawText(), JsonOpts);
            if (items != null && items.Count > 0)
            {
                await dbSet.AddRangeAsync(items, ct);
                await dbSet.Entry(items[0]).Context.SaveChangesAsync(ct);
                return items.Count;
            }
        }
        return 0;
    }

    private async Task<DatabaseSnapshot> ExtractDatabaseSnapshotAsync(CancellationToken ct)
    {
        var recordCounts = new Dictionary<string, int>();

        var tenants = await _dbContext.Tenants.AsNoTracking().ToListAsync(ct);
        recordCounts["Tenants"] = tenants.Count;

        var users = await _dbContext.AppUsers.AsNoTracking().Select(u => new AppUserBackupRecord(
            u.Id,
            u.Email,
            u.FullName,
            u.Phone,
            u.Role,
            u.Status,
            u.TenantId,
            u.FarmId,
            u.CreatedAtUtc)).ToListAsync(ct);
        recordCounts["AppUsers"] = users.Count;

        var crops = await _dbContext.Crops.AsNoTracking().ToListAsync(ct);
        recordCounts["Crops"] = crops.Count;

        var varieties = await _dbContext.CropVarieties.AsNoTracking().ToListAsync(ct);
        recordCounts["CropVarieties"] = varieties.Count;

        var profiles = await _dbContext.GrowthProfiles.AsNoTracking().ToListAsync(ct);
        recordCounts["GrowthProfiles"] = profiles.Count;

        var stages = await _dbContext.GrowthStages.AsNoTracking().ToListAsync(ct);
        recordCounts["GrowthStages"] = stages.Count;

        var requirements = await _dbContext.EnvironmentalRequirements.AsNoTracking().ToListAsync(ct);
        recordCounts["EnvironmentalRequirements"] = requirements.Count;

        var farms = await _dbContext.Farms.AsNoTracking().ToListAsync(ct);
        recordCounts["Farms"] = farms.Count;

        var fields = await _dbContext.Fields.AsNoTracking().ToListAsync(ct);
        recordCounts["Fields"] = fields.Count;

        var zones = await _dbContext.Zones.AsNoTracking().ToListAsync(ct);
        recordCounts["Zones"] = zones.Count;

        var userZoneAccesses = await _dbContext.UserZoneAccesses.AsNoTracking().ToListAsync(ct);
        recordCounts["UserZoneAccesses"] = userZoneAccesses.Count;

        var gateways = await _dbContext.Gateways.AsNoTracking().ToListAsync(ct);
        recordCounts["Gateways"] = gateways.Count;

        var devices = await _dbContext.Devices.AsNoTracking().ToListAsync(ct);
        recordCounts["Devices"] = devices.Count;

        var sensors = await _dbContext.DeviceSensors.AsNoTracking().ToListAsync(ct);
        recordCounts["DeviceSensors"] = sensors.Count;

        var actuators = await _dbContext.DeviceActuators.AsNoTracking().ToListAsync(ct);
        recordCounts["DeviceActuators"] = actuators.Count;

        var deviceAssignments = await _dbContext.DeviceAssignmentHistory.AsNoTracking().ToListAsync(ct);
        recordCounts["DeviceAssignmentHistory"] = deviceAssignments.Count;

        var connectionTests = await _dbContext.DeviceConnectionTests.AsNoTracking().ToListAsync(ct);
        recordCounts["DeviceConnectionTests"] = connectionTests.Count;

        var diagnosticJobs = await _dbContext.DeviceDiagnosticJobs.AsNoTracking().ToListAsync(ct);
        recordCounts["DeviceDiagnosticJobs"] = diagnosticJobs.Count;

        var firmwareJobs = await _dbContext.FirmwareJobs.AsNoTracking().ToListAsync(ct);
        recordCounts["FirmwareJobs"] = firmwareJobs.Count;

        var seasons = await _dbContext.PlantingSeasons.AsNoTracking().ToListAsync(ct);
        recordCounts["PlantingSeasons"] = seasons.Count;

        var farmingSeasons = await _dbContext.FarmingSeasons.AsNoTracking().ToListAsync(ct);
        recordCounts["FarmingSeasons"] = farmingSeasons.Count;

        var appliedRequirements = await _dbContext.SeasonAppliedRequirements.AsNoTracking().ToListAsync(ct);
        recordCounts["SeasonAppliedRequirements"] = appliedRequirements.Count;

        var stageTransitions = await _dbContext.SeasonStageTransitions.AsNoTracking().ToListAsync(ct);
        recordCounts["SeasonStageTransitions"] = stageTransitions.Count;

        var modelDefs = await _dbContext.DeviceModelDefinitions.AsNoTracking().ToListAsync(ct);
        recordCounts["DeviceModelDefinitions"] = modelDefs.Count;

        var modelCaps = await _dbContext.DeviceModelCapabilities.AsNoTracking().ToListAsync(ct);
        recordCounts["DeviceModelCapabilities"] = modelCaps.Count;

        var deployRequests = await _dbContext.DeploymentRequests.AsNoTracking().ToListAsync(ct);
        recordCounts["DeploymentRequests"] = deployRequests.Count;

        var planItems = await _dbContext.DeploymentPlanItems.AsNoTracking().ToListAsync(ct);
        recordCounts["DeploymentPlanItems"] = planItems.Count;

        var surveys = await _dbContext.DeploymentSurveys.AsNoTracking().ToListAsync(ct);
        recordCounts["DeploymentSurveys"] = surveys.Count;

        var decisions = await _dbContext.DeploymentDecisionHistory.AsNoTracking().ToListAsync(ct);
        recordCounts["DeploymentDecisionHistory"] = decisions.Count;

        var serviceRequests = await _dbContext.ServiceRequests.AsNoTracking().ToListAsync(ct);
        recordCounts["ServiceRequests"] = serviceRequests.Count;

        var serviceHistories = await _dbContext.ServiceRequestHistories.AsNoTracking().ToListAsync(ct);
        recordCounts["ServiceRequestHistories"] = serviceHistories.Count;

        var replacements = await _dbContext.DeviceReplacements.AsNoTracking().ToListAsync(ct);
        recordCounts["DeviceReplacements"] = replacements.Count;

        var quotations = await _dbContext.ServiceRequestQuotations.AsNoTracking().ToListAsync(ct);
        recordCounts["ServiceRequestQuotations"] = quotations.Count;

        var quotationItems = await _dbContext.ServiceRequestQuotationItems.AsNoTracking().ToListAsync(ct);
        recordCounts["ServiceRequestQuotationItems"] = quotationItems.Count;

        var payments = await _dbContext.ServiceRequestPayments.AsNoTracking().ToListAsync(ct);
        recordCounts["ServiceRequestPayments"] = payments.Count;

        var alertRules = await _dbContext.AlertRules.AsNoTracking().ToListAsync(ct);
        recordCounts["AlertRules"] = alertRules.Count;

        var alertStates = await _dbContext.AlertRuleEvaluationStates.AsNoTracking().ToListAsync(ct);
        recordCounts["AlertRuleEvaluationStates"] = alertStates.Count;

        var alerts = await _dbContext.Alerts.AsNoTracking().ToListAsync(ct);
        recordCounts["Alerts"] = alerts.Count;

        var alertEvents = await _dbContext.AlertHistoryEvents.AsNoTracking().ToListAsync(ct);
        recordCounts["AlertHistoryEvents"] = alertEvents.Count;

        var schedules = await _dbContext.ControlSchedules.AsNoTracking().ToListAsync(ct);
        recordCounts["ControlSchedules"] = schedules.Count;

        var autoRules = await _dbContext.AutoControlRules.AsNoTracking().ToListAsync(ct);
        recordCounts["AutoControlRules"] = autoRules.Count;

        var commands = await _dbContext.ActuatorCommands.AsNoTracking().ToListAsync(ct);
        recordCounts["ActuatorCommands"] = commands.Count;

        var commandEvents = await _dbContext.ActuatorCommandEvents.AsNoTracking().ToListAsync(ct);
        recordCounts["ActuatorCommandEvents"] = commandEvents.Count;

        var aiRequests = await _dbContext.AiConsultationRequests.AsNoTracking().ToListAsync(ct);
        recordCounts["AiConsultationRequests"] = aiRequests.Count;

        var aiRecs = await _dbContext.AiRecommendations.AsNoTracking().ToListAsync(ct);
        recordCounts["AiRecommendations"] = aiRecs.Count;

        var aiDecisions = await _dbContext.AiRecommendationDecisions.AsNoTracking().ToListAsync(ct);
        recordCounts["AiRecommendationDecisions"] = aiDecisions.Count;

        var inventoryItems = await _dbContext.InventoryItems.AsNoTracking().ToListAsync(ct);
        recordCounts["InventoryItems"] = inventoryItems.Count;

        var matLinks = await _dbContext.MaterialRequirementLinks.AsNoTracking().ToListAsync(ct);
        recordCounts["MaterialRequirementLinks"] = matLinks.Count;

        var inventoryTxs = await _dbContext.InventoryTransactions.AsNoTracking().ToListAsync(ct);
        recordCounts["InventoryTransactions"] = inventoryTxs.Count;

        var lowStockAlerts = await _dbContext.LowStockAlerts.AsNoTracking().ToListAsync(ct);
        recordCounts["LowStockAlerts"] = lowStockAlerts.Count;

        var tasks = await _dbContext.FarmTasks.AsNoTracking().ToListAsync(ct);
        recordCounts["FarmTasks"] = tasks.Count;

        var taskHistories = await _dbContext.FarmTaskHistory.AsNoTracking().ToListAsync(ct);
        recordCounts["FarmTaskHistory"] = taskHistories.Count;

        var taskAssignments = await _dbContext.FarmTaskAssignments.AsNoTracking().ToListAsync(ct);
        recordCounts["FarmTaskAssignments"] = taskAssignments.Count;

        var invitations = await _dbContext.FarmInvitations.AsNoTracking().ToListAsync(ct);
        recordCounts["FarmInvitations"] = invitations.Count;

        var financeTxs = await _dbContext.FinanceTransactions.AsNoTracking().ToListAsync(ct);
        recordCounts["FinanceTransactions"] = financeTxs.Count;

        var notifications = await _dbContext.Notifications.AsNoTracking().ToListAsync(ct);
        recordCounts["Notifications"] = notifications.Count;

        var settings = await _dbContext.PlatformSettings.AsNoTracking().ToListAsync(ct);
        recordCounts["PlatformSettings"] = settings.Count;

        var hardwareItems = await _dbContext.PlatformHardwareItems.AsNoTracking().ToListAsync(ct);
        recordCounts["PlatformHardwareItems"] = hardwareItems.Count;

        var contracts = await _dbContext.ZoneContracts.AsNoTracking().ToListAsync(ct);
        recordCounts["ZoneContracts"] = contracts.Count;

        var renewals = await _dbContext.ZoneContractRenewals.AsNoTracking().ToListAsync(ct);
        recordCounts["ZoneContractRenewals"] = renewals.Count;

        var depreciations = await _dbContext.DeviceDepreciations.AsNoTracking().ToListAsync(ct);
        recordCounts["DeviceDepreciations"] = depreciations.Count;

        var docs = await _dbContext.AgricultureDocuments.AsNoTracking().ToListAsync(ct);
        recordCounts["AgricultureDocuments"] = docs.Count;

        var chunks = await _dbContext.AgricultureKnowledgeChunks.AsNoTracking().Select(c => new ChunkBackupRecord(
            c.Id,
            c.DocumentId,
            c.ChunkIndex,
            c.Content,
            c.PageNumber,
            c.SectionTitle,
            c.Topic,
            c.CropTags,
            c.Keywords,
            c.Status,
            c.CreatedAtUtc,
            c.Embedding != null ? c.Embedding.ToArray() : null)).ToListAsync(ct);
        recordCounts["AgricultureKnowledgeChunks"] = chunks.Count;

        var tables = new Dictionary<string, object>
        {
            ["Tenants"] = tenants,
            ["AppUsers"] = users,
            ["Crops"] = crops,
            ["CropVarieties"] = varieties,
            ["GrowthProfiles"] = profiles,
            ["GrowthStages"] = stages,
            ["EnvironmentalRequirements"] = requirements,
            ["Farms"] = farms,
            ["Fields"] = fields,
            ["Zones"] = zones,
            ["UserZoneAccesses"] = userZoneAccesses,
            ["Gateways"] = gateways,
            ["Devices"] = devices,
            ["DeviceSensors"] = sensors,
            ["DeviceActuators"] = actuators,
            ["DeviceAssignmentHistory"] = deviceAssignments,
            ["DeviceConnectionTests"] = connectionTests,
            ["DeviceDiagnosticJobs"] = diagnosticJobs,
            ["FirmwareJobs"] = firmwareJobs,
            ["PlantingSeasons"] = seasons,
            ["FarmingSeasons"] = farmingSeasons,
            ["SeasonAppliedRequirements"] = appliedRequirements,
            ["SeasonStageTransitions"] = stageTransitions,
            ["DeviceModelDefinitions"] = modelDefs,
            ["DeviceModelCapabilities"] = modelCaps,
            ["DeploymentRequests"] = deployRequests,
            ["DeploymentPlanItems"] = planItems,
            ["DeploymentSurveys"] = surveys,
            ["DeploymentDecisionHistory"] = decisions,
            ["ServiceRequests"] = serviceRequests,
            ["ServiceRequestHistories"] = serviceHistories,
            ["DeviceReplacements"] = replacements,
            ["ServiceRequestQuotations"] = quotations,
            ["ServiceRequestQuotationItems"] = quotationItems,
            ["ServiceRequestPayments"] = payments,
            ["AlertRules"] = alertRules,
            ["AlertRuleEvaluationStates"] = alertStates,
            ["Alerts"] = alerts,
            ["AlertHistoryEvents"] = alertEvents,
            ["ControlSchedules"] = schedules,
            ["AutoControlRules"] = autoRules,
            ["ActuatorCommands"] = commands,
            ["ActuatorCommandEvents"] = commandEvents,
            ["AiConsultationRequests"] = aiRequests,
            ["AiRecommendations"] = aiRecs,
            ["AiRecommendationDecisions"] = aiDecisions,
            ["InventoryItems"] = inventoryItems,
            ["MaterialRequirementLinks"] = matLinks,
            ["InventoryTransactions"] = inventoryTxs,
            ["LowStockAlerts"] = lowStockAlerts,
            ["FarmTasks"] = tasks,
            ["FarmTaskHistory"] = taskHistories,
            ["FarmTaskAssignments"] = taskAssignments,
            ["FarmInvitations"] = invitations,
            ["FinanceTransactions"] = financeTxs,
            ["Notifications"] = notifications,
            ["PlatformSettings"] = settings,
            ["PlatformHardwareItems"] = hardwareItems,
            ["ZoneContracts"] = contracts,
            ["ZoneContractRenewals"] = renewals,
            ["DeviceDepreciations"] = depreciations,
            ["AgricultureDocuments"] = docs,
            ["AgricultureKnowledgeChunks"] = chunks
        };

        var totalRecords = recordCounts.Values.Sum();
        return new DatabaseSnapshot(tables, recordCounts, totalRecords);
    }

    private async Task<AppUser> ValidateAdminUserAsync(Guid adminUserId, CancellationToken ct)
    {
        var admin = await _dbContext.AppUsers.SingleOrDefaultAsync(x => x.Id == adminUserId, ct);
        if (admin == null || admin.Role != UserRole.PlatformAdmin)
        {
            throw new AuthorizationException("Chỉ Quản trị viên Platform (PlatformAdmin) mới có quyền thực hiện thao tác sao lưu & khôi phục.");
        }

        if (admin.Status != AccountStatus.Active)
        {
            throw new AuthorizationException("Tài khoản Quản trị viên đã bị vô hiệu hóa hoặc không còn hoạt động.");
        }

        return admin;
    }

    private string ValidateBackupPath(string fileName)
    {
        var safeFileName = Path.GetFileName(fileName);
        if (string.IsNullOrWhiteSpace(safeFileName) ||
            safeFileName != fileName ||
            !safeFileName.EndsWith(".sfbackup", StringComparison.OrdinalIgnoreCase))
        {
            throw new RequestValidationException("fileName", "Tên tệp sao lưu không hợp lệ hoặc chứa ký tự bị cấm.");
        }

        var fullPath = Path.Combine(_storageDirectory, safeFileName);
        var normalizedDir = Path.GetFullPath(_storageDirectory).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        var normalizedFile = Path.GetFullPath(fullPath);

        if (!normalizedFile.StartsWith(normalizedDir + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(normalizedFile, normalizedDir, StringComparison.OrdinalIgnoreCase))
        {
            throw new AuthorizationException("Phát hiện hành vi truy xuất tệp trái phép ngoài thư mục sao lưu (Path Traversal).");
        }

        return fullPath;
    }

    private static BackupManifest? ReadManifest(string filePath)
    {
        try
        {
            using var fileStream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read);
            using var zipArchive = new ZipArchive(fileStream, ZipArchiveMode.Read, leaveOpen: false);
            var entry = zipArchive.GetEntry(ManifestEntryName);
            if (entry == null) return null;

            using var stream = entry.Open();
            return JsonSerializer.Deserialize<BackupManifest>(stream, JsonOpts);
        }
        catch
        {
            return null;
        }
    }

    private void PruneOldBackups()
    {
        try
        {
            var retentionDays = Math.Clamp(_configuration.GetValue("BackupStorage:RetentionDays", 30), 1, 365);
            var maxBackups = Math.Clamp(_configuration.GetValue("BackupStorage:MaxBackups", 20), 1, 100);

            var dir = new DirectoryInfo(_storageDirectory);
            if (!dir.Exists) return;

            var files = dir.GetFiles("*.sfbackup")
                .OrderByDescending(f => f.CreationTimeUtc)
                .ToList();

            var cutoff = DateTime.UtcNow.AddDays(-retentionDays);
            var nowMinusOneHour = DateTime.UtcNow.AddHours(-1);

            // 1. Delete files exceeding retention period (never delete files currently in active operation or created < 1h ago)
            foreach (var file in files.Where(f => f.CreationTimeUtc < cutoff && f.CreationTimeUtc < nowMinusOneHour))
            {
                if (_activeFiles.ContainsKey(file.Name)) continue;
                try
                {
                    file.Delete();
                    _logger.LogInformation("Pruned expired backup file: {FileName}", file.Name);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to prune backup file: {FileName}", file.Name);
                }
            }

            // 2. Delete files exceeding maximum count
            var remainingFiles = dir.GetFiles("*.sfbackup")
                .OrderByDescending(f => f.CreationTimeUtc)
                .ToList();

            if (remainingFiles.Count > maxBackups)
            {
                foreach (var file in remainingFiles.Skip(maxBackups))
                {
                    if (_activeFiles.ContainsKey(file.Name)) continue;
                    if (file.CreationTimeUtc > nowMinusOneHour) continue; // protect recent files
                    try
                    {
                        file.Delete();
                        _logger.LogInformation("Pruned excess backup file: {FileName}", file.Name);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to prune excess backup file: {FileName}", file.Name);
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error while pruning old backup files.");
        }
    }

    private async Task TryRecordAuditLogAsync(
        Guid actorUserId,
        string actorName,
        string actorRole,
        string action,
        string entityId,
        string details,
        DateTime createdAtUtc,
        CancellationToken ct)
    {
        try
        {
            _dbContext.AuditLogs.Add(new AuditLog
            {
                Id = Guid.NewGuid(),
                ActorUserId = actorUserId,
                ActorName = actorName,
                ActorRole = actorRole,
                Action = action,
                EntityName = "PlatformBackup",
                EntityId = entityId,
                Details = details,
                CreatedAtUtc = createdAtUtc
            });
            await _dbContext.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            // Do not fail the entire backup/restore operation if audit logging encounters a secondary error, but record to application log
            _logger.LogError(ex, "Failed to persist audit log entry for backup action {Action} on entity {EntityId}", action, entityId);
        }
    }

    private sealed record DatabaseSnapshot(
        Dictionary<string, object> Tables,
        Dictionary<string, int> RecordCounts,
        int TotalRecords);

    public sealed record AppUserBackupRecord(
        Guid Id,
        string Email,
        string FullName,
        string? Phone,
        UserRole Role,
        AccountStatus Status,
        Guid? TenantId,
        Guid? FarmId,
        DateTime CreatedAtUtc);

    public sealed record ChunkBackupRecord(
        Guid Id,
        Guid DocumentId,
        int ChunkIndex,
        string Content,
        int? PageNumber,
        string? SectionTitle,
        string Topic,
        string CropTags,
        string Keywords,
        KnowledgeChunkStatus Status,
        DateTime CreatedAtUtc,
        float[]? EmbeddingFloats);
}
