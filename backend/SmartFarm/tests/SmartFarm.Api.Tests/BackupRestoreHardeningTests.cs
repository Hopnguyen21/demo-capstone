using System.IO.Compression;
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using SmartFarm.Application.Common.Exceptions;
using SmartFarm.Application.Features.Platform;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;
using SmartFarm.Infrastructure.Platform;
using Xunit;

namespace SmartFarm.Api.Tests;

public class BackupRestoreHardeningTests
{
    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true };

    private static SmartFarmDbContext CreateInMemoryDb(string name)
    {
        var options = new DbContextOptionsBuilder<SmartFarmDbContext>()
            .UseInMemoryDatabase(name)
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new SmartFarmDbContext(options);
    }

    [Fact]
    public async Task VerifyBackup_MissingRequiredTable_ShouldReturnInvalidWithWarning()
    {
        var dbName = Guid.NewGuid().ToString();
        await using var db = CreateInMemoryDb(dbName);

        var admin = new AppUser
        {
            Id = Guid.NewGuid(),
            Email = $"admin_{Guid.NewGuid():N}@smartfarm.vn",
            FullName = "Admin",
            Role = UserRole.PlatformAdmin,
            Status = AccountStatus.Active
        };
        db.AppUsers.Add(admin);
        await db.SaveChangesAsync();

        var backupDir = Path.Combine(AppContext.BaseDirectory, "TestBackups_" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(backupDir);

        try
        {
            // Build backup payload intentionally omitting "Farms" and "Zones" from data.json
            var payload = new Dictionary<string, object>
            {
                ["Tenants"] = new List<object>(),
                ["AppUsers"] = new List<object> { new { admin.Id, admin.Email, admin.FullName, Role = "PlatformAdmin", Status = "Active" } },
                ["Crops"] = new List<object>(),
                ["CropVarieties"] = new List<object>(),
                ["GrowthProfiles"] = new List<object>(),
                ["GrowthStages"] = new List<object>(),
                ["EnvironmentalRequirements"] = new List<object>()
                // "Farms", "Fields", "Zones" are missing!
            };

            var dataBytes = JsonSerializer.SerializeToUtf8Bytes(payload, JsonOpts);
            var sha256Hex = Convert.ToHexString(SHA256.HashData(dataBytes));

            var tableRecordCounts = new Dictionary<string, int>
            {
                ["Tenants"] = 0,
                ["AppUsers"] = 1,
                ["Crops"] = 0,
                ["CropVarieties"] = 0,
                ["GrowthProfiles"] = 0,
                ["GrowthStages"] = 0,
                ["EnvironmentalRequirements"] = 0
            };

            var manifest = new BackupManifest(
                FormatVersion: "1.0",
                AppVersion: "SmartFarm-1.0",
                CreatedAtUtc: DateTime.UtcNow,
                CreatedByEmail: admin.Email,
                DatabaseProvider: "PostgreSQL",
                PayloadSha256: sha256Hex,
                PayloadSizeBytes: dataBytes.Length,
                TotalRecords: 1,
                TableRecordCounts: tableRecordCounts,
                SupportedScope: "OperationalDomainSnapshot",
                ExcludedTables: new[] { "TelemetryReadings", "RefreshTokens" },
                ExcludedFields: new Dictionary<string, string[]>(),
                SecurityNotice: "Test");

            var manifestBytes = JsonSerializer.SerializeToUtf8Bytes(manifest, JsonOpts);

            var fileName = "Incomplete_Backup.sfbackup";
            var fullPath = Path.Combine(backupDir, fileName);

            await using (var fs = new FileStream(fullPath, FileMode.Create))
            using (var zip = new ZipArchive(fs, ZipArchiveMode.Create))
            {
                var mEntry = zip.CreateEntry("manifest.json");
                await using (var ms = mEntry.Open()) await ms.WriteAsync(manifestBytes);

                var dEntry = zip.CreateEntry("data.json");
                await using (var ds = dEntry.Open()) await ds.WriteAsync(dataBytes);
            }

            var config = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["BackupStorage:Directory"] = backupDir,
                    ["BackupStorage:AllowLiveRestore"] = "true"
                })
                .Build();

            var service = new BackupService(db, config, NullLogger<BackupService>.Instance, TimeProvider.System);

            // 1. Verify should detect missing required tables
            var verifyResult = await service.VerifyBackupAsync(fileName, admin.Id, CancellationToken.None);
            Assert.False(verifyResult.IsValid);
            Assert.Contains("Farms", verifyResult.MissingRequiredTables);
            Assert.Contains("Zones", verifyResult.MissingRequiredTables);
            Assert.Contains("Fields", verifyResult.MissingRequiredTables);

            // 2. Attempting to restore should be rejected before modifying database
            var ex = await Assert.ThrowsAsync<RequestValidationException>(() =>
                service.RestoreBackupAsync(fileName, new RestoreBackupRequest(Confirm: true, OverwriteConfirmation: "CONFIRM_RESTORE"), admin.Id, CancellationToken.None));

            Assert.True(ex.Errors.ContainsKey("backup"));
            Assert.Contains("không vượt qua thẩm định tính toàn vẹn", ex.Errors["backup"][0]);
        }
        finally
        {
            if (Directory.Exists(backupDir)) Directory.Delete(backupDir, true);
        }
    }

    [Fact]
    public async Task VerifyBackup_TamperedPayload_ShouldFailSha256ChecksumVerification()
    {
        var dbName = Guid.NewGuid().ToString();
        await using var db = CreateInMemoryDb(dbName);

        var admin = new AppUser
        {
            Id = Guid.NewGuid(),
            Email = $"admin_{Guid.NewGuid():N}@smartfarm.vn",
            FullName = "Admin",
            Role = UserRole.PlatformAdmin,
            Status = AccountStatus.Active
        };
        db.AppUsers.Add(admin);
        await db.SaveChangesAsync();

        var backupDir = Path.Combine(AppContext.BaseDirectory, "TestBackups_" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(backupDir);

        try
        {
            var config = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["BackupStorage:Directory"] = backupDir,
                    ["BackupStorage:AllowLiveRestore"] = "true"
                })
                .Build();

            var service = new BackupService(db, config, NullLogger<BackupService>.Instance, TimeProvider.System);

            // Create genuine backup first
            var created = await service.CreateBackupAsync(admin.Id, CancellationToken.None);
            var fullPath = Path.Combine(backupDir, created.FileName);

            // Tamper: unpack, modify data.json, repack with mismatched content
            var tempDir = Path.Combine(backupDir, "tamper_temp");
            ZipFile.ExtractToDirectory(fullPath, tempDir);
            File.Delete(fullPath);

            var dataPath = Path.Combine(tempDir, "data.json");
            var content = await File.ReadAllTextAsync(dataPath);
            await File.WriteAllTextAsync(dataPath, content + " /* TAMPERED_PAYLOAD */ ");

            ZipFile.CreateFromDirectory(tempDir, fullPath);
            Directory.Delete(tempDir, true);

            // Verification must detect checksum mismatch
            var verifyResult = await service.VerifyBackupAsync(created.FileName, admin.Id, CancellationToken.None);
            Assert.False(verifyResult.IsValid);
            Assert.False(verifyResult.ChecksumVerified);
            Assert.Contains("không khớp", verifyResult.Message);

            // Restore must be blocked immediately
            var ex = await Assert.ThrowsAsync<RequestValidationException>(() =>
                service.RestoreBackupAsync(created.FileName, new RestoreBackupRequest(Confirm: true, OverwriteConfirmation: "CONFIRM_RESTORE"), admin.Id, CancellationToken.None));
            Assert.True(ex.Errors.ContainsKey("backup"));
            Assert.Contains("không vượt qua thẩm định tính toàn vẹn", ex.Errors["backup"][0]);
        }
        finally
        {
            if (Directory.Exists(backupDir)) Directory.Delete(backupDir, true);
        }
    }

    [Fact]
    public async Task VerifyBackup_PayloadSizeMismatch_ShouldFailVerification()
    {
        var dbName = Guid.NewGuid().ToString();
        await using var db = CreateInMemoryDb(dbName);

        var admin = new AppUser
        {
            Id = Guid.NewGuid(),
            Email = $"admin_{Guid.NewGuid():N}@smartfarm.vn",
            FullName = "Admin",
            Role = UserRole.PlatformAdmin,
            Status = AccountStatus.Active
        };
        db.AppUsers.Add(admin);
        await db.SaveChangesAsync();

        var backupDir = Path.Combine(AppContext.BaseDirectory, "TestBackups_" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(backupDir);

        try
        {
            var config = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["BackupStorage:Directory"] = backupDir
                })
                .Build();

            var service = new BackupService(db, config, NullLogger<BackupService>.Instance, TimeProvider.System);
            var created = await service.CreateBackupAsync(admin.Id, CancellationToken.None);
            var fullPath = Path.Combine(backupDir, created.FileName);

            // Tamper manifest payload size
            var tempDir = Path.Combine(backupDir, "tamper_size");
            ZipFile.ExtractToDirectory(fullPath, tempDir);
            File.Delete(fullPath);

            var manifestPath = Path.Combine(tempDir, "manifest.json");
            var manifestJson = await File.ReadAllTextAsync(manifestPath);
            var manifest = JsonSerializer.Deserialize<BackupManifest>(manifestJson, JsonOpts)!;

            // Inconsistent size declared in manifest
            var alteredManifest = manifest with { PayloadSizeBytes = manifest.PayloadSizeBytes + 999 };
            await File.WriteAllBytesAsync(manifestPath, JsonSerializer.SerializeToUtf8Bytes(alteredManifest, JsonOpts));

            ZipFile.CreateFromDirectory(tempDir, fullPath);
            Directory.Delete(tempDir, true);

            var verifyResult = await service.VerifyBackupAsync(created.FileName, admin.Id, CancellationToken.None);
            Assert.False(verifyResult.IsValid);
            Assert.False(verifyResult.ChecksumVerified);
            Assert.Contains("không khớp với manifest", verifyResult.Warnings[0]);
        }
        finally
        {
            if (Directory.Exists(backupDir)) Directory.Delete(backupDir, true);
        }
    }

    [Fact]
    public async Task VerifyBackup_ExtraTableInPayload_ShouldFailVerificationAndBlockRestore()
    {
        var dbName = Guid.NewGuid().ToString();
        await using var db = CreateInMemoryDb(dbName);
        var admin = new AppUser { Id = Guid.NewGuid(), Email = $"admin_{Guid.NewGuid():N}@smartfarm.vn", FullName = "Admin", Role = UserRole.PlatformAdmin, Status = AccountStatus.Active };
        db.AppUsers.Add(admin);
        await db.SaveChangesAsync();

        var backupDir = Path.Combine(AppContext.BaseDirectory, "TestBackups_" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(backupDir);

        try
        {
            var (payload, counts) = CreateValidEmptyScope(admin);
            payload["UnknownExtraTable"] = new List<object>();

            var fileName = "Extra_Table_Payload.sfbackup";
            CreateBackupZip(backupDir, fileName, admin.Email, payload, counts);

            var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["BackupStorage:Directory"] = backupDir,
                ["BackupStorage:AllowLiveRestore"] = "true"
            }).Build();

            var service = new BackupService(db, config, NullLogger<BackupService>.Instance, TimeProvider.System);

            var verify = await service.VerifyBackupAsync(fileName, admin.Id, CancellationToken.None);
            Assert.False(verify.IsValid);
            Assert.Contains(verify.Warnings, w => w.Contains("nằm ngoài phạm vi"));

            var ex = await Assert.ThrowsAsync<RequestValidationException>(() =>
                service.RestoreBackupAsync(fileName, new RestoreBackupRequest(Confirm: true, OverwriteConfirmation: "CONFIRM_RESTORE"), admin.Id, CancellationToken.None));
            Assert.Contains("không vượt qua thẩm định tính toàn vẹn", ex.Errors["backup"][0]);
        }
        finally
        {
            if (Directory.Exists(backupDir)) Directory.Delete(backupDir, true);
        }
    }

    [Fact]
    public async Task VerifyBackup_MissingTableInManifest_ShouldFailVerification()
    {
        var dbName = Guid.NewGuid().ToString();
        await using var db = CreateInMemoryDb(dbName);
        var admin = new AppUser { Id = Guid.NewGuid(), Email = $"admin_{Guid.NewGuid():N}@smartfarm.vn", FullName = "Admin", Role = UserRole.PlatformAdmin, Status = AccountStatus.Active };
        db.AppUsers.Add(admin);
        await db.SaveChangesAsync();

        var backupDir = Path.Combine(AppContext.BaseDirectory, "TestBackups_" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(backupDir);

        try
        {
            var (payload, counts) = CreateValidEmptyScope(admin);
            counts.Remove("Zones");

            var fileName = "Missing_Manifest_Table.sfbackup";
            CreateBackupZip(backupDir, fileName, admin.Email, payload, counts);

            var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["BackupStorage:Directory"] = backupDir
            }).Build();

            var service = new BackupService(db, config, NullLogger<BackupService>.Instance, TimeProvider.System);
            var verify = await service.VerifyBackupAsync(fileName, admin.Id, CancellationToken.None);

            Assert.False(verify.IsValid);
            Assert.Contains(verify.Warnings, w => w.Contains("Manifest thiếu các bảng bắt buộc"));
        }
        finally
        {
            if (Directory.Exists(backupDir)) Directory.Delete(backupDir, true);
        }
    }

    [Fact]
    public async Task VerifyBackup_ExtraTableInManifest_ShouldFailVerification()
    {
        var dbName = Guid.NewGuid().ToString();
        await using var db = CreateInMemoryDb(dbName);
        var admin = new AppUser { Id = Guid.NewGuid(), Email = $"admin_{Guid.NewGuid():N}@smartfarm.vn", FullName = "Admin", Role = UserRole.PlatformAdmin, Status = AccountStatus.Active };
        db.AppUsers.Add(admin);
        await db.SaveChangesAsync();

        var backupDir = Path.Combine(AppContext.BaseDirectory, "TestBackups_" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(backupDir);

        try
        {
            var (payload, counts) = CreateValidEmptyScope(admin);
            counts["ExtraManifestTable"] = 0;

            var fileName = "Extra_Manifest_Table.sfbackup";
            CreateBackupZip(backupDir, fileName, admin.Email, payload, counts);

            var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["BackupStorage:Directory"] = backupDir
            }).Build();

            var service = new BackupService(db, config, NullLogger<BackupService>.Instance, TimeProvider.System);
            var verify = await service.VerifyBackupAsync(fileName, admin.Id, CancellationToken.None);

            Assert.False(verify.IsValid);
            Assert.Contains(verify.Warnings, w => w.Contains("Manifest chứa các bảng không thuộc phạm vi"));
        }
        finally
        {
            if (Directory.Exists(backupDir)) Directory.Delete(backupDir, true);
        }
    }

    [Fact]
    public async Task VerifyBackup_TableRecordCountMismatch_ShouldFailVerification()
    {
        var dbName = Guid.NewGuid().ToString();
        await using var db = CreateInMemoryDb(dbName);
        var admin = new AppUser { Id = Guid.NewGuid(), Email = $"admin_{Guid.NewGuid():N}@smartfarm.vn", FullName = "Admin", Role = UserRole.PlatformAdmin, Status = AccountStatus.Active };
        db.AppUsers.Add(admin);
        await db.SaveChangesAsync();

        var backupDir = Path.Combine(AppContext.BaseDirectory, "TestBackups_" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(backupDir);

        try
        {
            var (payload, counts) = CreateValidEmptyScope(admin);
            counts["Crops"] = 15; // Payload actually has 0

            var fileName = "Count_Mismatch.sfbackup";
            CreateBackupZip(backupDir, fileName, admin.Email, payload, counts, overrideTotalRecords: counts.Values.Sum());

            var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["BackupStorage:Directory"] = backupDir
            }).Build();

            var service = new BackupService(db, config, NullLogger<BackupService>.Instance, TimeProvider.System);
            var verify = await service.VerifyBackupAsync(fileName, admin.Id, CancellationToken.None);

            Assert.False(verify.IsValid);
            Assert.Contains(verify.Warnings, w => w.Contains("Crops") && w.Contains("khác manifest"));
        }
        finally
        {
            if (Directory.Exists(backupDir)) Directory.Delete(backupDir, true);
        }
    }

    [Fact]
    public async Task VerifyBackup_NonArrayTableInPayload_ShouldFailVerification()
    {
        var dbName = Guid.NewGuid().ToString();
        await using var db = CreateInMemoryDb(dbName);
        var admin = new AppUser { Id = Guid.NewGuid(), Email = $"admin_{Guid.NewGuid():N}@smartfarm.vn", FullName = "Admin", Role = UserRole.PlatformAdmin, Status = AccountStatus.Active };
        db.AppUsers.Add(admin);
        await db.SaveChangesAsync();

        var backupDir = Path.Combine(AppContext.BaseDirectory, "TestBackups_" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(backupDir);

        try
        {
            var (payload, counts) = CreateValidEmptyScope(admin);
            payload["Crops"] = "INVALID_STRING_VALUE_NOT_ARRAY";

            var fileName = "Non_Array_Table.sfbackup";
            CreateBackupZip(backupDir, fileName, admin.Email, payload, counts);

            var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["BackupStorage:Directory"] = backupDir,
                ["BackupStorage:AllowLiveRestore"] = "true"
            }).Build();

            var service = new BackupService(db, config, NullLogger<BackupService>.Instance, TimeProvider.System);
            var verify = await service.VerifyBackupAsync(fileName, admin.Id, CancellationToken.None);

            Assert.False(verify.IsValid);
            Assert.Contains(verify.Warnings, w => w.Contains("Crops") && w.Contains("không phải là một JSON Array"));

            var ex = await Assert.ThrowsAsync<RequestValidationException>(() =>
                service.RestoreBackupAsync(fileName, new RestoreBackupRequest(Confirm: true, OverwriteConfirmation: "CONFIRM_RESTORE"), admin.Id, CancellationToken.None));
            Assert.Contains("không vượt qua thẩm định tính toàn vẹn", ex.Errors["backup"][0]);
        }
        finally
        {
            if (Directory.Exists(backupDir)) Directory.Delete(backupDir, true);
        }
    }

    [Fact]
    public async Task RestoreBackup_WhenPreRestoreFails_ShouldAbortImmediatelyAndKeepDatabaseUntouched()
    {
        var dbName = Guid.NewGuid().ToString();
        await using var db = CreateInMemoryDb(dbName);
        var admin = new AppUser { Id = Guid.NewGuid(), Email = $"admin_{Guid.NewGuid():N}@smartfarm.vn", FullName = "Admin", Role = UserRole.PlatformAdmin, Status = AccountStatus.Active };
        db.AppUsers.Add(admin);

        var existingCrop = new Crop { Id = Guid.NewGuid(), Name = "Tomato Before Restore", NormalizedName = "TOMATO_PRE" };
        db.Crops.Add(existingCrop);
        await db.SaveChangesAsync();

        var backupDir = Path.Combine(AppContext.BaseDirectory, "TestBackups_" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(backupDir);

        try
        {
            var (payload, counts) = CreateValidEmptyScope(admin);
            var fileName = "Valid_Backup_For_PreRestore_Test.sfbackup";
            CreateBackupZip(backupDir, fileName, admin.Email, payload, counts);

            var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["BackupStorage:Directory"] = backupDir,
                ["BackupStorage:AllowLiveRestore"] = "true"
            }).Build();

            var failingService = new FailingPreRestoreBackupService(db, config);

            var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
                failingService.RestoreBackupAsync(fileName, new RestoreBackupRequest(Confirm: true, OverwriteConfirmation: "CONFIRM_RESTORE"), admin.Id, CancellationToken.None));

            Assert.Contains("pre-restore backup", ex.Message);

            // Verify original crop is completely untouched
            var cropInDb = await db.Crops.AsNoTracking().FirstOrDefaultAsync(c => c.Id == existingCrop.Id);
            Assert.NotNull(cropInDb);
            Assert.Equal("Tomato Before Restore", cropInDb.Name);
        }
        finally
        {
            if (Directory.Exists(backupDir)) Directory.Delete(backupDir, true);
        }
    }

    [Fact]
    public async Task RestoreBackup_WhenMidProcessFails_ThrowsInvalidOperationException()
    {
        var dbName = Guid.NewGuid().ToString();
        await using var db = CreateInMemoryDb(dbName);
        var admin = new AppUser { Id = Guid.NewGuid(), Email = $"admin_{Guid.NewGuid():N}@smartfarm.vn", FullName = "Admin", Role = UserRole.PlatformAdmin, Status = AccountStatus.Active };
        db.AppUsers.Add(admin);
        await db.SaveChangesAsync();

        var backupDir = Path.Combine(AppContext.BaseDirectory, "TestBackups_" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(backupDir);

        try
        {
            var (payload, counts) = CreateValidEmptyScope(admin);
            var fileName = "Valid_Backup_For_MidRestore_Test.sfbackup";
            CreateBackupZip(backupDir, fileName, admin.Email, payload, counts);

            var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["BackupStorage:Directory"] = backupDir,
                ["BackupStorage:AllowLiveRestore"] = "true"
            }).Build();

            var failingService = new FailingMidRestoreBackupService(db, config);

            var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
                failingService.RestoreBackupAsync(fileName, new RestoreBackupRequest(Confirm: true, OverwriteConfirmation: "CONFIRM_RESTORE"), admin.Id, CancellationToken.None));

            Assert.Contains("Lỗi trong quá trình khôi phục cơ sở dữ liệu", ex.Message);
        }
        finally
        {
            if (Directory.Exists(backupDir)) Directory.Delete(backupDir, true);
        }
    }

    [Fact]
    public async Task RestoreBackup_RejectedInvalidBackup_EnsuresDatabaseIsUntouched()
    {
        var dbName = Guid.NewGuid().ToString();
        await using var db = CreateInMemoryDb(dbName);
        var admin = new AppUser { Id = Guid.NewGuid(), Email = $"admin_{Guid.NewGuid():N}@smartfarm.vn", FullName = "Admin", Role = UserRole.PlatformAdmin, Status = AccountStatus.Active };
        db.AppUsers.Add(admin);

        var existingCrop = new Crop { Id = Guid.NewGuid(), Name = "Protected Crop", NormalizedName = "PROTECTED_01" };
        db.Crops.Add(existingCrop);
        await db.SaveChangesAsync();

        var backupDir = Path.Combine(AppContext.BaseDirectory, "TestBackups_" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(backupDir);

        try
        {
            var (payload, counts) = CreateValidEmptyScope(admin);
            counts.Remove("Tenants"); // Invalid manifest

            var fileName = "Invalid_Scope.sfbackup";
            CreateBackupZip(backupDir, fileName, admin.Email, payload, counts);

            var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["BackupStorage:Directory"] = backupDir,
                ["BackupStorage:AllowLiveRestore"] = "true"
            }).Build();

            var service = new BackupService(db, config, NullLogger<BackupService>.Instance, TimeProvider.System);

            await Assert.ThrowsAsync<RequestValidationException>(() =>
                service.RestoreBackupAsync(fileName, new RestoreBackupRequest(Confirm: true, OverwriteConfirmation: "CONFIRM_RESTORE"), admin.Id, CancellationToken.None));

            // Verify original crop is still in database untouched
            var cropInDb = await db.Crops.AsNoTracking().FirstOrDefaultAsync(c => c.Id == existingCrop.Id);
            Assert.NotNull(cropInDb);
            Assert.Equal("Protected Crop", cropInDb.Name);
        }
        finally
        {
            if (Directory.Exists(backupDir)) Directory.Delete(backupDir, true);
        }
    }

    private static (Dictionary<string, object> Payload, Dictionary<string, int> Counts) CreateValidEmptyScope(AppUser admin)
    {
        var payload = new Dictionary<string, object>();
        var counts = new Dictionary<string, int>();
        foreach (var table in BackupService.SupportedScopeTables)
        {
            if (table == "AppUsers")
            {
                payload[table] = new List<object>
                {
                    new { admin.Id, admin.Email, admin.FullName, Role = admin.Role.ToString(), Status = admin.Status.ToString() }
                };
                counts[table] = 1;
            }
            else
            {
                payload[table] = new List<object>();
                counts[table] = 0;
            }
        }
        return (payload, counts);
    }

    private static string CreateBackupZip(
        string directory,
        string fileName,
        string adminEmail,
        Dictionary<string, object> payload,
        Dictionary<string, int> tableRecordCounts,
        int? overrideTotalRecords = null)
    {
        var dataBytes = JsonSerializer.SerializeToUtf8Bytes(payload, JsonOpts);
        var sha256Hex = Convert.ToHexString(SHA256.HashData(dataBytes));

        var totalRecords = overrideTotalRecords ?? tableRecordCounts.Values.Sum();
        var manifest = new BackupManifest(
            FormatVersion: "1.0",
            AppVersion: "SmartFarm-1.0",
            CreatedAtUtc: DateTime.UtcNow,
            CreatedByEmail: adminEmail,
            DatabaseProvider: "PostgreSQL",
            PayloadSha256: sha256Hex,
            PayloadSizeBytes: dataBytes.Length,
            TotalRecords: totalRecords,
            TableRecordCounts: tableRecordCounts,
            SupportedScope: "OperationalDomainSnapshot",
            ExcludedTables: new[] { "TelemetryReadings", "RefreshTokens" },
            ExcludedFields: new Dictionary<string, string[]>(),
            SecurityNotice: "Test");

        var manifestBytes = JsonSerializer.SerializeToUtf8Bytes(manifest, JsonOpts);
        var fullPath = Path.Combine(directory, fileName);

        using var fs = new FileStream(fullPath, FileMode.Create);
        using var zip = new ZipArchive(fs, ZipArchiveMode.Create);
        var mEntry = zip.CreateEntry("manifest.json");
        using (var ms = mEntry.Open()) ms.Write(manifestBytes);

        var dEntry = zip.CreateEntry("data.json");
        using (var ds = dEntry.Open()) ds.Write(dataBytes);

        return fullPath;
    }

    private sealed class FailingPreRestoreBackupService : BackupService
    {
        public FailingPreRestoreBackupService(SmartFarmDbContext db, IConfiguration config)
            : base(db, config, NullLogger<BackupService>.Instance, TimeProvider.System) { }

        protected override Task<CreateBackupResult> CreateBackupInternalAsync(AppUser admin, bool isPreRestoreSnapshot, CancellationToken ct)
        {
            if (isPreRestoreSnapshot)
            {
                throw new IOException("Simulated disk write failure during pre-restore snapshot");
            }
            return base.CreateBackupInternalAsync(admin, isPreRestoreSnapshot, ct);
        }
    }

    private sealed class FailingMidRestoreBackupService : BackupService
    {
        public FailingMidRestoreBackupService(SmartFarmDbContext db, IConfiguration config)
            : base(db, config, NullLogger<BackupService>.Instance, TimeProvider.System) { }

        protected override Task<int> ApplyRestorationPayloadAsync(JsonElement tables, Guid currentAdminUserId, List<string> restoredTables, CancellationToken ct)
        {
            throw new InvalidOperationException("Simulated mid-transaction failure during entity restoration");
        }
    }
}

