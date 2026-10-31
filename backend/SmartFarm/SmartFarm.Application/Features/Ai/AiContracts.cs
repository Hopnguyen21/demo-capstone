using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Application.Features.Control;
using SmartFarm.Domain.Enums;
using System.Text.Json.Serialization;

namespace SmartFarm.Application.Features.Ai;

public sealed record AiTelemetryContextItem(EnvironmentalParameterCode ParameterCode, decimal Value, string Unit, DateTime CapturedAtUtc, bool IsFresh);
public sealed record AiTelemetryHistoryItem(EnvironmentalParameterCode ParameterCode, decimal Value, string Unit, DateTime CapturedAtUtc);
public sealed record AiRequirementContextItem(EnvironmentalParameterCode ParameterCode, decimal MinValue, decimal MaxValue, decimal TargetValue, string Unit);
public sealed record AiActuatorContextItem(Guid ActuatorId, string ActuatorType, int MaxDurationSeconds, bool IsOnline);
public sealed record AiUpcomingScheduleContextItem(string Name, DateTime NextRunAtUtc, string NextRunTimeFormatted, int DurationSeconds, int MinutesUntilRun);
public sealed record AiWeatherContext(bool Available, string? Summary, decimal? RainProbabilityNext6HoursMaxPercent, decimal? TemperatureCelsius, DateTime? ObservedAtUtc, string? Limitation);
public sealed record AiZoneStructureItem(
    Guid ZoneId, string ZoneName, decimal AreaM2, string ZoneType, string ZoneStatus,
    string? ActiveCrop, string? GrowthStageName, int? SeasonAgeDays);

public sealed record AiFieldStructureItem(
    Guid FieldId, string FieldName, decimal AreaM2,
    IReadOnlyList<AiZoneStructureItem> Zones);

public sealed record AiFarmStructureContext(
    Guid FarmId, string FarmName, decimal TotalAreaM2,
    IReadOnlyList<AiFieldStructureItem> Fields);

public sealed record AiDeviceNodeItem(
    Guid DeviceId,
    string HardwareAddress,
    string DeviceType,
    string Status,
    string? InstallationNotes,
    IReadOnlyList<AiTelemetryContextItem> Telemetry,
    IReadOnlyList<string> Actuators);

public sealed record AiZoneDeviceSummary(
    string DeviceLabel,
    string DeviceType,
    string Status,
    int SensorCount,
    IReadOnlyList<string> SensorTypes,
    IReadOnlyList<AiTelemetryContextItem> LatestReadings,
    IReadOnlyList<string> ActuatorTypes,
    /// <summary>Sức khỏe thiết bị theo báo cáo của chính thiết bị; null = không báo (không được suy đoán).</summary>
    int? BatteryLevel = null,
    decimal? Rssi = null);

/// <summary>
/// Gateway phục vụ các thiết bị của Zone (không gồm MAC, client id, chứng chỉ). NodesInZone: số node của Zone qua gateway này.
/// </summary>
public sealed record AiGatewaySummary(string GatewayLabel, string Status, DateTime? LastSeenAtUtc, string FirmwareVersion, string FrequencyBand, int NodesInZone);

/// <summary>Cảnh báo chưa xử lý xong (Open/Acknowledged) của đúng Zone.</summary>
public sealed record AiAlertContextItem(EnvironmentalParameterCode ParameterCode, decimal ObservedValue, decimal MinThreshold, decimal MaxThreshold, string Unit, string Severity, string Status, string Title, DateTime CreatedAtUtc);

/// <summary>Lệnh thiết bị gần đây của Zone (để không đề xuất tưới trùng và biết lần chạy gần nhất).</summary>
public sealed record AiCommandContextItem(string ActuatorType, string Action, int DurationSeconds, string Status, string TriggerSource, DateTime QueuedAtUtc);

