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

    /// <summary>Danh sách khoá đã lưu (mảng JSON mã hoá); rỗng khi chưa có hoặc không giải mã được.</summary>
    public static List<string> ReadKeyList(string? stored, string signingKey)
    {
        if (string.IsNullOrWhiteSpace(stored)) return [];
        var json = SecretProtector.IsProtected(stored) ? SecretProtector.TryUnprotect(stored, signingKey) : null;
        if (json is null) return [];
        try { return System.Text.Json.JsonSerializer.Deserialize<List<string>>(json)?.Where(k => !string.IsNullOrWhiteSpace(k)).ToList() ?? []; }
        catch (System.Text.Json.JsonException) { return []; }
    }

    public static async Task ApplyAsync(SmartFarmDbContext db, string signingKey, GeminiOptions gemini, GeminiEmbeddingOptions? embedding, ILogger? log, CancellationToken ct)
    {
        var rows = await db.PlatformSettings
            .Where(x => x.Key == PlatformSettingKeys.GeminiApiKey || x.Key == PlatformSettingKeys.GeminiApiKeys || x.Key == PlatformSettingKeys.GeminiModel).ToListAsync(ct);
        string? dbKey = null;
        var keyRow = rows.FirstOrDefault(x => x.Key == PlatformSettingKeys.GeminiApiKey);
        if (keyRow is not null && !string.IsNullOrWhiteSpace(keyRow.Value))
        {
            if (SecretProtector.IsProtected(keyRow.Value))
            {
                dbKey = SecretProtector.TryUnprotect(keyRow.Value, signingKey);
                if (dbKey is null) log?.LogWarning("Không giải mã được khoá Gemini trong cài đặt (Jwt:SigningKey đã đổi?). Bỏ qua, dùng cấu hình môi trường; Admin cần nhập lại.");
            }
            else if (!SecretProtector.LooksMasked(keyRow.Value))
            {
                // Giá trị cũ lưu dạng thô từ trước khi có mã hoá: dùng luôn và mã hoá lại.
                dbKey = keyRow.Value.Trim();
                keyRow.Value = SecretProtector.Protect(dbKey, signingKey);
                keyRow.IsSecret = true;
                await db.SaveChangesAsync(ct);
            }
        }
        var dbKeys = ReadKeyList(rows.FirstOrDefault(x => x.Key == PlatformSettingKeys.GeminiApiKeys)?.Value, signingKey);
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
