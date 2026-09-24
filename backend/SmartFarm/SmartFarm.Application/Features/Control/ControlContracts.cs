using SmartFarm.Domain.Enums;

namespace SmartFarm.Application.Features.Control;

public sealed record CreateScheduleCommand(string Name, Guid ActuatorId, string CronExpression, int DurationSeconds, bool EnableRainDelay, decimal RainThresholdPercent);
public sealed record UpdateScheduleCommand(string Name, string CronExpression, int DurationSeconds, bool EnableRainDelay, decimal RainThresholdPercent, bool IsActive);
public sealed record ScheduleView(Guid ScheduleId, Guid ZoneId, Guid ActuatorId, string Name, string CronExpression, int DurationSeconds, bool EnableRainDelay, decimal RainThresholdPercent, bool IsActive, DateTime NextRunAtUtc);

public sealed record CreateAutoRuleCommand(string Name, EnvironmentalParameterCode ParameterCode, AutoRuleOperator Operator, decimal Threshold, int ConditionDurationMinutes, Guid ActuatorId, ActuatorCommandAction Action, int DurationSeconds, int Priority, int CooldownMinutes, bool EnableRainDelay, decimal RainThresholdPercent);
public sealed record UpdateAutoRuleCommand(string Name, decimal Threshold, int ConditionDurationMinutes, ActuatorCommandAction Action, int DurationSeconds, int Priority, int CooldownMinutes, bool EnableRainDelay, decimal RainThresholdPercent, bool IsActive);
public sealed record AutoRuleView(Guid RuleId, Guid ZoneId, string Name, EnvironmentalParameterCode ParameterCode, AutoRuleOperator Operator, decimal Threshold, int ConditionDurationMinutes, Guid ActuatorId, ActuatorCommandAction Action, int DurationSeconds, int Priority, int CooldownMinutes, bool EnableRainDelay, decimal RainThresholdPercent, bool IsActive, DateTime? LastTriggeredAtUtc);

public sealed record ManualCommandRequest(ActuatorCommandAction Action, int DurationSeconds, bool OverrideActiveSchedules, string IdempotencyKey, string? Notes);
public sealed record CommandEventView(Guid EventId, CommandEventKind EventKind, ActuatorCommandStatus Status, DateTime OccurredAtUtc, string? Detail, string? ObservedState);
public sealed record ActuatorCommandView(Guid CommandId, Guid ZoneId, Guid ActuatorId, Guid DeviceId, CommandTriggerSource TriggerSource, Guid? TriggeredByUserId, ActuatorCommandAction Action, int DurationSeconds, ActuatorCommandStatus Status, DateTime QueuedAtUtc, DateTime? SentAtUtc, DateTime? AcknowledgedAtUtc, DateTime? ExecutionEndsAtUtc, DateTime? CancellationRequestedAtUtc, string? ObservedState, string? ErrorCode, string? ErrorMessage, IReadOnlyList<CommandEventView> Events);
public sealed record ActuatorStatusView(Guid ActuatorId, string ActuatorType, string CurrentState, Guid? CommandId, DateTime? FeedbackAtUtc, DateTime? ExecutionEndsAtUtc, int? RemainingSeconds);
public sealed record CommandHistoryView(Guid ZoneId, IReadOnlyList<ActuatorCommandView> Commands);

public sealed record CommandDispatchEnvelope(Guid CommandId, Guid GatewayId, Guid DeviceId, Guid ActuatorId, ActuatorCommandAction Action, int DurationSeconds, DateTime HardwareCutoffAtUtc);
public sealed record CommandTransportResult(bool Published, string? ErrorCode = null, string? ErrorMessage = null);
public sealed record ActuatorFeedbackEnvelope(Guid GatewayId, Guid CommandId, Guid DeviceId, ActuatorCommandStatus Status, string? ObservedState, DateTime OccurredAtUtc, string? ErrorCode, string? ErrorMessage);
public sealed record MqttActuatorFeedbackMessage(string Topic, TelemetryAlerts.GatewayTransportIdentity Identity, ReadOnlyMemory<byte> Payload);
public sealed record RainForecastResult(bool Available, decimal? ProbabilityPercent);
