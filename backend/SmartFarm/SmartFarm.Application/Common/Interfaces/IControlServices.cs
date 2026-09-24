using SmartFarm.Application.Features.Control;
using SmartFarm.Domain.Enums;

namespace SmartFarm.Application.Common.Interfaces;

public interface IActuatorCommandTransport
{
    Task<CommandTransportResult> PublishAsync(CommandDispatchEnvelope command, CancellationToken cancellationToken);
    Task<CommandTransportResult> PublishEmergencyStopAsync(CommandDispatchEnvelope command, CancellationToken cancellationToken);
}

public interface IActuatorFeedbackAdapter
{
    Task<ActuatorCommandView> ReceiveAsync(MqttActuatorFeedbackMessage message, CancellationToken cancellationToken);
}

public interface IRainForecastProvider
{
    Task<RainForecastResult> GetAsync(Guid farmId, CancellationToken cancellationToken);
}

public interface IControlService
{
    Task<IReadOnlyList<ScheduleView>> ListSchedulesAsync(Guid userId, Guid tenantId, Guid zoneId, CancellationToken ct);
    Task<ScheduleView> CreateScheduleAsync(Guid ownerId, Guid tenantId, Guid zoneId, CreateScheduleCommand command, CancellationToken ct);
    Task<ScheduleView> UpdateScheduleAsync(Guid ownerId, Guid tenantId, Guid zoneId, Guid scheduleId, UpdateScheduleCommand command, CancellationToken ct);
    Task ArchiveScheduleAsync(Guid ownerId, Guid tenantId, Guid zoneId, Guid scheduleId, CancellationToken ct);
    Task<IReadOnlyList<AutoRuleView>> ListRulesAsync(Guid userId, Guid tenantId, Guid zoneId, CancellationToken ct);
    Task<AutoRuleView> CreateRuleAsync(Guid ownerId, Guid tenantId, Guid zoneId, CreateAutoRuleCommand command, CancellationToken ct);
    Task<AutoRuleView> UpdateRuleAsync(Guid ownerId, Guid tenantId, Guid zoneId, Guid ruleId, UpdateAutoRuleCommand command, CancellationToken ct);
    Task ArchiveRuleAsync(Guid ownerId, Guid tenantId, Guid zoneId, Guid ruleId, CancellationToken ct);
    Task<ActuatorCommandView> CreateManualCommandAsync(Guid userId, Guid tenantId, Guid zoneId, Guid actuatorId, ManualCommandRequest request, CancellationToken ct);
    Task<ActuatorStatusView> GetStatusAsync(Guid userId, Guid tenantId, Guid zoneId, Guid actuatorId, CancellationToken ct);
    Task<ActuatorCommandView> CancelAsync(Guid userId, Guid tenantId, Guid zoneId, Guid commandId, string reason, CancellationToken ct);
    Task<CommandHistoryView> HistoryAsync(Guid userId, Guid tenantId, Guid zoneId, DateTime fromUtc, DateTime toUtc, int limit, CancellationToken ct);
    Task<ActuatorCommandView> ApplyFeedbackAsync(ActuatorFeedbackEnvelope feedback, CancellationToken ct);
    Task<int> ExpireTimedOutAsync(DateTime nowUtc, CancellationToken ct);
    Task<int> ProcessDueSchedulesAsync(DateTime nowUtc, CancellationToken ct);
    Task<int> EvaluateRulesAsync(Guid zoneId, CancellationToken ct);
}
