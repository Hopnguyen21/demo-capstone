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

public sealed record CreateFarmTaskCommand(Guid ZoneId, string Title, string? Description, string? Requirements, DateTime DueAtUtc, Guid AssignedFarmerId);
public sealed record UpdateFarmTaskCommand(FarmTaskAction Action, string? Result, string? FailureReason, Guid? AssignedFarmerId, string? Notes);
public sealed record FarmTaskHistoryView(Guid Id, FarmTaskEventType EventType, FarmTaskStatus? FromStatus, FarmTaskStatus ToStatus, Guid ActorUserId, Guid? PreviousAssigneeId, Guid? NewAssigneeId, string? Notes, DateTime CreatedAtUtc);
public sealed record FarmTaskView(Guid Id, Guid FarmId, Guid ZoneId, string Title, string? Description, string? Requirements, DateTime DueAtUtc, Guid AssignedFarmerId, FarmTaskStatus Status, string? Result, string? FailureReason, int AssignmentVersion, DateTime CreatedAtUtc, IReadOnlyList<FarmTaskHistoryView> History);

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
}