/// <summary>Quy tắc tự động đang bật của Zone.</summary>
public sealed record AiAutoRuleContextItem(string Name, EnvironmentalParameterCode ParameterCode, string Operator, decimal Threshold, int ConditionMinutes, string Action, int DurationSeconds, int CooldownMinutes, bool RainDelay, decimal RainThresholdPercent);

/// <summary>Công việc chưa hoàn tất của Zone (đến hạn trong 7 ngày hoặc đã quá hạn).</summary>
public sealed record AiTaskContextItem(string Title, DateTime DueAtUtc, string Status);

public sealed record AiStageOutlineItem(int Order, string Name, int DurationDays, bool IsCurrent);

/// <summary>Kế hoạch vụ mùa hiện tại: ngày bắt đầu, dự kiến kết thúc và các giai đoạn của hồ sơ sinh trưởng.</summary>
/// <summary>
/// Dữ kiện vụ mùa do backend tính (AI không tự tính): chỉ có khi Zone có vụ InProgress, kể cả khi Growth Profile/giai đoạn thiếu hoặc không khớp cây.
/// ElapsedDays = số ngày đã qua kể từ ngày bắt đầu theo ngày địa phương của Farm (ngày bắt đầu là ngày 0).
/// DaysToExpectedEnd là ngày kết thúc DỰ KIẾN của vụ, không phải ngày thu hoạch (hệ thống không lưu ngày thu hoạch riêng).
/// ProfileTotalPlannedDays là tổng DurationDays các giai đoạn trong Profile: thời lượng kế hoạch, không mặc định là thời gian đến thu hoạch.
/// </summary>
public sealed record AiSeasonFacts(
    string SeasonName, DateOnly StartDate, DateOnly ExpectedEndDate, int ElapsedDays, int DaysToExpectedEnd,
    string? ProfileName, bool ProfileMatchesCrop, string? CurrentStageName, int? CurrentStageOrder, int? StageCount,
    int? CurrentStagePlannedDays, int? ProfileTotalPlannedDays, bool ProfileIsFarmOwned = false);

/// <summary>Kế hoạch tham chiếu của Growth Profile cho cây của Zone khi chưa có vụ đang canh tác. Là thời lượng kế hoạch, không phải tuổi hay ngày chín thực tế.</summary>
public sealed record AiReferenceProfile(string Name, int StageCount, int TotalPlannedDays, IReadOnlyList<AiStageOutlineItem> Stages);

/// <summary>Vụ gần nhất đã hoàn thành của Zone: chỉ là lịch sử (không phải cây hay giai đoạn hiện tại).</summary>
public sealed record AiPastSeason(string Name, string? CropName, DateOnly StartDate, DateOnly? ActualEndDate, decimal? ActualYieldKg);

public sealed record AiSeasonContext(string Name, DateOnly StartDate, DateOnly ExpectedEndDate, string? ProfileName, IReadOnlyList<AiStageOutlineItem> Stages);

