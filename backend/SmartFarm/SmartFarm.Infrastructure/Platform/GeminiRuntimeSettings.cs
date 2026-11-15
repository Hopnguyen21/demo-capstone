using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using SmartFarm.Infrastructure.Ai;
using SmartFarm.Infrastructure.Ai.Knowledge;
using SmartFarm.Infrastructure.Persistence;

namespace SmartFarm.Infrastructure.Platform;

/// <summary>
/// Khoá và model Gemini do Admin nhập ở Cài đặt nền tảng (platform_settings) được ưu tiên hơn cấu hình/biến môi trường, để môi trường
/// triển khai mới chỉ cần nhập trên web. Áp thẳng vào các đối tượng options dùng chung nên có hiệu lực ngay, không cần khởi động lại.
/// Để trống thì quay về giá trị từ cấu hình (user-secrets, Gemini__ApiKey, GEMINI_API_KEY).
/// </summary>
public static class GeminiRuntimeSettings
{
    private sealed record Base(string ApiKey, string Model, List<string> ApiKeys);
    private static readonly object Gate = new();
    // Giá trị gốc từ cấu hình của TỪNG đối tượng options (chụp ở lần áp đầu tiên) để khi Admin xoá khoá thì quay về đúng giá trị đó.
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
                original = new Base(gemini.ApiKey, gemini.Model, [.. gemini.ApiKeys ?? []]);
                Originals.Add(gemini, original);
            }
            var previous = gemini.ApiKey;
            // Khoá Admin nhập đứng đầu; khoá từ cấu hình máy chủ vẫn nằm phía sau làm dự phòng khi hết quota.
            var fromDb = new List<string>();
            if (!string.IsNullOrWhiteSpace(dbKey)) fromDb.Add(dbKey);
            fromDb.AddRange(dbKeys);
            if (fromDb.Count == 0)
            {
                gemini.ApiKey = original.ApiKey;
                gemini.ApiKeys = [.. original.ApiKeys];
            }
            else
            {
                gemini.ApiKey = fromDb[0];
                gemini.ApiKeys = [.. fromDb.Skip(1), original.ApiKey, .. original.ApiKeys];
                gemini.ApiKeys = gemini.ApiKeys.Where(k => !string.IsNullOrWhiteSpace(k)).Select(k => k.Trim()).Distinct().Where(k => k != gemini.ApiKey).ToList();
            }
            gemini.Model = string.IsNullOrWhiteSpace(dbModel) ? original.Model : dbModel;
            // Embedding mặc định dùng chung khoá với Gemini (trừ khi cấu hình khoá riêng) nên đi theo khi khoá đổi.
            if (embedding is not null && (string.IsNullOrWhiteSpace(embedding.ApiKey) || embedding.ApiKey == previous))
                embedding.ApiKey = gemini.ApiKey;
        }
    }
}
