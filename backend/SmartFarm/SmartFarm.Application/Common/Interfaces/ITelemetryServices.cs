using SmartFarm.Application.Features.TelemetryAlerts;
using SmartFarm.Domain.Enums;

namespace SmartFarm.Application.Common.Interfaces;

public interface IMqttTelemetryAdapter
{
    Task<TelemetryIngestionResult> ReceiveAsync(MqttInboundMessage message, CancellationToken cancellationToken);
}

public interface ITelemetryIngestionService
{
    Task<TelemetryIngestionResult> IngestAsync(Guid authenticatedGatewayId, TelemetryEnvelope envelope, CancellationToken cancellationToken);
}

public interface ITelemetryAlertService
{
    Task<LatestTelemetryView> LatestAsync(Guid userId, Guid tenantId, Guid zoneId, CancellationToken cancellationToken);
    Task<TelemetryHistoryView> HistoryAsync(Guid userId, Guid tenantId, Guid zoneId, EnvironmentalParameterCode parameterCode, DateTime fromUtc, DateTime toUtc, string interval, CancellationToken cancellationToken);
    Task<TelemetryStatsView> StatsAsync(Guid ownerId, Guid tenantId, Guid zoneId, int days, CancellationToken cancellationToken);
    Task<IReadOnlyList<AlertRuleView>> ListRulesAsync(Guid userId, Guid tenantId, Guid zoneId, CancellationToken cancellationToken);
    Task<AlertRuleView> CreateRuleAsync(Guid ownerId, Guid tenantId, Guid zoneId, CreateAlertRuleCommand command, CancellationToken cancellationToken);
    Task<AlertRuleView> UpdateRuleAsync(Guid ownerId, Guid tenantId, Guid zoneId, Guid ruleId, UpdateAlertRuleCommand command, CancellationToken cancellationToken);
    Task ArchiveRuleAsync(Guid ownerId, Guid tenantId, Guid zoneId, Guid ruleId, CancellationToken cancellationToken);
    Task<IReadOnlyList<AlertView>> ListFarmAlertsAsync(Guid userId, Guid tenantId, Guid farmId, AlertStatus? status, AlertSeverity? severity, CancellationToken cancellationToken);
    Task<IReadOnlyList<AlertView>> ListZoneAlertsAsync(Guid userId, Guid tenantId, Guid zoneId, AlertStatus? status, CancellationToken cancellationToken);
    Task<AlertView> GetAlertAsync(Guid userId, Guid tenantId, Guid alertId, CancellationToken cancellationToken);
    Task<AlertView> AcknowledgeAsync(Guid userId, Guid tenantId, Guid alertId, string? notes, CancellationToken cancellationToken);
    Task<AlertView> ResolveAsync(Guid userId, Guid tenantId, Guid alertId, ResolveAlertCommand command, CancellationToken cancellationToken);
}
