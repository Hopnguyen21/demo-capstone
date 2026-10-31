using SmartFarm.Domain.Enums;

namespace SmartFarm.Application.Features.Inventory;

public sealed record MaterialRequirementCommand(Guid? CropId, Guid? VarietyId, Guid? GrowthStageId, decimal? RecommendedQuantity, string? Notes);
public sealed record CreateInventoryItemCommand(string Name, MaterialType MaterialType, string Unit, decimal LowStockThreshold, decimal InitialQuantity, IReadOnlyList<MaterialRequirementCommand>? Requirements);
public sealed record ReceiveInventoryCommand(decimal Quantity, string? Notes);
public sealed record IssueInventoryCommand(Guid InventoryItemId, decimal Quantity, Guid ZoneId, Guid? TaskId, string? Notes);
public sealed record MaterialRequirementView(Guid Id, Guid? CropId, Guid? VarietyId, Guid? GrowthStageId, decimal? RecommendedQuantity, string? Notes);
public sealed record InventoryItemView(Guid Id, Guid FarmId, string Name, MaterialType MaterialType, string Unit, decimal QuantityOnHand, decimal LowStockThreshold, bool IsLowStock, IReadOnlyList<MaterialRequirementView> Requirements);
public sealed record InventoryMovementView(Guid Id, Guid ItemId, InventoryMovementType Type, decimal Quantity, decimal BalanceAfter, Guid? ZoneId, Guid? TaskId, DateTime CreatedAtUtc);
public sealed record LowStockAlertView(Guid Id, Guid ItemId, string ItemName, LowStockAlertStatus Status, decimal QuantityAtOpen, DateTime OpenedAtUtc, DateTime? ResolvedAtUtc);

public sealed record CreateFarmTaskCommand(Guid ZoneId, string Title, string? Description, string? Requirements, DateTime DueAtUtc, IReadOnlyList<Guid> FarmerIds);
/// <summary>FarmerId: Farmer mục tiêu khi Owner duyệt/giao lại; Farmer luôn chỉ thao tác trên phân công của chính mình. ProgressPercent: 0-100 cho UpdateProgress.</summary>
public sealed record UpdateFarmTaskCommand(FarmTaskAction Action, string? Result, string? FailureReason, Guid? FarmerId, int? ProgressPercent, string? Notes);
/// <summary>NewDueAtUtc: đặt hạn mới (UTC, ở tương lai) khi giao lại công việc đã quá hạn.</summary>
public sealed record AddTaskAssigneesCommand(IReadOnlyList<Guid> FarmerIds, DateTime? NewDueAtUtc = null);
public sealed record FarmTaskHistoryView(Guid Id, FarmTaskEventType EventType, FarmTaskStatus? FromStatus, FarmTaskStatus ToStatus, Guid ActorUserId, Guid? SubjectFarmerId, string? Notes, DateTime CreatedAtUtc);
public sealed record FarmTaskAssignmentView(Guid Id, Guid FarmerId, string FarmerName, FarmTaskStatus Status, int ProgressPercent, string? ProgressNote, string? Result, string? FailureReason, int AssignmentVersion, DateTime AssignedAtUtc, DateTime? AcceptedAtUtc, DateTime? StartedAtUtc, DateTime? SubmittedAtUtc, DateTime? ApprovedAtUtc);
public sealed record FarmTaskView(Guid Id, Guid FarmId, Guid ZoneId, string Title, string? Description, string? Requirements, DateTime DueAtUtc, FarmTaskStatus Status, DateTime CreatedAtUtc, IReadOnlyList<FarmTaskAssignmentView> Assignments, IReadOnlyList<FarmTaskHistoryView> History);

public interface IInventoryTaskService
{
    Task<IReadOnlyList<InventoryItemView>> ListInventoryAsync(Guid userId, Guid tenantId, Guid farmId, CancellationToken ct);
    Task<InventoryItemView> CreateItemAsync(Guid ownerId, Guid tenantId, Guid farmId, CreateInventoryItemCommand command, CancellationToken ct);
    Task<InventoryMovementView> ReceiveAsync(Guid ownerId, Guid tenantId, Guid farmId, Guid itemId, ReceiveInventoryCommand command, CancellationToken ct);
    Task<InventoryItemView> ReplaceRequirementsAsync(Guid ownerId, Guid tenantId, Guid farmId, Guid itemId, IReadOnlyList<MaterialRequirementCommand> requirements, CancellationToken ct);
    Task<InventoryMovementView> IssueAsync(Guid userId, Guid tenantId, Guid farmId, IssueInventoryCommand command, CancellationToken ct);
    Task<IReadOnlyList<LowStockAlertView>> ListLowStockAlertsAsync(Guid ownerId, Guid tenantId, Guid farmId, CancellationToken ct);
    Task<IReadOnlyList<FarmTaskView>> ListTasksAsync(Guid userId, Guid tenantId, Guid farmId, CancellationToken ct);
    Task<FarmTaskView> CreateTaskAsync(Guid ownerId, Guid tenantId, Guid farmId, CreateFarmTaskCommand command, CancellationToken ct);
    Task<FarmTaskView> UpdateTaskAsync(Guid userId, Guid tenantId, Guid farmId, Guid taskId, UpdateFarmTaskCommand command, CancellationToken ct);
    Task<FarmTaskView> AddAssigneesAsync(Guid ownerId, Guid tenantId, Guid farmId, Guid taskId, AddTaskAssigneesCommand command, CancellationToken ct);
    Task<FarmTaskView> RemoveAssigneeAsync(Guid ownerId, Guid tenantId, Guid farmId, Guid taskId, Guid farmerId, CancellationToken ct);
}
