namespace SmartFarm.Application.Features.Platform;

public sealed record BackupManifest(
    string FormatVersion,
    string AppVersion,
    DateTime CreatedAtUtc,
    string CreatedByEmail,
    string DatabaseProvider,
    string PayloadSha256,
    long PayloadSizeBytes,
    int TotalRecords,
    IReadOnlyDictionary<string, int> TableRecordCounts,
    string SupportedScope,
    IReadOnlyList<string> ExcludedTables,
    IReadOnlyDictionary<string, string[]> ExcludedFields,
    string SecurityNotice);

public sealed record BackupMetadataView(
    string FileName,
    long SizeBytes,
    DateTime CreatedAtUtc,
    int TotalRecords,
    string ChecksumSha256,
    string CreatedByEmail,
    string FormatVersion,
    string SupportedScope,
    IReadOnlyDictionary<string, int> TableRecordCounts);

public sealed record CreateBackupResult(
    string FileName,
    long SizeBytes,
    DateTime CreatedAtUtc,
    int TotalRecords,
    string ChecksumSha256,
    IReadOnlyDictionary<string, int> TableRecordCounts);

public sealed record VerifyBackupResult(
    string FileName,
    bool IsValid,
    string ChecksumSha256,
    bool ChecksumVerified,
    string FormatVersion,
    int TotalRecords,
    IReadOnlyDictionary<string, int> TableRecordCounts,
    IReadOnlyList<string> MissingRequiredTables,
    IReadOnlyList<string> Warnings,
    string Message,
    DateTime VerifiedAtUtc);

public sealed record RestoreBackupRequest(
    bool Confirm,
    string? OverwriteConfirmation,
    bool CreatePreRestoreSnapshot = true);

public sealed record RestoreBackupResult(
    string FileName,
    bool Success,
    bool IsDryRunOnly,
    string Message,
    DateTime RestoredAtUtc,
    int RestoredRecords,
    IReadOnlyList<string> RestoredTables,
    string? PreRestoreBackupFileName,
    string ChecksumSha256);

public sealed record BackupSystemStatusView(
    bool AllowLiveRestore,
    int RetentionDays,
    int MaxBackups,
    long MaxBackupFileSizeBytes,
    long MaxUncompressedSizeBytes,
    string StorageDirectory,
    int TotalBackupsAvailable);
