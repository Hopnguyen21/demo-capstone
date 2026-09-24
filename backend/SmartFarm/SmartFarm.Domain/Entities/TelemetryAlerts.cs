using SmartFarm.Domain.Common;
using SmartFarm.Domain.Enums;

namespace SmartFarm.Domain.Entities;

public sealed class TelemetryReading : AuditableEntity
{
    public Guid TenantId { get; set; }
    public Guid FarmId { get; set; }
    public Guid ZoneId { get; set; }
    public Zone Zone { get; set; } = null!;
    public Guid DeviceId { get; set; }
    public Device Device { get; set; } = null!;
    public Guid GatewayId { get; set; }
    public Gateway Gateway { get; set; } = null!;
    public string MessageId { get; set; } = string.Empty;
    public EnvironmentalParameterCode ParameterCode { get; set; }
    public decimal Value { get; set; }
    public string Unit { get; set; } = string.Empty;
    public DateTime CapturedAtUtc { get; set; }
    public DateTime ReceivedAtUtc { get; set; }
}

public sealed class AlertRule : AuditableEntity
{
    public Guid ZoneId { get; set; }
    public Zone Zone { get; set; } = null!;
    public Guid GrowthStageId { get; set; }
    public GrowthStage GrowthStage { get; set; } = null!;
    public EnvironmentalParameterCode ParameterCode { get; set; }
    public decimal MinThreshold { get; set; }
    public decimal MaxThreshold { get; set; }
    public AlertSeverity Severity { get; set; }
    public int CooldownMinutes { get; set; } = 30;
    public bool IsActive { get; set; } = true;
    public bool IsSystemGenerated { get; set; }
    public DateTime? ArchivedAtUtc { get; set; }
    public ICollection<AlertRuleEvaluationState> EvaluationStates { get; } = new List<AlertRuleEvaluationState>();
}

public sealed class AlertRuleEvaluationState
{
    public Guid AlertRuleId { get; set; }
    public AlertRule AlertRule { get; set; } = null!;
    public Guid DeviceId { get; set; }
    public Device Device { get; set; } = null!;
    public int ConsecutiveViolationCount { get; set; }
    public DateTime? LastViolationAtUtc { get; set; }
    public DateTime? LastAlertAtUtc { get; set; }
    public string? LastMessageId { get; set; }
}

public sealed class Alert : AuditableEntity
{
    public Guid TenantId { get; set; }
    public Guid FarmId { get; set; }
    public Guid ZoneId { get; set; }
    public Zone Zone { get; set; } = null!;
    public Guid DeviceId { get; set; }
    public Device Device { get; set; } = null!;
    public Guid AlertRuleId { get; set; }
    public AlertRule AlertRule { get; set; } = null!;
    public Guid PlantingSeasonId { get; set; }
    public Guid GrowthStageId { get; set; }
    public EnvironmentalParameterCode ParameterCode { get; set; }
    public decimal ObservedValue { get; set; }
    public decimal MinThreshold { get; set; }
    public decimal MaxThreshold { get; set; }
    public string Unit { get; set; } = string.Empty;
    public AlertSeverity Severity { get; set; }
    public AlertStatus Status { get; set; } = AlertStatus.Open;
    public string Title { get; set; } = string.Empty;
    public DateTime? AcknowledgedAtUtc { get; set; }
    public DateTime? ResolvedAtUtc { get; set; }
    public ICollection<AlertHistoryEvent> History { get; } = new List<AlertHistoryEvent>();
}

public sealed class AlertHistoryEvent : AuditableEntity
{
    public Guid AlertId { get; set; }
    public Alert Alert { get; set; } = null!;
    public Guid? ActorUserId { get; set; }
    public AppUser? ActorUser { get; set; }
    public AlertEventType EventType { get; set; }
    public string? ActionTaken { get; set; }
    public string? Notes { get; set; }
}
