using SmartFarm.Domain.Enums;

namespace SmartFarm.Application.Features.TelemetryAlerts;

public sealed record GatewayTransportIdentity(string ClientId, string CertificateFingerprint);
public sealed record MqttInboundMessage(string Topic, GatewayTransportIdentity Identity, ReadOnlyMemory<byte> Payload);
public sealed record TelemetryValueInput(EnvironmentalParameterCode ParameterCode, decimal Value, string Unit);
public sealed record TelemetryEnvelope(string MessageId, Guid DeviceId, Guid ZoneId, DateTime CapturedAtUtc, IReadOnlyList<TelemetryValueInput> Readings);
public sealed record TelemetryIngestionResult(Guid GatewayId, Guid DeviceId, Guid ZoneId, string MessageId, bool IsDuplicate, int StoredReadings, int AlertsCreated);

public sealed record LatestMetricView(EnvironmentalParameterCode ParameterCode, decimal Value, string Unit, DateTime CapturedAtUtc, DateTime ReceivedAtUtc, bool IsFresh, string ThresholdStatus);
public sealed record LatestTelemetryView(Guid ZoneId, DateTime? LatestReceivedAtUtc, bool HasFreshTelemetry, IReadOnlyList<LatestMetricView> Metrics);
public sealed record TelemetryHistoryPoint(DateTime BucketStartUtc, decimal Average, decimal Minimum, decimal Maximum, int Count);
public sealed record TelemetryHistoryView(Guid ZoneId, EnvironmentalParameterCode ParameterCode, string Interval, IReadOnlyList<TelemetryHistoryPoint> Data);
public sealed record MetricStatsView(EnvironmentalParameterCode ParameterCode, decimal Average, decimal Minimum, decimal Maximum, string Trend);
public sealed record TelemetryStatsView(Guid ZoneId, int Days, IReadOnlyList<MetricStatsView> Metrics, int AlertsCount);

public sealed record CreateAlertRuleCommand(EnvironmentalParameterCode ParameterCode, decimal MinThreshold, decimal MaxThreshold, AlertSeverity Severity, int CooldownMinutes);
public sealed record UpdateAlertRuleCommand(decimal MinThreshold, decimal MaxThreshold, AlertSeverity Severity, int CooldownMinutes, bool IsActive);
public sealed record AlertRuleView(Guid RuleId, Guid ZoneId, Guid GrowthStageId, EnvironmentalParameterCode ParameterCode, decimal MinThreshold, decimal MaxThreshold, AlertSeverity Severity, int CooldownMinutes, bool IsActive, bool IsSystemGenerated);

public sealed record AlertHistoryView(Guid EventId, Guid? ActorUserId, AlertEventType EventType, string? ActionTaken, string? Notes, DateTime CreatedAtUtc);
public sealed record AlertView(Guid AlertId, Guid FarmId, Guid ZoneId, Guid DeviceId, Guid GrowthStageId, EnvironmentalParameterCode ParameterCode, decimal ObservedValue, decimal MinThreshold, decimal MaxThreshold, string Unit, AlertSeverity Severity, AlertStatus Status, string Title, DateTime CreatedAtUtc, DateTime? AcknowledgedAtUtc, DateTime? ResolvedAtUtc, IReadOnlyList<AlertHistoryView> History);
public sealed record ResolveAlertCommand(string ActionTaken, string? Notes);
