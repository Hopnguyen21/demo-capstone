using SmartFarm.Domain.Common;
using SmartFarm.Domain.Enums;

namespace SmartFarm.Domain.Entities;

public sealed class StockIn : AuditableEntity
{
    public Guid TenantId { get; set; }
    public Guid FarmId { get; set; }
    public Farm Farm { get; set; } = null!;
    public string StockInCode { get; set; } = string.Empty;
    public string? SupplierName { get; set; }
    public StockInStatus Status { get; set; } = StockInStatus.Draft;
    public Guid CreatedByUserId { get; set; }
    public AppUser? CreatedByUser { get; set; }
    public Guid? ApprovedByUserId { get; set; }
    public AppUser? ApprovedByUser { get; set; }
    public DateTime? CompletedAtUtc { get; set; }
    public string? Notes { get; set; }

    public ICollection<StockInDetail> Details { get; set; } = new List<StockInDetail>();
}

public sealed class StockInDetail : AuditableEntity
{
    public Guid StockInId { get; set; }
    public StockIn StockIn { get; set; } = null!;
    public Guid InventoryItemId { get; set; }
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public string? Notes { get; set; }
}
