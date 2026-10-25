using System.Net.Http.Json;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Application.Features.Ai;
using SmartFarm.Domain.Enums;

namespace SmartFarm.Infrastructure.Ai;

public sealed class GeminiOptions
{
    public const string SectionName = "Gemini";
    public string ApiKey { get; set; } = string.Empty;
    public string Model { get; set; } = "gemini-2.5-flash";
    public string BaseUrl { get; set; } = "https://generativelanguage.googleapis.com/v1beta/";
    public int TimeoutSeconds { get; set; } = 30;
    public int MaxOutputTokens { get; set; } = 8192;
    public int? ThinkingBudget { get; set; }
    public int MaxQuestionLength { get; set; } = 1000;
}

public sealed partial class GeminiAiAdvisoryProvider(
    HttpClient httpClient,
    IOptions<GeminiOptions> options,
    ILogger<GeminiAiAdvisoryProvider> logger) : IAiAdvisoryProvider
{
    private const int MaxActionDurationSeconds = 1800;
    private readonly GeminiOptions settings = options.Value;

    public async Task<AiProviderResult> GenerateAsync(AiProviderRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(settings.ApiKey))
            throw new InvalidOperationException("Gemini API key is not configured.");
        if (!ModelName().IsMatch(settings.Model))
            throw new InvalidOperationException("Gemini model name is invalid.");

        var endpoint = new Uri(new Uri(settings.BaseUrl, UriKind.Absolute), $"models/{settings.Model}:generateContent");
        var promptText = AiPromptBuilder.Build(request);

        logger.LogInformation(
            "[Gemini] Sending request. Model={Model} PromptLength={PromptLength} Farm={Farm} Zone={Zone} Crop={Crop} Stage={Stage} Telemetry={Telemetry} Actuators={Actuators}",
            settings.Model, promptText.Length,
            request.Context.FarmName, request.Context.ZoneName, request.Context.CropName, request.Context.GrowthStageName,
            request.Context.Telemetry.Count, request.Context.Actuators.Count);
        logger.LogDebug("[Gemini] Question: {Question}", request.Question);

        var generationConfig = new Dictionary<string, object?>
        {
            ["temperature"] = 0.2,
            ["maxOutputTokens"] = settings.MaxOutputTokens,
            ["responseMimeType"] = "application/json",
            ["responseSchema"] = AiPromptBuilder.ResponseSchema
        };
        if (settings.ThinkingBudget is > 0)
            generationConfig["thinkingConfig"] = new { thinkingBudget = settings.ThinkingBudget.Value };

        var body = new
        {
            systemInstruction = new { parts = new[] { new { text = AiPromptBuilder.SystemPrompt } } },
            contents = new[] { new { role = "user", parts = new[] { new { text = promptText } } } },
            generationConfig
        };

        using var message = new HttpRequestMessage(HttpMethod.Post, endpoint)
        {
            Content = JsonContent.Create(body, options: JsonOptions)
        };
        message.Headers.Add("x-goog-api-key", settings.ApiKey);


        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(settings.TimeoutSeconds));

        string responseBody;
        try
        {
            using var response = await httpClient.SendAsync(message, HttpCompletionOption.ResponseHeadersRead, timeout.Token);
            responseBody = await response.Content.ReadAsStringAsync(timeout.Token);

            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("[Gemini] HTTP {StatusCode}. Body: {Body}", (int)response.StatusCode, Truncate(responseBody, 1000));
                throw new HttpRequestException($"Gemini returned HTTP {(int)response.StatusCode}.", null, response.StatusCode);
            }
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            throw new TimeoutException($"Gemini did not respond within {settings.TimeoutSeconds}s.");
        }

        string text;
        try
        {
            using var envelope = JsonDocument.Parse(responseBody);
            text = ExtractText(envelope.RootElement);
        }
        catch (JsonException ex)
        {
            throw new InvalidOperationException("Gemini returned an invalid response envelope.", ex);
        }

        logger.LogDebug("[Gemini] Raw response text: {RawJson}", text);

        GeminiOutput output;
        try
        {
            output = JsonSerializer.Deserialize<GeminiOutput>(text, JsonOptions)
                ?? throw new InvalidOperationException("Gemini returned an empty structured result.");
        }
        catch (JsonException ex)
        {
            logger.LogWarning("[Gemini] Cannot parse structured output: {Text}", Truncate(text, 1000));
            throw new InvalidOperationException("Gemini returned malformed structured JSON.", ex);
        }

        if (string.IsNullOrWhiteSpace(output.Summary))
            throw new InvalidOperationException("Gemini returned an incomplete structured result.");

        var action = output.IsOutOfScope ? null : ValidateAction(output.ProposedControlAction, request);

        var limitations = output.Limitations?
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(x => CleanTechnicalIds(x.Trim()))
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .ToList() ?? [];
        if (output.IsOutOfScope)
            limitations.Insert(0, "Yêu cầu nằm ngoài phạm vi hỗ trợ của hệ thống SmartFarm.");

        var details = string.IsNullOrWhiteSpace(output.Details)
            ? "Yêu cầu nằm ngoài phạm vi hoặc không có thêm thông tin chi tiết."
            : CleanTechnicalIds(output.Details.Trim());

        var summary = CleanTechnicalIds(output.Summary.Trim());

        var sources = output.Sources?
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(x => x.Trim())
            .Distinct()
            .ToList() ?? [];

        if (sources.Count == 0 && request.KnowledgePassages is { Count: > 0 } passages)
        {
            sources = passages.Select(p => p.DocumentTitle).Distinct().ToList();
        }

        return new AiProviderResult(
            $"Google Gemini/{settings.Model}",
            summary,
            details,
            Math.Clamp(output.Confidence, 0m, 1m),
            limitations,
            action,
            output.CitedPassages,
            sources);
    }

    private AiProposedControlAction? ValidateAction(GeminiControlOutput? proposed, AiProviderRequest request)
    {
        if (proposed is null) return null;
        if (proposed.Enabled == false) return null;

        if (string.IsNullOrWhiteSpace(proposed.ActuatorId) || !Guid.TryParse(proposed.ActuatorId, out var actuatorId))
            return Reject("ActuatorId is not a valid GUID");

        if (string.IsNullOrWhiteSpace(proposed.Action) ||
            !Enum.TryParse<ActuatorCommandAction>(proposed.Action, true, out var commandAction) ||
            !Enum.IsDefined(commandAction))
            return Reject("Action is not a valid ActuatorCommandAction");

        var actuator = request.Context.Actuators.FirstOrDefault(a => a.ActuatorId == actuatorId);
        if (actuator is null)
            return Reject("Actuator is not part of the provided context");
        if (!actuator.IsOnline)
            return Reject("Actuator is offline");

        var maxDuration = Math.Min(MaxActionDurationSeconds, actuator.MaxDurationSeconds > 0 ? actuator.MaxDurationSeconds : MaxActionDurationSeconds);
        var duration = Math.Clamp(proposed.DurationSeconds, 0, maxDuration);
        if (commandAction == ActuatorCommandAction.TurnOn && duration == 0)
            return Reject("TurnOn requires a positive duration");

        return new AiProposedControlAction(actuatorId, commandAction, duration);

        AiProposedControlAction? Reject(string reason)
        {
            logger.LogWarning("[Gemini] Proposed control action rejected: {Reason}", reason);
            return null;
        }
    }

    private string ExtractText(JsonElement root)
    {
        if (root.TryGetProperty("promptFeedback", out var feedback) &&
            feedback.TryGetProperty("blockReason", out var blockReason))
            throw new InvalidOperationException($"Gemini blocked the prompt: {blockReason.GetString()}.");

        if (!root.TryGetProperty("candidates", out var candidates) || candidates.GetArrayLength() == 0)
            throw new InvalidOperationException("Gemini response did not contain a candidate.");

        var candidate = candidates[0];

        if (candidate.TryGetProperty("finishReason", out var finish))
        {
            var reason = finish.GetString();
            if (reason is "SAFETY" or "RECITATION" or "PROHIBITED_CONTENT")
                throw new InvalidOperationException($"Gemini stopped with finishReason={reason}.");
            if (reason == "MAX_TOKENS")
                logger.LogWarning("[Gemini] Response reached MAX_TOKENS limit; parsing generated parts.");
        }

        if (!candidate.TryGetProperty("content", out var content) ||
            !content.TryGetProperty("parts", out var parts))
            throw new InvalidOperationException("Gemini response did not contain content parts.");

        var sb = new StringBuilder();
        foreach (var part in parts.EnumerateArray())
        {
            if (part.TryGetProperty("thought", out var thought) && thought.ValueKind == JsonValueKind.True)
                continue;
            if (part.TryGetProperty("text", out var t) && t.GetString() is { } s && !string.IsNullOrWhiteSpace(s))
                sb.Append(s);
        }

        if (sb.Length == 0)
            throw new InvalidOperationException("Gemini response did not contain structured text.");
        return sb.ToString();
    }

    private static string Truncate(string value, int max) =>
        value.Length <= max ? value : value[..max] + "…";

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() },
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
        PropertyNameCaseInsensitive = true
    };

    private sealed record GeminiOutput(
        string Summary,
        string? Details,
        decimal Confidence,
        bool IsOutOfScope,
        string? Category,
        IReadOnlyList<string>? Limitations,
        GeminiControlOutput? ProposedControlAction,
        IReadOnlyList<int>? CitedPassages,
        IReadOnlyList<string>? Sources);

    private sealed record GeminiControlOutput(bool? Enabled, string? ActuatorId, string? Action, int DurationSeconds);

    [GeneratedRegex("^[A-Za-z0-9._-]{1,100}$")]
    private static partial Regex ModelName();

    private static string CleanTechnicalIds(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return text;
        var cleaned = Regex.Replace(text, @"\s*\((?:Mã\s*(?:ID|thiết bị)?|ID|ActuatorId)?:?\s*[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\)", "", RegexOptions.IgnoreCase);
        cleaned = Regex.Replace(cleaned, @"(?:mã\s*(?:ID|thiết bị)?|ID\s*thiết\s*bị|thiết\s*bị\s*mã)?:?\s*[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}", "", RegexOptions.IgnoreCase);
        cleaned = Regex.Replace(cleaned, @"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}", "");
        cleaned = Regex.Replace(cleaned, @"\(\s*\)", "");
        cleaned = Regex.Replace(cleaned, @"[ ]{2,}", " ");
        return cleaned.Trim();
    }
}
