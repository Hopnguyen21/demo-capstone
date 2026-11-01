using System.Collections.Concurrent;

namespace SmartFarm.Infrastructure.Ai;

/// <summary>
/// Thứ tự thử các API key Gemini. <c>ApiKey</c> (key chính) được thử trước; key bị từ chối quyền (401/403, ví dụ project chưa bật billing)
/// được bỏ qua một thời gian để mỗi câu hỏi không phải chờ qua các key hỏng trước khi tới key dùng được.
/// </summary>
internal static class GeminiKeyPool
{
    private static readonly TimeSpan Cooldown = TimeSpan.FromMinutes(30);
    private static readonly ConcurrentDictionary<string, DateTime> DisabledUntilUtc = new();

    public static List<string> Ordered(GeminiOptions settings)
    {
        var all = new[] { settings.ApiKey }.Concat(settings.ApiKeys ?? [])
            .Where(k => !string.IsNullOrWhiteSpace(k)).Select(k => k.Trim()).Distinct().ToList();
        var usable = all.Where(k => !DisabledUntilUtc.TryGetValue(k, out var until) || until <= DateTime.UtcNow).ToList();
        // Mọi key đều đang bị tạm loại thì vẫn thử hết, để lỗi cấu hình hiện đúng thay vì im lặng.
        return usable.Count > 0 ? usable : all;
    }

    public static void ReportStatus(string apiKey, int statusCode)
    {
        if (statusCode is 401 or 403) DisabledUntilUtc[apiKey.Trim()] = DateTime.UtcNow + Cooldown;
    }
}
