using SmartFarm.Application.Features.Control;
using SmartFarm.Domain.Enums;

namespace SmartFarm.Application.Features.Ai;

public sealed record AiTelemetryContextItem(EnvironmentalParameterCode ParameterCode, decimal Value, string Unit, DateTime CapturedAtUtc, bool IsFresh);
public sealed record AiRequirementContextItem(EnvironmentalParameterCode ParameterCode, decimal MinValue, decimal MaxValue, decimal TargetValue, string Unit);
public sealed record AiWeatherContext(bool Available, string? Summary, decimal? RainProbabilityPercent, decimal? TemperatureCelsius, DateTime? ObservedAtUtc, string? Limitation);
public sealed record AiZoneContext(
    Guid FarmId, string FarmName, string FarmTimeZone, Guid FieldId, string FieldName, Guid ZoneId, string ZoneName, decimal ZoneAreaM2,
    Guid? PlantingSeasonId, string? CropName, string? VarietyName, Guid? GrowthProfileId, string? GrowthProfileName, int? SeasonAgeDays,
    Guid? GrowthStageId, string? GrowthStageName,
    IReadOnlyList<AiRequirementContextItem> Requirements,
    IReadOnlyList<AiTelemetryContextItem> Telemetry,
    AiWeatherContext Weather,
    IReadOnlyList<string> MissingData,
    bool IsSufficientForAdvice);

public sealed record AiProposedControlAction(Guid ActuatorId, ActuatorCommandAction Action, int DurationSeconds);
public sealed record AiProviderRequest(string Question, AiZoneContext Context);
public sealed record AiProviderResult(string ProviderName, string Summary, string Details, decimal Confidence, IReadOnlyList<string> Limitations, AiProposedControlAction? ProposedControlAction);
public sealed record AiWeatherResult(bool Available, string? Summary, decimal? RainProbabilityPercent, decimal? TemperatureCelsius, DateTime? ObservedAtUtc, string? Limitation);

public sealed record AskAiCommand(string Question, Guid? ParentRecommendationId = null);
public sealed record DecideRecommendationCommand(Guid RecommendationId, AiRecommendationDecisionType Decision, string? Reason, string? FollowUpQuestion);
public sealed record AiRecommendationView(
    Guid RecommendationId, Guid ConsultationRequestId, Guid ZoneId, string Question,
    string Summary, string Details, IReadOnlyList<string> Limitations, decimal Confidence,
    AiRecommendationStatus Status, bool IsActionable, DateTime ValidUntilUtc,
    Guid? ProposedActuatorId, ActuatorCommandAction? ProposedAction, int? ProposedDurationSeconds,
    DateTime CreatedAtUtc);
public sealed record AiDecisionView(Guid DecisionId, Guid RecommendationId, AiRecommendationDecisionType Decision, string? Reason, DateTime CreatedAtUtc, Guid? CommandId, Guid? FollowUpConsultationId);
public sealed record AiDecisionResult(AiRecommendationView Recommendation, AiDecisionView Decision, ActuatorCommandView? Command, AiRecommendationView? FollowUpRecommendation);
public sealed record AiHistoryView(Guid ZoneId, IReadOnlyList<AiRecommendationView> Recommendations);

public sealed class AiOptions
{
    public const string SectionName = "Ai";
    public decimal MinimumConfidence { get; set; } = 0.70m;
    public int MaxRequestsPerWindow { get; set; } = 10;
    public int RateLimitWindowMinutes { get; set; } = 60;
    public int RecommendationValidityMinutes { get; set; } = 15;
    public int TelemetryFreshnessMinutes { get; set; } = 5;
}
