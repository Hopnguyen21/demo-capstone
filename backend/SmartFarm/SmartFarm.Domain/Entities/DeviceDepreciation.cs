using SmartFarm.Domain.Common;

namespace SmartFarm.Domain.Entities;

public sealed class DeviceDepreciation : AuditableEntity
{
    public Guid TenantId { get; set; }
    public Tenant Tenant { get; set; } = null!;
    public Guid ZoneId { get; set; }
    public Zone Zone { get; set; } = null!;
    public Guid DeviceId { get; set; }
    public Device Device { get; set; } = null!;
    public Guid CreatedByOwnerId { get; set; }
    public AppUser CreatedByOwner { get; set; } = null!;
    public decimal OriginalCostVnd { get; set; }
    public decimal MonthlyDepreciationVnd { get; set; }
    public decimal AccumulatedDepreciationVnd { get; set; }
    public decimal CurrentBookValueVnd { get; set; }
    public int DepreciationLifetimeMonths { get; set; }
    public string Method { get; set; } = "STRAIGHT_LINE";
    public DateOnly StartDate { get; set; }
    public string? Notes { get; set; }
}
