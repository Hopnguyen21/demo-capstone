using System.Net.Http.Json;
using System.Text.Json;
using SmartFarm.Infrastructure.Ai;

namespace SmartFarm.Infrastructure.Ai.Knowledge;

/// <summary>
/// Gọi Gemini với yêu cầu trả JSON, thử lần lượt model × API key cho tới khi có phản hồi.
/// Ném <see cref="GeminiUnavailableException"/> khi không lần nào thành công.
/// </summary>
internal static class GeminiJsonClient
{
    public static async Task<(string Json, string Model)> SendAsync(
        HttpClient httpClient, GeminiOptions settings, string systemInstruction, string userText,
        int maxOutputTokens, TimeSpan overallTimeout, CancellationToken ct)
    {
        var apiKeys = (settings.ApiKeys ?? []).Append(settings.ApiKey)
            .Where(k => !string.IsNullOrWhiteSpace(k)).Select(k => k.Trim()).Distinct().ToList();
        if (apiKeys.Count == 0 || string.IsNullOrWhiteSpace(settings.Model))
            throw new GeminiUnavailableException("Chưa cấu hình Gemini.");

        var body = new
        {
            systemInstruction = new { parts = new[] { new { text = systemInstruction } } },
            contents = new[] { new { role = "user", parts = new[] { new { text = userText } } } },
            generationConfig = new { temperature = 0, maxOutputTokens, responseMimeType = "application/json" }
        };

        var models = settings.CandidateModels();

        using var overallCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        overallCts.CancelAfter(overallTimeout);
        Exception? lastError = null;
        foreach (var model in models)
        {
            foreach (var apiKey in apiKeys)
            {
                if (overallCts.IsCancellationRequested) break;
                try
                {
                    var endpoint = new Uri(new Uri(settings.BaseUrl, UriKind.Absolute), $"models/{model}:generateContent");
                    using var request = new HttpRequestMessage(HttpMethod.Post, endpoint) { Content = JsonContent.Create(body) };
                    request.Headers.Add("x-goog-api-key", apiKey);
                    using var response = await httpClient.SendAsync(request, overallCts.Token);
                    if (!response.IsSuccessStatusCode)
                    {
                        lastError = new HttpRequestException($"Gemini ({model}) trả về HTTP {(int)response.StatusCode}.");
                        // 404 = model không còn cấp cho tài khoản: thử key khác cũng vô ích, sang model kế tiếp.
                        if (response.StatusCode == System.Net.HttpStatusCode.NotFound) break;
                        continue;
                    }

                    using var parsed = JsonDocument.Parse(await response.Content.ReadAsStringAsync(overallCts.Token));
                    var json = AgricultureDocumentService.ExtractFirstCandidateText(parsed.RootElement);
                    if (string.IsNullOrWhiteSpace(json))
                    {
                        lastError = new InvalidOperationException("Gemini không trả về nội dung.");
                        continue;
                    }
                    // Phản hồi bị cắt (hết token đầu ra, gồm cả token "suy nghĩ" của model mới) là JSON dở dang:
                    // không trả về để gây lỗi đọc JSON, mà thử model/key tiếp theo.
                    var clean = StripFence(json);
                    if (WasTruncated(parsed.RootElement) || !IsCompleteJson(clean))
                    {
                        lastError = new InvalidOperationException($"Gemini ({model}) trả về JSON không hoàn chỉnh (bị cắt).");
                        continue;
                    }
                    return (clean, model);
                }
                catch (OperationCanceledException) when (ct.IsCancellationRequested)
                {
                    throw;
                }
                catch (Exception ex) when (ex is HttpRequestException or JsonException or InvalidOperationException or OperationCanceledException)
                {
                    lastError = ex;
                }
            }
        }

        throw new GeminiUnavailableException("Gemini không phản hồi (hết hạn mức hoặc quá tải).", lastError);
    }

    /// <summary>Nội dung tài liệu là dữ liệu: bọc trong thẻ và không cho văn bản tự đóng thẻ để chèn chỉ dẫn.</summary>
    public static string WrapDocument(string text, int maxChars)
    {
        var body = text.Length > maxChars ? text[..maxChars] : text;
        return $"<document>\n{body.Replace("</document>", "</ document>", StringComparison.OrdinalIgnoreCase)}\n</document>";
    }

    internal static bool WasTruncated(JsonElement response) =>
        response.TryGetProperty("candidates", out var candidates) && candidates.ValueKind == JsonValueKind.Array &&
        candidates.EnumerateArray().Any(c => c.TryGetProperty("finishReason", out var r) &&
            string.Equals(r.GetString(), "MAX_TOKENS", StringComparison.OrdinalIgnoreCase));

    internal static bool IsCompleteJson(string json)
    {
        try { using var _ = JsonDocument.Parse(json); return true; }
        catch (JsonException) { return false; }
    }

    internal static string StripFence(string json)
    {
        var clean = json.Trim();
        if (!clean.StartsWith("```")) return clean;
        clean = clean.Trim('`').Trim();
        return clean.StartsWith("json", StringComparison.OrdinalIgnoreCase) ? clean[4..].Trim() : clean;
    }
}

internal sealed class GeminiUnavailableException(string message, Exception? inner = null) : Exception(message, inner);
