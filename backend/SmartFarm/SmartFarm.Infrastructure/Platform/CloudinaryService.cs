using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using SmartFarm.Application.Common.Exceptions;
using SmartFarm.Application.Features.Platform;
using SmartFarm.Domain.Entities;
using SmartFarm.Infrastructure.Persistence;

namespace SmartFarm.Infrastructure.Platform;

public sealed class CloudinaryService(
    SmartFarmDbContext db,
    IConfiguration configuration,
    HttpClient httpClient,
    ILogger<CloudinaryService> logger) : ICloudinaryService
{
    private string SigningKey => configuration["Jwt:SigningKey"] ?? "smartfarm-default-super-secret-jwt-signing-key-minimum-32-chars";

    private async Task<(string CloudName, string ApiKey, string ApiSecret)> GetCredentialsAsync(CancellationToken ct)
    {
        var settings = await db.PlatformSettings.AsNoTracking()
            .Where(x => x.Key == PlatformSettingKeys.CloudinaryCloudName
                     || x.Key == PlatformSettingKeys.CloudinaryApiKey
                     || x.Key == PlatformSettingKeys.CloudinaryApiSecret)
            .ToListAsync(ct);

        var cloudName = settings.FirstOrDefault(x => x.Key == PlatformSettingKeys.CloudinaryCloudName)?.Value?.Trim() ?? "";
        var apiKey = settings.FirstOrDefault(x => x.Key == PlatformSettingKeys.CloudinaryApiKey)?.Value?.Trim() ?? "";
        var secretStored = settings.FirstOrDefault(x => x.Key == PlatformSettingKeys.CloudinaryApiSecret)?.Value?.Trim() ?? "";

        var apiSecret = SecretProtector.IsProtected(secretStored)
            ? SecretProtector.TryUnprotect(secretStored, SigningKey) ?? ""
            : secretStored;

        if (string.IsNullOrWhiteSpace(cloudName) || string.IsNullOrWhiteSpace(apiKey) || string.IsNullOrWhiteSpace(apiSecret))
        {
            throw new RequestValidationException("Cloudinary", "Dịch vụ lưu trữ Cloudinary chưa được cấu hình. Quản trị viên vui lòng vào phần Cài đặt Platform để nhập Cloud Name, API Key và API Secret.");
        }

        return (cloudName, apiKey, apiSecret);
    }

    public async Task<CloudinaryConfigView> GetConfigAsync(CancellationToken ct)
    {
        var settings = await db.PlatformSettings.AsNoTracking()
            .Where(x => x.Key == PlatformSettingKeys.CloudinaryCloudName
                     || x.Key == PlatformSettingKeys.CloudinaryApiKey
                     || x.Key == PlatformSettingKeys.CloudinaryApiSecret)
            .ToListAsync(ct);

        var cloudName = settings.FirstOrDefault(x => x.Key == PlatformSettingKeys.CloudinaryCloudName)?.Value?.Trim() ?? "";
        var apiKey = settings.FirstOrDefault(x => x.Key == PlatformSettingKeys.CloudinaryApiKey)?.Value?.Trim() ?? "";
        var secretStored = settings.FirstOrDefault(x => x.Key == PlatformSettingKeys.CloudinaryApiSecret)?.Value?.Trim() ?? "";

        var secretPlain = SecretProtector.IsProtected(secretStored)
            ? SecretProtector.TryUnprotect(secretStored, SigningKey) ?? ""
            : secretStored;

        var isConfigured = !string.IsNullOrWhiteSpace(cloudName)
                        && !string.IsNullOrWhiteSpace(apiKey)
                        && !string.IsNullOrWhiteSpace(secretPlain);

        return new CloudinaryConfigView(
            CloudName: cloudName,
            ApiKey: apiKey,
            ApiSecretMasked: string.IsNullOrWhiteSpace(secretPlain) ? "" : SecretProtector.Mask(secretPlain),
            IsConfigured: isConfigured);
    }

    public async Task<CloudinaryConfigView> UpdateConfigAsync(UpdateCloudinaryConfigCommand command, Guid updatedByUserId, CancellationToken ct)
    {
        var actor = await db.AppUsers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == updatedByUserId, ct);

        // Cloud Name
        var cloudName = (command.CloudName ?? "").Trim();
        var cloudRow = await db.PlatformSettings.FirstOrDefaultAsync(x => x.Key == PlatformSettingKeys.CloudinaryCloudName, ct);
        if (cloudRow == null)
        {
            db.PlatformSettings.Add(new PlatformSetting
            {
                Key = PlatformSettingKeys.CloudinaryCloudName,
                Value = cloudName,
                Group = "Media",
                DataType = "String",
                Description = "Cloudinary Cloud Name",
                IsSecret = false,
                UpdatedByUserId = updatedByUserId,
                UpdatedAtUtc = DateTime.UtcNow
            });
        }
        else
        {
            cloudRow.Value = cloudName;
            cloudRow.UpdatedByUserId = updatedByUserId;
            cloudRow.UpdatedAtUtc = DateTime.UtcNow;
        }

        // API Key
        var apiKey = (command.ApiKey ?? "").Trim();
        var keyRow = await db.PlatformSettings.FirstOrDefaultAsync(x => x.Key == PlatformSettingKeys.CloudinaryApiKey, ct);
        if (keyRow == null)
        {
            db.PlatformSettings.Add(new PlatformSetting
            {
                Key = PlatformSettingKeys.CloudinaryApiKey,
                Value = apiKey,
                Group = "Media",
                DataType = "String",
                Description = "Cloudinary API Key",
                IsSecret = false,
                UpdatedByUserId = updatedByUserId,
                UpdatedAtUtc = DateTime.UtcNow
            });
        }
        else
        {
            keyRow.Value = apiKey;
            keyRow.UpdatedByUserId = updatedByUserId;
            keyRow.UpdatedAtUtc = DateTime.UtcNow;
        }

        // API Secret
        var rawSecret = (command.ApiSecret ?? "").Trim();
        if (!string.IsNullOrEmpty(rawSecret) && !SecretProtector.LooksMasked(rawSecret))
        {
            if (rawSecret.Length < 10 || rawSecret.Any(char.IsWhiteSpace))
                throw new RequestValidationException("apiSecret", "Cloudinary API Secret không hợp lệ (tối thiểu 10 ký tự, không chứa khoảng trắng).");

            var protectedSecret = SecretProtector.Protect(rawSecret, SigningKey);
            var secretRow = await db.PlatformSettings.FirstOrDefaultAsync(x => x.Key == PlatformSettingKeys.CloudinaryApiSecret, ct);
            if (secretRow == null)
            {
                db.PlatformSettings.Add(new PlatformSetting
                {
                    Key = PlatformSettingKeys.CloudinaryApiSecret,
                    Value = protectedSecret,
                    Group = "Media",
                    DataType = "String",
                    Description = "Cloudinary API Secret",
                    IsSecret = true,
                    UpdatedByUserId = updatedByUserId,
                    UpdatedAtUtc = DateTime.UtcNow
                });
            }
            else
            {
                secretRow.Value = protectedSecret;
                secretRow.IsSecret = true;
                secretRow.UpdatedByUserId = updatedByUserId;
                secretRow.UpdatedAtUtc = DateTime.UtcNow;
            }
        }

        db.AuditLogs.Add(new AuditLog
        {
            ActorUserId = updatedByUserId,
            ActorName = actor?.FullName ?? "Admin",
            ActorRole = actor?.Role.ToString() ?? "PlatformAdmin",
            Action = "CLOUDINARY_CONFIG_UPDATED",
            EntityName = "PlatformSetting",
            EntityId = "Cloudinary",
            Details = "Đã cập nhật thông tin cấu hình lưu trữ Cloudinary.",
            CreatedAtUtc = DateTime.UtcNow
        });

        await db.SaveChangesAsync(ct);
        return await GetConfigAsync(ct);
    }

    public async Task<CloudinaryTestResult> TestConnectionAsync(CancellationToken ct)
    {
        var (cloudName, apiKey, apiSecret) = await GetCredentialsAsync(ct);

        try
        {
            // Call Cloudinary Admin API to test authentication
            var testUrl = $"https://api.cloudinary.com/v1_1/{cloudName}/resources/image?max_results=1";
            using var req = new HttpRequestMessage(HttpMethod.Get, testUrl);
            var authBytes = Encoding.ASCII.GetBytes($"{apiKey}:{apiSecret}");
            req.Headers.Authorization = new AuthenticationHeaderValue("Basic", Convert.ToBase64String(authBytes));

            var response = await httpClient.SendAsync(req, ct);
            var content = await response.Content.ReadAsStringAsync(ct);

            if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
            {
                return new CloudinaryTestResult(false, "Cloudinary trả về 401 Unauthorized: API Key hoặc API Secret không chính xác.", cloudName);
            }

            if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                return new CloudinaryTestResult(false, $"Cloud Name '{cloudName}' không tồn tại hoặc sai URL.", cloudName);
            }

            if (response.IsSuccessStatusCode)
            {
                return new CloudinaryTestResult(true, "Kết nối Cloudinary thành công! Thông tin Cloud Name và API Secret hoàn toàn chính xác.", cloudName);
            }

            return new CloudinaryTestResult(false, $"Cloudinary phản hồi: {response.StatusCode} - {content}", cloudName);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Lỗi kiểm tra kết nối Cloudinary");
            return new CloudinaryTestResult(false, $"Không kết nối được tới máy chủ Cloudinary: {ex.Message}", cloudName);
        }
    }

    public async Task<CloudinaryUploadResult> UploadAsync(Stream fileStream, string fileName, string contentType, string? folder, CancellationToken ct)
    {
        var (cloudName, apiKey, apiSecret) = await GetCredentialsAsync(ct);

        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString();
        var targetFolder = !string.IsNullOrWhiteSpace(folder) ? folder.Trim() : "smartfarm";

        // Signature: SHA-1 of alphabetical params: folder={folder}&timestamp={timestamp}{api_secret}
        var stringToSign = $"folder={targetFolder}&timestamp={timestamp}{apiSecret}";
        var signature = ComputeSha1Hex(stringToSign);

        using var form = new MultipartFormDataContent();
        var streamContent = new StreamContent(fileStream);
        if (!string.IsNullOrWhiteSpace(contentType))
        {
            streamContent.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        }

        form.Add(streamContent, "file", fileName);
        form.Add(new StringContent(apiKey), "api_key");
        form.Add(new StringContent(timestamp), "timestamp");
        form.Add(new StringContent(signature), "signature");
        form.Add(new StringContent(targetFolder), "folder");

        var uploadUrl = $"https://api.cloudinary.com/v1_1/{cloudName}/auto/upload";
        using var req = new HttpRequestMessage(HttpMethod.Post, uploadUrl) { Content = form };

        var response = await httpClient.SendAsync(req, ct);
        var responseJson = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
        {
            logger.LogError("Lỗi upload Cloudinary: {Status} {Response}", response.StatusCode, responseJson);
            throw new RequestValidationException("Cloudinary", $"Upload lên Cloudinary thất bại ({response.StatusCode}): {responseJson}");
        }

        using var doc = JsonDocument.Parse(responseJson);
        var root = doc.RootElement;

        var publicId = root.GetProperty("public_id").GetString() ?? "";
        var url = root.TryGetProperty("url", out var u) ? u.GetString() ?? "" : "";
        var secureUrl = root.TryGetProperty("secure_url", out var su) ? su.GetString() ?? url : url;
        var format = root.TryGetProperty("format", out var f) ? f.GetString() ?? "" : "";
        var width = root.TryGetProperty("width", out var w) ? w.GetInt32() : 0;
        var height = root.TryGetProperty("height", out var h) ? h.GetInt32() : 0;
        var bytes = root.TryGetProperty("bytes", out var b) ? b.GetInt64() : 0;
        var resourceType = root.TryGetProperty("resource_type", out var rt) ? rt.GetString() ?? "image" : "image";
        var createdAtStr = root.TryGetProperty("created_at", out var ca) ? ca.GetString() : null;
        var createdAt = DateTime.TryParse(createdAtStr, out var parsedDate) ? parsedDate.ToUniversalTime() : DateTime.UtcNow;

        return new CloudinaryUploadResult(
            PublicId: publicId,
            Url: url,
            SecureUrl: secureUrl,
            Format: format,
            Width: width,
            Height: height,
            Bytes: bytes,
            ResourceType: resourceType,
            CreatedAtUtc: createdAt);
    }

    public async Task<CloudinaryUploadResult> UploadBase64Async(string base64Data, string? fileName, string? folder, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(base64Data))
            throw new RequestValidationException("base64Data", "Dữ liệu hình ảnh không được để trống.");

        var cleanData = base64Data;
        var contentType = "image/png";

        // If data URI format: data:image/jpeg;base64,...
        if (base64Data.Contains(','))
        {
            var parts = base64Data.Split(',', 2);
            var header = parts[0];
            cleanData = parts[1];

            if (header.Contains("image/jpeg") || header.Contains("image/jpg")) contentType = "image/jpeg";
            else if (header.Contains("image/webp")) contentType = "image/webp";
            else if (header.Contains("image/png")) contentType = "image/png";
        }

        var bytes = Convert.FromBase64String(cleanData);
        using var stream = new MemoryStream(bytes);
        var actualFileName = !string.IsNullOrWhiteSpace(fileName) ? fileName : $"upload_{Guid.NewGuid():N}.png";

        return await UploadAsync(stream, actualFileName, contentType, folder, ct);
    }

    private static string ComputeSha1Hex(string input)
    {
        var bytes = Encoding.UTF8.GetBytes(input);
        var hash = SHA1.HashData(bytes);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }
}
