using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using SmartFarm.Infrastructure.Ai;
using SmartFarm.Infrastructure.Ai.Knowledge;
using SmartFarm.Infrastructure.Persistence;

namespace SmartFarm.Infrastructure.Platform;

/// <summary>
/// Khoá Gemini CHỈ lấy từ Cài đặt nền tảng (platform_settings, Admin nhập trên web); khoá trong cấu hình/user-secrets/biến môi trường bị
/// bỏ qua (xem DependencyInjection). Chưa nhập khoá nào thì AI báo không khả dụng. Model do Admin nhập được ưu tiên, để trống thì dùng
/// model mặc định trong cấu hình. Áp thẳng vào các đối tượng options dùng chung nên có hiệu lực ngay, không cần khởi động lại.
/// </summary>
public static class GeminiRuntimeSettings
{
    private sealed record Base(string Model);
    private static readonly object Gate = new();
    // Model mặc định từ cấu hình của TỪNG đối tượng options (chụp ở lần áp đầu tiên) để khi Admin xoá model thì quay về đúng giá trị đó.
    private static readonly System.Runtime.CompilerServices.ConditionalWeakTable<GeminiOptions, Base> Originals = new();

    public const string DefaultAppsettingsSigningKey = "replace-with-a-random-secret-at-least-32-characters";

    public static string? UnprotectWithFallback(string? stored, string signingKey, out bool usedFallbackKey)
    {
        usedFallbackKey = false;
        if (string.IsNullOrWhiteSpace(stored)) return null;
        if (!SecretProtector.IsProtected(stored))
            return SecretProtector.LooksMasked(stored) ? null : stored.Trim();

        var plain = SecretProtector.TryUnprotect(stored, signingKey);
        if (plain is not null) return plain;

        if (!string.Equals(signingKey, DefaultAppsettingsSigningKey, StringComparison.Ordinal))
        {
            plain = SecretProtector.TryUnprotect(stored, DefaultAppsettingsSigningKey);
            if (plain is not null)
            {
                usedFallbackKey = true;
                return plain;
            }
        }
        return null;
    }

    /// <summary>Danh sách khoá đã lưu (mảng JSON mã hoá); rỗng khi chưa có hoặc không giải mã được.</summary>
    public static List<string> ReadKeyList(string? stored, string signingKey)
    {
        if (string.IsNullOrWhiteSpace(stored)) return [];
        var json = SecretProtector.IsProtected(stored)
            ? UnprotectWithFallback(stored, signingKey, out _)
            : stored.Trim();
        if (string.IsNullOrWhiteSpace(json)) return [];
        try
        {
            if (json.StartsWith("[", StringComparison.Ordinal))
                return System.Text.Json.JsonSerializer.Deserialize<List<string>>(json)?.Where(k => !string.IsNullOrWhiteSpace(k) && !SecretProtector.LooksMasked(k)).ToList() ?? [];
            return json.Split([',', ';', '\n', '\r'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Where(k => !string.IsNullOrWhiteSpace(k) && !SecretProtector.LooksMasked(k)).ToList();
        }
        catch (System.Text.Json.JsonException) { return []; }
    }

    public static async Task ApplyAsync(SmartFarmDbContext db, string signingKey, GeminiOptions gemini, GeminiEmbeddingOptions? embedding, ILogger? log, CancellationToken ct)
    {
        var rows = await db.PlatformSettings
            .Where(x => x.Key == PlatformSettingKeys.GeminiApiKey || x.Key == PlatformSettingKeys.GeminiApiKeys || x.Key == PlatformSettingKeys.GeminiModel).ToListAsync(ct);
        var needsSave = false;
        string? dbKey = null;
        var keyRow = rows.FirstOrDefault(x => x.Key == PlatformSettingKeys.GeminiApiKey);
        if (keyRow is not null && !string.IsNullOrWhiteSpace(keyRow.Value))
        {
            if (SecretProtector.IsProtected(keyRow.Value))
            {
                dbKey = UnprotectWithFallback(keyRow.Value, signingKey, out var usedFallback);
                if (dbKey is null)
                {
                    log?.LogWarning("Không giải mã được khoá Gemini trong cài đặt (Jwt:SigningKey đã đổi?). Admin cần nhập lại hoặc đặt biến môi trường GEMINI_API_KEY.");
                }
                else if (usedFallback && signingKey.Length >= 32)
                {
                    keyRow.Value = SecretProtector.Protect(dbKey, signingKey);
                    keyRow.IsSecret = true;
                    needsSave = true;
                }
            }
            else if (!SecretProtector.LooksMasked(keyRow.Value))
            {
                // Giá trị cũ lưu dạng thô từ trước khi có mã hoá: dùng luôn và mã hoá lại.
                dbKey = keyRow.Value.Trim();
                if (signingKey.Length >= 32)
                {
                    keyRow.Value = SecretProtector.Protect(dbKey, signingKey);
                    keyRow.IsSecret = true;
                    needsSave = true;
                }
            }
        }
        var keysRow = rows.FirstOrDefault(x => x.Key == PlatformSettingKeys.GeminiApiKeys);
        var dbKeys = ReadKeyList(keysRow?.Value, signingKey);
        if (keysRow is not null && !string.IsNullOrWhiteSpace(keysRow.Value) && dbKeys.Count > 0 && signingKey.Length >= 32)
        {
            var directUnprotect = SecretProtector.IsProtected(keysRow.Value) ? SecretProtector.TryUnprotect(keysRow.Value, signingKey) : null;
            if (directUnprotect is null)
            {
                keysRow.Value = SecretProtector.Protect(System.Text.Json.JsonSerializer.Serialize(dbKeys), signingKey);
                keysRow.IsSecret = true;
                needsSave = true;
            }
        }
        if (needsSave) await db.SaveChangesAsync(ct);
        var dbModel = rows.FirstOrDefault(x => x.Key == PlatformSettingKeys.GeminiModel)?.Value?.Trim();

        lock (Gate)
        {
            if (!Originals.TryGetValue(gemini, out var original))
            {
                original = new Base(gemini.Model);
                Originals.Add(gemini, original);
            }
            var fromDb = new List<string>();
            if (!string.IsNullOrWhiteSpace(dbKey)) fromDb.Add(dbKey);
            fromDb.AddRange(dbKeys);
            fromDb = fromDb.Select(k => k.Trim()).Distinct().ToList();
            gemini.ApiKey = fromDb.FirstOrDefault() ?? string.Empty;
            gemini.ApiKeys = fromDb.Skip(1).ToList();
            gemini.Model = string.IsNullOrWhiteSpace(dbModel) ? original.Model : dbModel;
            // Embedding dùng chung khoá nên đi theo khi khoá đổi.
            if (embedding is not null) embedding.ApiKey = gemini.ApiKey;
        }
    }
}
