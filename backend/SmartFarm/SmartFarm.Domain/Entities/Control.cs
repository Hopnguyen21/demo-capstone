using SmartFarm.Domain.Common;
using SmartFarm.Domain.Enums;

namespace SmartFarm.Domain.Entities;

public sealed class ControlSchedule : AuditableEntity
{
    public Guid TenantId { get; set; }
    public Guid FarmId { get; set; }
    public Guid ZoneId { get; set; }
    public Zone Zone { get; set; } = null!;
    public Guid ActuatorId { get; set; }
    public DeviceActuator Actuator { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public string CronExpression { get; set; } = string.Empty;
    public int DurationSeconds { get; set; }
    public bool EnableRainDelay { get; set; } = true;
    public decimal RainThresholdPercent { get; set; } = 70;
    public bool IsActive { get; set; } = true;
    public DateTime NextRunAtUtc { get; set; }
    public DateTime? ArchivedAtUtc { get; set; }
}

public sealed class AutoControlRule : AuditableEntity
{
    public Guid TenantId { get; set; }
    public Guid FarmId { get; set; }
    public Guid ZoneId { get; set; }
    public Zone Zone { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public EnvironmentalParameterCode ParameterCode { get; set; }
    public AutoRuleOperator Operator { get; set; }
    public decimal Threshold { get; set; }
    public int ConditionDurationMinutes { get; set; }
    public Guid ActuatorId { get; set; }
    public DeviceActuator Actuator { get; set; } = null!;
    public ActuatorCommandAction Action { get; set; } = ActuatorCommandAction.TurnOn;
    public int DurationSeconds { get; set; }
    public int Priority { get; set; } = 1;
    public int CooldownMinutes { get; set; } = 60;
    public bool EnableRainDelay { get; set; } = true;
    public decimal RainThresholdPercent { get; set; } = 70;
    public bool IsActive { get; set; } = true;
    public DateTime? LastTriggeredAtUtc { get; set; }
    public DateTime? ConditionTrueSinceUtc { get; set; }
    public DateTime? ArchivedAtUtc { get; set; }
}

public sealed class ActuatorCommand : AuditableEntity
{
    public Guid TenantId { get; set; }
    public Guid FarmId { get; set; }
    public Guid ZoneId { get; set; }
    public Zone Zone { get; set; } = null!;
    public Guid ActuatorId { get; set; }
    public DeviceActuator Actuator { get; set; } = null!;
    public Guid DeviceId { get; set; }
    public Device Device { get; set; } = null!;
    public Guid GatewayId { get; set; }
    public Gateway Gateway { get; set; } = null!;
    public Guid? TriggeredByUserId { get; set; }
    public AppUser? TriggeredByUser { get; set; }
    public Guid? ScheduleId { get; set; }
    public ControlSchedule? Schedule { get; set; }
    public Guid? AutoRuleId { get; set; }
    public AutoControlRule? AutoRule { get; set; }
    public Guid? RecommendationId { get; set; }
    public AiRecommendation? Recommendation { get; set; }
    public string IdempotencyKey { get; set; } = string.Empty;
    public CommandTriggerSource TriggerSource { get; set; }
    public ActuatorCommandAction Action { get; set; }
    public int DurationSeconds { get; set; }
    public ActuatorCommandStatus Status { get; set; } = ActuatorCommandStatus.Pending;
    public string? Notes { get; set; }
    public DateTime QueuedAtUtc { get; set; }
    public DateTime? SentAtUtc { get; set; }
    public DateTime? AckDeadlineAtUtc { get; set; }
    public DateTime? AcknowledgedAtUtc { get; set; }
    public DateTime? ExecutionEndsAtUtc { get; set; }
    public DateTime? CancellationRequestedAtUtc { get; set; }
    public DateTime? TerminalAtUtc { get; set; }
    public string? ObservedState { get; set; }
    public string? ErrorCode { get; set; }
    public string? ErrorMessage { get; set; }
    public ICollection<ActuatorCommandEvent> Events { get; } = new List<ActuatorCommandEvent>();
}

public sealed class ActuatorCommandEvent : AuditableEntity
{
    public Guid CommandId { get; set; }
    public ActuatorCommand Command { get; set; } = null!;
    public CommandEventKind EventKind { get; set; }
    public ActuatorCommandStatus Status { get; set; }
    public DateTime OccurredAtUtc { get; set; }
    public string? Detail { get; set; }
    public string? ObservedState { get; set; }
}
