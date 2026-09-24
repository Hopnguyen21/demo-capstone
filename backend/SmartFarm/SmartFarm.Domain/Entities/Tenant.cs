using SmartFarm.Domain.Common;
using SmartFarm.Domain.Enums;

namespace SmartFarm.Domain.Entities;

public sealed class Tenant : AuditableEntity
{
    public string CompanyName { get; set; } = string.Empty;
    public string Subdomain { get; set; } = string.Empty;
    public string? TaxCode { get; set; }
    public string? Address { get; set; }
    public string? LogoUrl { get; set; }
    public TenantStatus Status { get; set; } = TenantStatus.Active;

    public ICollection<AppUser> Users { get; } = new List<AppUser>();
    public ICollection<Farm> Farms { get; } = new List<Farm>();
}
