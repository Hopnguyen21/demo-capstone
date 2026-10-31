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
    public Guid CreatedByOwnerId { get; set; }
    /// <summary>Trạng thái tổng hợp từ các phân công đang hiệu lực (xem FarmTaskAggregate); không do một Farmer đơn lẻ quyết định.</summary>
    public FarmTaskStatus Status { get; set; } = FarmTaskStatus.Pending;
    public ICollection<FarmTaskAssignment> Assignments { get; } = new List<FarmTaskAssignment>();
    public ICollection<FarmTaskHistory> History { get; } = new List<FarmTaskHistory>();
}

/// <summary>Một cặp Công việc–Farmer với trạng thái, tiến độ và kết quả riêng; Farmer này không ảnh hưởng đến Farmer khác.</summary>
public sealed class FarmTaskAssignment : AuditableEntity
{
    public Guid FarmTaskId { get; set; }
    public FarmTask FarmTask { get; set; } = null!;
    public Guid FarmerId { get; set; }
    public AppUser Farmer { get; set; } = null!;
    public Guid AssignedByOwnerId { get; set; }
    public DateTime AssignedAtUtc { get; set; }
    public FarmTaskStatus Status { get; set; } = FarmTaskStatus.Pending;
    public int ProgressPercent { get; set; }
    public string? ProgressNote { get; set; }
    public string? Result { get; set; }
    public string? FailureReason { get; set; }
    public DateTime? AcceptedAtUtc { get; set; }
    public DateTime? StartedAtUtc { get; set; }
    public DateTime? SubmittedAtUtc { get; set; }
    public DateTime? ApprovedAtUtc { get; set; }
    /// <summary>Tăng mỗi lần giao lại cho cùng Farmer sau khi bị gỡ/từ chối/thất bại.</summary>
    public int AssignmentVersion { get; set; } = 1;
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
    /// <summary>Farmer mà sự kiện này nói tới (null = sự kiện chung của công việc). Dùng để Farmer chỉ thấy lịch sử của chính mình.</summary>
    public Guid? SubjectFarmerId { get; set; }
    public string? Notes { get; set; }
}
