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
        EmbedStrictAsync(text, "RETRIEVAL_QUERY", ct);

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
        try { return await EmbedStrictAsync(text, "RETRIEVAL_QUERY", ct); }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "[Embedding] Failed to embed query with model '{Model}'. Falling back to keyword search.", settings.Model);
            return null;
        }
    }

    private async Task<float[]> EmbedStrictAsync(string text, string taskType, CancellationToken ct)
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
