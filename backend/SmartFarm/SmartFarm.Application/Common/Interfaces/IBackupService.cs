using SmartFarm.Application.Features.Platform;

namespace SmartFarm.Application.Common.Interfaces;

public interface IBackupService
{
    Task<IReadOnlyList<BackupMetadataView>> ListBackupsAsync(CancellationToken ct);
    Task<BackupSystemStatusView> GetSystemStatusAsync(CancellationToken ct);
    Task<CreateBackupResult> CreateBackupAsync(Guid adminUserId, CancellationToken ct);
    Task<(byte[] Content, string ContentType, string FileName)> DownloadBackupAsync(string fileName, Guid adminUserId, CancellationToken ct);
    Task<VerifyBackupResult> VerifyBackupAsync(string fileName, Guid adminUserId, CancellationToken ct);
    Task<RestoreBackupResult> RestoreBackupAsync(string fileName, RestoreBackupRequest request, Guid adminUserId, CancellationToken ct);
}
