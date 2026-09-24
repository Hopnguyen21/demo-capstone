using SmartFarm.Domain.Common;
using SmartFarm.Domain.Enums;

namespace SmartFarm.Domain.Entities;

public sealed class InventoryItem : AuditableEntity
{
    public Guid TenantId { get; set; }
    public Guid FarmId { get; set; }
    public Farm Farm { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public string NormalizedName { get; set; } = string.Empty;
    public MaterialType MaterialType { get; set; }
    public string Unit { get; set; } = string.Empty;
    public decimal QuantityOnHand { get; set; }
    public decimal LowStockThreshold { get; set; }
    public DateTime? ArchivedAtUtc { get; set; }
    public ICollection<MaterialRequirementLink> Requirements { get; } = new List<MaterialRequirementLink>();
}

public sealed class MaterialRequirementLink : AuditableEntity
{
    public Guid InventoryItemId { get; set; }
    public InventoryItem InventoryItem { get; set; } = null!;
    public Guid? CropId { get; set; }
    public Guid? VarietyId { get; set; }
    public Guid? GrowthStageId { get; set; }
    public decimal? RecommendedQuantity { get; set; }
    public string? Notes { get; set; }
}

public sealed class InventoryTransaction : AuditableEntity
{
    public Guid TenantId { get; set; }
    public Guid FarmId { get; set; }
    public Guid InventoryItemId { get; set; }
    public InventoryItem InventoryItem { get; set; } = null!;
    public InventoryMovementType MovementType { get; set; }
    public decimal Quantity { get; set; }
    public decimal BalanceAfter { get; set; }
    public Guid ActorUserId { get; set; }
    public Guid? ZoneId { get; set; }
    public Guid? FarmTaskId { get; set; }
    public string? Notes { get; set; }
}

public sealed class LowStockAlert : AuditableEntity
{
    public Guid TenantId { get; set; }
    public Guid FarmId { get; set; }
    public Guid InventoryItemId { get; set; }
    public InventoryItem InventoryItem { get; set; } = null!;
    public LowStockAlertStatus Status { get; set; }
    public decimal QuantityAtOpen { get; set; }
    public DateTime OpenedAtUtc { get; set; }
    public DateTime? ResolvedAtUtc { get; set; }
}

public sealed class FarmTask : AuditableEntity
{
    public Guid TenantId { get; set; }
    public Guid FarmId { get; set; }
    public Guid ZoneId { get; set; }
    public Zone Zone { get; set; } = null!;
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Requirements { get; set; }
    public DateTime DueAtUtc { get; set; }
    public Guid AssignedFarmerId { get; set; }
    public AppUser AssignedFarmer { get; set; } = null!;
    public Guid CreatedByOwnerId { get; set; }
    public FarmTaskStatus Status { get; set; } = FarmTaskStatus.Pending;
    public string? Result { get; set; }
    public string? FailureReason { get; set; }
    public DateTime? AcceptedAtUtc { get; set; }
    public DateTime? StartedAtUtc { get; set; }
    public DateTime? SubmittedAtUtc { get; set; }
    public DateTime? ApprovedAtUtc { get; set; }
    public int AssignmentVersion { get; set; } = 1;
    public ICollection<FarmTaskHistory> History { get; } = new List<FarmTaskHistory>();
}

public sealed class FarmTaskHistory : AuditableEntity
{
    public Guid FarmTaskId { get; set; }
    public FarmTask FarmTask { get; set; } = null!;
    public Guid ActorUserId { get; set; }
    public FarmTaskEventType EventType { get; set; }
    public FarmTaskStatus? FromStatus { get; set; }
    public FarmTaskStatus ToStatus { get; set; }
    public Guid? PreviousAssigneeId { get; set; }
    public Guid? NewAssigneeId { get; set; }
    public string? Notes { get; set; }
}
