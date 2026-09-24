using SmartFarm.Domain.Enums;

namespace SmartFarm.Application.Features.Reports;

public sealed record ReportFormula(string Metric, string Formula, string Source);
public sealed record FarmOverviewReport(Guid FarmId, string FarmName, DateTime GeneratedAtUtc, int FieldCount, int ZoneCount, int ActiveSeasonCount, int OnlineDeviceCount, int AlertsLast7Days, int OpenAlertCount, int OpenTaskCount, int LowStockItemCount, int OpenServiceRequestCount, decimal RevenueCurrentMonth, decimal ExpenseCurrentMonth, decimal NetCashFlowCurrentMonth, IReadOnlyList<ReportFormula> Formulas);
public sealed record ResourceUsageBucket(Guid ZoneId, string ZoneName, int Year, int Month, decimal Value, int CountedCommandCount, int UnmeasuredCommandCount);
public sealed record ResourceUsageReport(Guid FarmId, string Metric, string Unit, DateTime FromUtc, DateTime ToUtc, decimal Total, int CountedCommandCount, int UnmeasuredCommandCount, IReadOnlyList<ResourceUsageBucket> Buckets, IReadOnlyList<ReportFormula> Formulas);
public sealed record SeasonSummaryReport(Guid FarmId, Guid ZoneId, Guid SeasonId, string SeasonName, string CropName, string? VarietyName, string GrowthStageName, PlantingSeasonStatus Status, DateOnly StartDate, DateOnly? EndDate, decimal? ActualYieldKg, int AlertCount, int AcknowledgedIrrigationCommandCount, decimal WaterLiters, decimal ElectricityKWh, decimal MaterialIssuedQuantity, decimal? PreviousYieldKg, IReadOnlyList<ReportFormula> Formulas);
public sealed record InventoryReportItem(Guid ItemId, string Name, string Unit, decimal QuantityOnHand, decimal LowStockThreshold, bool IsLowStock, decimal ReceivedQuantity, decimal IssuedQuantity);
public sealed record InventoryReport(Guid FarmId, DateTime FromUtc, DateTime ToUtc, int ItemCount, int LowStockCount, IReadOnlyList<InventoryReportItem> Items, IReadOnlyList<ReportFormula> Formulas);
public sealed record AssigneeTaskCount(Guid FarmerId, string FarmerName, int Pending, int InProgress, int Approved, int Failed, int Overdue);
public sealed record TaskReport(Guid FarmId, DateTime FromUtc, DateTime ToUtc, int Total, int Approved, int Failed, int Overdue, decimal CompletionRatePercent, IReadOnlyList<AssigneeTaskCount> ByAssignee, IReadOnlyList<ReportFormula> Formulas);
public sealed record MaintenanceReportItem(Guid ServiceRequestId, Guid ZoneId, Guid? OriginalDeviceId, Guid? CurrentDeviceId, ServiceRequestStatus Status, ServiceResolutionAction? ResolutionAction, decimal ElapsedHours, int TestCount, bool? LatestTestSucceeded, int ReplacementCount);
public sealed record MaintenanceReport(Guid FarmId, DateTime FromUtc, DateTime ToUtc, int Total, int Open, int Closed, decimal AverageClosedHours, IReadOnlyList<MaintenanceReportItem> Requests, IReadOnlyList<ReportFormula> Formulas);

public interface IReportService
{
    Task<FarmOverviewReport> OverviewAsync(Guid ownerId, Guid tenantId, Guid farmId, CancellationToken ct);
    Task<SeasonSummaryReport> SeasonSummaryAsync(Guid ownerId, Guid tenantId, Guid zoneId, CancellationToken ct);
    Task<ResourceUsageReport> WaterAsync(Guid ownerId, Guid tenantId, Guid farmId, DateTime? fromUtc, DateTime? toUtc, CancellationToken ct);
    Task<ResourceUsageReport> ElectricityAsync(Guid ownerId, Guid tenantId, Guid farmId, DateTime? fromUtc, DateTime? toUtc, CancellationToken ct);
    Task<InventoryReport> InventoryAsync(Guid ownerId, Guid tenantId, Guid farmId, DateTime? fromUtc, DateTime? toUtc, CancellationToken ct);
    Task<TaskReport> TasksAsync(Guid ownerId, Guid tenantId, Guid farmId, DateTime? fromUtc, DateTime? toUtc, CancellationToken ct);
    Task<MaintenanceReport> MaintenanceAsync(Guid ownerId, Guid tenantId, Guid farmId, DateTime? fromUtc, DateTime? toUtc, CancellationToken ct);
}
