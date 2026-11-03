using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace SmartFarm.Infrastructure.Ai.Knowledge;

public sealed class GeminiEmbeddingOptions
{
    public const string SectionName = "Ai:Embedding";
    public string ApiKey { get; set; } = string.Empty;
    public string Model { get; set; } = "gemini-embedding-001";
    public string BaseUrl { get; set; } = "https://generativelanguage.googleapis.com/v1beta/";
    public int Dimensions { get; set; } = 768;
    public int MaxRetries { get; set; } = 3;
    public double RetryBaseDelaySeconds { get; set; } = 0.1;
    /// <summary>Khoảng cách tối thiểu giữa hai lệnh gọi embedding (mili giây); 0 = không giãn nhịp (dùng cho test).</summary>
    public int PaceMilliseconds { get; set; } = 650;
}

/// <summary>
/// Tạo embedding vector cho một đoạn văn bản bằng Gemini gemini-embedding-001 API.
/// Output: vector chuẩn hóa độ dài đơn vị (unit vector), dùng thống nhất cho cả indexing và retrieval.
/// </summary>
public sealed class GeminiEmbeddingProvider
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);
    private readonly HttpClient httpClient;
    private readonly GeminiEmbeddingOptions settings;
    private readonly ILogger<GeminiEmbeddingProvider> logger;

    public GeminiEmbeddingProvider(
        HttpClient httpClient,
        IOptions<GeminiEmbeddingOptions> options,
        ILogger<GeminiEmbeddingProvider> logger)
    {
        this.httpClient = httpClient;
        this.settings = options.Value;
        this.logger = logger;
    }

    // Hết quota ngày của Gemini (429 "per day"): tạm ngừng gọi embedding để không đốt thêm yêu cầu, tìm tri thức dùng từ khóa trong lúc chờ.
    private static DateTime quotaBlockedUntilUtc = DateTime.MinValue;
    private static readonly TimeSpan QuotaCooldown = TimeSpan.FromMinutes(60);

    public bool IsAvailable => !string.IsNullOrWhiteSpace(settings.ApiKey) && DateTime.UtcNow >= quotaBlockedUntilUtc;
    public int Dimensions => settings.Dimensions;

    public async Task<float[]> GenerateEmbeddingAsync(string text, CancellationToken ct = default)
    {
        return await EmbedStrictAsync(text, "RETRIEVAL_DOCUMENT", ct);
    }

    public Task<float[]> GenerateDocumentEmbeddingAsync(string text, CancellationToken ct = default) =>
        GenerateEmbeddingAsync(text, ct);

    public Task<float[]> GenerateQueryEmbeddingAsync(string text, CancellationToken ct = default) =>
        EmbedStrictAsync(text, "RETRIEVAL_QUERY", ct, maxRateWaitSeconds: 0);

    public async Task<float[]?> EmbedDocumentAsync(string text, CancellationToken ct = default)
    {
        try { return await EmbedStrictAsync(text, "RETRIEVAL_DOCUMENT", ct); }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "[Embedding] Failed to embed document with model '{Model}'.", settings.Model);
            return null;
        }
    }

    public async Task<float[]?> EmbedQueryAsync(string text, CancellationToken ct = default)
    {
        try { return await EmbedStrictAsync(text, "RETRIEVAL_QUERY", ct, maxRateWaitSeconds: 0); }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "[Embedding] Failed to embed query with model '{Model}'. Falling back to keyword search.", settings.Model);
            return null;
        }
    }

    // Giãn nhịp các lệnh gọi (~90 lần/phút, dưới mức 100 lần/phút của gói miễn phí) để không tự gây lỗi 429 theo phút khi nạp hàng trăm đoạn.
    private static readonly SemaphoreSlim PaceLock = new(1, 1);
    private static DateTime nextSlotUtc = DateTime.MinValue;

    private async Task PaceAsync(CancellationToken ct)
    {
        if (settings.PaceMilliseconds <= 0) return;
        var MinInterval = TimeSpan.FromMilliseconds(settings.PaceMilliseconds);
        await PaceLock.WaitAsync(ct);
        try
        {
            var now = DateTime.UtcNow;
            var wait = nextSlotUtc - now;
            if (wait > TimeSpan.Zero) await Task.Delay(wait, ct);
            nextSlotUtc = (wait > TimeSpan.Zero ? nextSlotUtc : now) + MinInterval;
        }
        finally { PaceLock.Release(); }
    }

    private static readonly System.Text.RegularExpressions.Regex RetryIn = new(
        @"retry in ([0-9]+(?:\.[0-9]+)?)s|""retryDelay""\s*:\s*""([0-9]+(?:\.[0-9]+)?)s""",
        System.Text.RegularExpressions.RegexOptions.IgnoreCase | System.Text.RegularExpressions.RegexOptions.Compiled, TimeSpan.FromMilliseconds(100));

    /// <summary>Thời gian Google yêu cầu chờ trong thông báo 429 ("Please retry in 12.3s" hoặc retryDelay); null nếu không nêu.</summary>
    internal static TimeSpan? ParseRetryDelay(string body)
    {
        var m = RetryIn.Match(body ?? string.Empty);
        if (!m.Success) return null;
        var raw = m.Groups[1].Success ? m.Groups[1].Value : m.Groups[2].Value;
        return double.TryParse(raw, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var seconds)
            ? TimeSpan.FromSeconds(seconds) : null;
    }

    private async Task<float[]> EmbedStrictAsync(string text, string taskType, CancellationToken ct, int maxRateWaitSeconds = 70)
    {
        if (string.IsNullOrWhiteSpace(settings.ApiKey))
            throw new InvalidOperationException("Gemini API key is not configured for embedding.");

        if (DateTime.UtcNow < quotaBlockedUntilUtc)
            throw new HttpRequestException("Gemini embedding is paused after the daily quota was exceeded.", null, System.Net.HttpStatusCode.TooManyRequests);

        if (text.Length > 7500) text = text[..7500];

        var endpoint = new Uri(new Uri(settings.BaseUrl, UriKind.Absolute),
            $"models/{settings.Model}:embedContent");

        var requestBody = new
        {
            model = $"models/{settings.Model}",
            content = new { parts = new[] { new { text } } },
            taskType,
            outputDimensionality = settings.Dimensions
        };

        var maxRetries = Math.Max(1, settings.MaxRetries);
        for (int attempt = 0; attempt < maxRetries; attempt++)
        {
            await PaceAsync(ct);
            using var req = new HttpRequestMessage(HttpMethod.Post, endpoint)
            {
                Content = JsonContent.Create(requestBody, options: JsonOpts)
            };
            req.Headers.Add("x-goog-api-key", settings.ApiKey);

            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(20));

            HttpResponseMessage response;
            try
            {
                response = await httpClient.SendAsync(req, cts.Token);
            }
            catch (Exception) when (attempt < maxRetries - 1)
            {
                await Task.Delay(TimeSpan.FromSeconds(settings.RetryBaseDelaySeconds * Math.Pow(2, attempt)), ct);
                continue;
            }

            using (response)
            {
                if (response.IsSuccessStatusCode)
                {
                    using var stream = await response.Content.ReadAsStreamAsync(cts.Token);
                    using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: cts.Token);

                    if (!doc.RootElement.TryGetProperty("embedding", out var embProp) ||
                        !embProp.TryGetProperty("values", out var valuesProp))
                    {
                        throw new InvalidOperationException("Gemini embedding response missing 'embedding.values' field.");
                    }

                    var rawValues = new List<float>();
                    foreach (var val in valuesProp.EnumerateArray())
                    {
                        rawValues.Add(val.GetSingle());
                    }

                    if (rawValues.Count != settings.Dimensions)
                    {
                        throw new InvalidOperationException($"Dimension mismatch: Expected {settings.Dimensions}, got {rawValues.Count}.");
                    }

                    return Normalize([.. rawValues]);
                }

                if (response.StatusCode == System.Net.HttpStatusCode.BadRequest)
                {
                    var errorBody = await response.Content.ReadAsStringAsync(cts.Token);
                    throw new HttpRequestException($"Gemini embedding API returned 400 Bad Request: {errorBody}", null, System.Net.HttpStatusCode.BadRequest);
                }

                if (response.StatusCode == System.Net.HttpStatusCode.TooManyRequests)
                {
                    var quotaBody = await response.Content.ReadAsStringAsync(cts.Token);
                    // Quota theo ngày không hồi lại sau vài trăm ms: không thử lại, tạm ngừng toàn bộ lệnh gọi embedding.
                    if (quotaBody.Contains("per day", StringComparison.OrdinalIgnoreCase))
                    {
                        quotaBlockedUntilUtc = DateTime.UtcNow + QuotaCooldown;
                        logger.LogWarning("[Embedding] Daily quota exceeded; embedding paused for {Minutes} minutes.", QuotaCooldown.TotalMinutes);
                        throw new HttpRequestException($"Gemini embedding daily quota exceeded (429): {quotaBody}", null, response.StatusCode);
                    }

                    // Giới hạn theo phút: chờ đúng thời gian Google yêu cầu rồi thử lại (nạp tài liệu); câu hỏi người dùng không chờ, và việc gọi
                    // lại ngay sau vài trăm mili giây chỉ đốt thêm lượt gọi. Chờ quá lâu thì tạm ngừng mọi lệnh gọi trong thời gian đó.
                    // Không có gợi ý thời gian chờ: dùng lại nhịp lùi dần như các lỗi tạm thời khác.
                    var wait = ParseRetryDelay(quotaBody) ?? TimeSpan.FromSeconds(settings.RetryBaseDelaySeconds * Math.Pow(2, attempt));
                    if (wait.TotalSeconds <= maxRateWaitSeconds && attempt < maxRetries - 1)
                    {
                        logger.LogInformation("[Embedding] Per-minute limit; waiting {Seconds:0.#}s before retrying.", wait.TotalSeconds);
                        await Task.Delay(wait + TimeSpan.FromSeconds(1), ct);
                        continue;
                    }
                    quotaBlockedUntilUtc = DateTime.UtcNow + TimeSpan.FromSeconds(Math.Clamp(wait.TotalSeconds, 5, 120));
                    throw new HttpRequestException($"Gemini embedding rate limited (429); retry in {wait.TotalSeconds:0.#}s.", null, response.StatusCode);
                }

                var isRetryable = response.StatusCode == System.Net.HttpStatusCode.TooManyRequests || (int)response.StatusCode >= 500;
                if (!isRetryable || attempt >= maxRetries - 1)
                {
                    var errorBody = await response.Content.ReadAsStringAsync(cts.Token);
                    throw new HttpRequestException($"Gemini embedding request failed with status {(int)response.StatusCode}: {errorBody}", null, response.StatusCode);
                }

                var delay = TimeSpan.FromSeconds(settings.RetryBaseDelaySeconds * Math.Pow(2, attempt));
                await Task.Delay(delay, ct);
            }
        }

        throw new HttpRequestException("Gemini embedding failed after retries.");
    }

    private static float[] Normalize(float[] v)
    {
        double sum = 0;
        foreach (var x in v) sum += (double)x * x;
        var norm = Math.Sqrt(sum);
        if (norm < 1e-12) return v;
        var result = new float[v.Length];
        for (var i = 0; i < v.Length; i++) result[i] = (float)(v[i] / norm);
        return result;
    }
}
