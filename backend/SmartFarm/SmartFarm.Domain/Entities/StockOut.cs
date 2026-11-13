using SmartFarm.Domain.Common;
using SmartFarm.Domain.Enums;

namespace SmartFarm.Domain.Entities;

public sealed class StockOut : AuditableEntity
{
    public Guid TenantId { get; set; }
    public Guid FarmId { get; set; }
    public Farm Farm { get; set; } = null!;
    public Guid? ZoneId { get; set; }
    public Zone? Zone { get; set; }
    public string StockOutCode { get; set; } = string.Empty;
    public StockOutStatus Status { get; set; } = StockOutStatus.Draft;
    public Guid CreatedByUserId { get; set; }
    public AppUser? CreatedByUser { get; set; }
    public Guid? ApprovedByUserId { get; set; }
    public AppUser? ApprovedByUser { get; set; }
    public DateTime? CompletedAtUtc { get; set; }
    public string? Notes { get; set; }

    public ICollection<StockOutDetail> Details { get; set; } = new List<StockOutDetail>();
}

public sealed class StockOutDetail : AuditableEntity
{
    public Guid StockOutId { get; set; }
    public StockOut StockOut { get; set; } = null!;
    public Guid InventoryItemId { get; set; }
    public InventoryItem? InventoryItem { get; set; }
    public decimal Quantity { get; set; }
    public string? Notes { get; set; }
}

