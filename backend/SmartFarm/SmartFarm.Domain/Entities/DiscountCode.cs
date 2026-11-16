using SmartFarm.Domain.Common;

namespace SmartFarm.Domain.Entities;

public enum DiscountType
{
    Percentage = 1,
    FixedAmount = 2
}

public sealed class DiscountCode : AuditableEntity
{
    public string Code { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public DiscountType DiscountType { get; set; } = DiscountType.Percentage;
    public decimal DiscountValue { get; set; }
    public decimal MinContractValue { get; set; } = 0;
    public decimal? MaxDiscountAmount { get; set; }
    public DateTime? StartDateUtc { get; set; }
    public DateTime? EndDateUtc { get; set; }
    public int? UsageLimit { get; set; }
    public int UsedCount { get; set; } = 0;
    public bool IsActive { get; set; } = true;
    public Guid CreatedByUserId { get; set; }
    public AppUser? CreatedByUser { get; set; }
}