public sealed record AiZoneContext(
    [property: JsonIgnore] Guid FarmId, [property: JsonIgnore] string FarmName, string FarmTimeZone,
    [property: JsonIgnore] Guid FieldId, [property: JsonIgnore] string FieldName,
    Guid ZoneId, string ZoneName, decimal ZoneAreaM2,
    Guid? PlantingSeasonId, string? CropName, string? VarietyName, Guid? GrowthProfileId, string? GrowthProfileName, int? SeasonAgeDays,
    Guid? GrowthStageId, string? GrowthStageName,
    IReadOnlyList<AiRequirementContextItem> Requirements,
    IReadOnlyList<AiTelemetryContextItem> Telemetry,
    IReadOnlyList<AiActuatorContextItem> Actuators,
    IReadOnlyList<AiUpcomingScheduleContextItem> UpcomingSchedules,
    AiWeatherContext Weather,
    IReadOnlyList<string> MissingData,
    bool IsSufficientForAdvice,
    [property: JsonIgnore] AiFarmStructureContext? FarmStructure = null,
    IReadOnlyList<AiTelemetryHistoryItem>? TelemetryHistory = null,
    [property: JsonIgnore] IReadOnlyList<AiDeviceNodeItem>? DeviceNodes = null,
    IReadOnlyList<AiZoneDeviceSummary>? ZoneDevices = null,
    // Dữ liệu còn lại của đúng Zone này, gửi để AI dùng khi câu hỏi liên quan (không bao giờ gồm dữ liệu Zone/Field/Farm khác).
    IReadOnlyList<AiAlertContextItem>? ActiveAlerts = null,
    IReadOnlyList<AiCommandContextItem>? RecentCommands = null,
    IReadOnlyList<AiAutoRuleContextItem>? AutoRules = null,
    IReadOnlyList<AiTaskContextItem>? OpenTasks = null,
    AiSeasonContext? Season = null,
    string? ZoneType = null,
    string? ZoneStatus = null,
    IReadOnlyList<AiGatewaySummary>? Gateways = null,
    AiSeasonFacts? SeasonFacts = null,
    // CropName chỉ là cây của vụ InProgress. Không có vụ đang chạy thì chỉ có CropHint (vụ dự kiến hoặc tên Zone): gợi ý, không phải cây đang trồng.
    string? CropHint = null,
    string? CropHintSource = null,
    // Cây dùng để tra tài liệu kiến thức; có thể khác cây của Zone khi người dùng hỏi cây khác. Không thay đổi dữ liệu vận hành/ngưỡng của Zone.
    string? KnowledgeCrop = null,
    string? KnowledgeCropSource = null,
    // Cây/giống vận hành lấy từ Zone (CropName/VarietyName). Vụ InProgress khác cây Zone thì không dùng cho tuổi/giai đoạn/ngưỡng:
    // SeasonCropName là cây của vụ đó và SeasonCropMismatch = true để câu trả lời nêu rõ dữ liệu không nhất quán.
    string? CropSource = null,
    string? SeasonCropName = null,
    bool SeasonCropMismatch = false,
    AiReferenceProfile? ReferenceProfile = null,
    AiPastSeason? LastCompletedSeason = null);


public sealed record AiProposedControlAction(Guid ActuatorId, ActuatorCommandAction Action, int DurationSeconds);
public sealed record AiSourceView(Guid DocumentId, string Title, string? Organization, string Category, float Similarity, string? ContentSnippet = null, int? PageNumber = null, string? SectionTitle = null);
public sealed record AiProviderRequest(
    string Question,
    AiZoneContext Context,
    IReadOnlyList<KnowledgePassageView>? KnowledgePassages = null);
public sealed record AiProviderResult(
    string ProviderName,
    string Summary,
    string Details,
    decimal Confidence,
    IReadOnlyList<string> Limitations,
    AiProposedControlAction? ProposedControlAction,
    IReadOnlyList<int>? CitedPassageIndexes = null,
    IReadOnlyList<string>? Sources = null);
public sealed record AiWeatherResult(bool Available, string? Summary, decimal? RainProbabilityNext6HoursMaxPercent, decimal? TemperatureCelsius, DateTime? ObservedAtUtc, string? Limitation);

public sealed record AskAiCommand(string Question, Guid? ParentRecommendationId = null);
public sealed record DecideRecommendationCommand(Guid RecommendationId, AiRecommendationDecisionType Decision, string? Reason, string? FollowUpQuestion);
public sealed record AiRecommendationView(
    Guid RecommendationId, Guid ConsultationRequestId, Guid ZoneId, string Question,
    string Summary, string Details, IReadOnlyList<string> Limitations, decimal Confidence,
    AiRecommendationStatus Status, bool IsActionable, DateTime ValidUntilUtc,
    Guid? ProposedActuatorId, ActuatorCommandAction? ProposedAction, int? ProposedDurationSeconds,
    DateTime CreatedAtUtc,
    IReadOnlyList<AiSourceView>? Sources = null,
    string? ContextSnapshotJson = null);
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
