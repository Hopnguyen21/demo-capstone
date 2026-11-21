namespace SmartFarm.Application.Features.Platform;

public sealed record CloudinaryConfigView(
    string CloudName,
    string ApiKey,
    string ApiSecretMasked,
    bool IsConfigured);

public sealed record UpdateCloudinaryConfigCommand(
    string CloudName,
    string ApiKey,
    string? ApiSecret);

public sealed record CloudinaryTestResult(
    bool Success,
    string Message,
    string? CloudName);

public sealed record CloudinaryUploadResult(
    string PublicId,
    string Url,
    string SecureUrl,
    string Format,
    int Width,
    int Height,
    long Bytes,
    string ResourceType,
    DateTime CreatedAtUtc);

public interface ICloudinaryService
{
    Task<CloudinaryConfigView> GetConfigAsync(CancellationToken ct);
    Task<CloudinaryConfigView> UpdateConfigAsync(UpdateCloudinaryConfigCommand command, Guid updatedByUserId, CancellationToken ct);
    Task<CloudinaryTestResult> TestConnectionAsync(CancellationToken ct);
    Task<CloudinaryUploadResult> UploadAsync(Stream fileStream, string fileName, string contentType, string? folder, CancellationToken ct);
    Task<CloudinaryUploadResult> UploadBase64Async(string base64Data, string? fileName, string? folder, CancellationToken ct);
}
