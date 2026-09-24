using SmartFarm.Domain.Enums;

namespace SmartFarm.Application.Features.Finance;

public sealed record CreateFinanceCommand(decimal Amount, DateTime OccurredAtUtc, string Description, string? Reference, ExpenseCategory? ExpenseCategory);
public sealed record UpdateFinanceCommand(decimal Amount, DateTime OccurredAtUtc, string Description, string? Reference, ExpenseCategory? ExpenseCategory);
public sealed record FinanceTransactionView(Guid Id, Guid FarmId, FinanceTransactionType Type, ExpenseCategory? ExpenseCategory, decimal Amount, DateTime OccurredAtUtc, string Description, string? Reference, DateTime CreatedAtUtc);
public sealed record CashFlowReportView(Guid FarmId, DateTime? FromUtc, DateTime? ToUtc, decimal Revenue, decimal Expense, decimal NetCashFlow, IReadOnlyDictionary<ExpenseCategory, decimal> ExpensesByCategory);

public sealed record CreateServiceRequestCommand(Guid ZoneId, Guid DeviceId, string FailureCode, string Description);
public sealed record AssignServiceRequestCommand(Guid TechnicianUserId, string? Notes);
public sealed record DiagnoseServiceRequestCommand(string InspectionNotes, string Diagnosis, ServiceResolutionAction ResolutionAction);
public sealed record RecordServiceWorkCommand(string WorkPerformed);
public sealed record ReplaceServiceDeviceCommand(Guid NewDeviceId, string? Notes);
public sealed record ServiceConnectionTestCommand(bool Succeeded, decimal? Rssi, decimal? Snr, int? RoundTripLatencyMs, DateTime ObservedAtUtc, string? ErrorCode, string? ErrorMessage);
public sealed record ServiceHistoryView(Guid Id, ServiceHistoryEventType EventType, ServiceRequestStatus FromStatus, ServiceRequestStatus ToStatus, Guid ActorUserId, string? Notes, DateTime CreatedAtUtc);
public sealed record DeviceReplacementView(Guid Id, Guid OldDeviceId, Guid NewDeviceId, Guid ZoneId, DateTime CreatedAtUtc);
public sealed record ServiceRequestView(Guid Id, Guid TenantId, Guid FarmId, Guid ZoneId, Guid? OriginalDeviceId, Guid? CurrentDeviceId, string FailureCode, string Description, ServiceRequestStatus Status, Guid? AssignedTechnicianId, string? InspectionNotes, string? Diagnosis, ServiceResolutionAction? ResolutionAction, string? WorkPerformed, DateTime? ClosedAtUtc, IReadOnlyList<ServiceHistoryView> History, IReadOnlyList<DeviceReplacementView> Replacements);

public interface IFinanceService
{
    Task<IReadOnlyList<FinanceTransactionView>> ListAsync(Guid ownerId, Guid tenantId, Guid farmId, DateTime? fromUtc, DateTime? toUtc, CancellationToken ct);
    Task<FinanceTransactionView> CreateAsync(Guid ownerId, Guid tenantId, Guid farmId, FinanceTransactionType type, CreateFinanceCommand command, CancellationToken ct);
    Task<FinanceTransactionView> UpdateAsync(Guid ownerId, Guid tenantId, Guid farmId, Guid id, UpdateFinanceCommand command, CancellationToken ct);
    Task ArchiveAsync(Guid ownerId, Guid tenantId, Guid farmId, Guid id, CancellationToken ct);
    Task<CashFlowReportView> ReportAsync(Guid ownerId, Guid tenantId, Guid farmId, DateTime? fromUtc, DateTime? toUtc, CancellationToken ct);
}

public interface IServiceRequestService
{
    Task<ServiceRequestView> CreateAsync(Guid ownerId, Guid tenantId, Guid farmId, CreateServiceRequestCommand command, CancellationToken ct);
    Task<IReadOnlyList<ServiceRequestView>> ListAsync(Guid userId, Guid? tenantId, CancellationToken ct);
    Task<ServiceRequestView> GetAsync(Guid userId, Guid? tenantId, Guid requestId, CancellationToken ct);
    Task<ServiceRequestView> AssignAsync(Guid adminId, Guid requestId, AssignServiceRequestCommand command, CancellationToken ct);
    Task<ServiceRequestView> AcceptAsync(Guid technicianId, Guid requestId, CancellationToken ct);
    Task<ServiceRequestView> DiagnoseAsync(Guid technicianId, Guid requestId, DiagnoseServiceRequestCommand command, CancellationToken ct);
    Task<ServiceRequestView> RecordWorkAsync(Guid technicianId, Guid requestId, RecordServiceWorkCommand command, CancellationToken ct);
    Task<ServiceRequestView> ReplaceAsync(Guid technicianId, Guid requestId, ReplaceServiceDeviceCommand command, CancellationToken ct);
    Task<ServiceRequestView> HotSwapAsync(Guid technicianId, Guid zoneId, Guid oldDeviceId, Guid requestId, ReplaceServiceDeviceCommand command, CancellationToken ct);
    Task<ServiceRequestView> TestAsync(Guid technicianId, Guid requestId, ServiceConnectionTestCommand command, CancellationToken ct);
    Task<ServiceRequestView> CloseAsync(Guid technicianId, Guid requestId, CancellationToken ct);
}
