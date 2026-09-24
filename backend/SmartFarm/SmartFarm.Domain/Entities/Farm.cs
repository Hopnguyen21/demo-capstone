using SmartFarm.Domain.Common;
using SmartFarm.Domain.Enums;

namespace SmartFarm.Domain.Entities;

public sealed class Farm : AuditableEntity
{
    public Guid TenantId { get; set; }
    public Tenant Tenant { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public string? LocationText { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public decimal TotalAreaM2 { get; set; }
    public string TimeZone { get; set; } = "Asia/Ho_Chi_Minh";
    public FarmStatus Status { get; set; } = FarmStatus.Active;
    public DateTime? ArchivedAtUtc { get; set; }

    public ICollection<Field> Fields { get; } = new List<Field>();
    public ICollection<AppUser> Farmers { get; } = new List<AppUser>();
}
