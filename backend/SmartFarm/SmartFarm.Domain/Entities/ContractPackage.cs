using SmartFarm.Domain.Common;
using SmartFarm.Domain.Enums;

namespace SmartFarm.Domain.Entities;

public sealed class ContractPackage : AuditableEntity
{
    public string PackageName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int DurationMonths { get; set; }
    public int MaxZones { get; set; }
    public decimal Price { get; set; }
    public string Currency { get; set; } = "VND";
    public PackageStatus Status { get; set; } = PackageStatus.Active;
    public Guid CreatedByUserId { get; set; }
    public AppUser? CreatedByUser { get; set; }

    /// <summary>Đánh dấu gói tùy chỉnh riêng cho một khách hàng / hợp đồng cụ thể (không hiện trong danh sách gói chung)</summary>
    public bool IsCustom { get; set; } = false;
    public Guid? TenantId { get; set; }
    public Tenant? Tenant { get; set; }
    public string? CustomerName { get; set; }
    public Guid? ContractId { get; set; }
}

