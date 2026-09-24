using SmartFarm.Domain.Common;

namespace SmartFarm.Domain.Entities;

public sealed class CropVariety : AuditableEntity
{
    public Guid CropId { get; set; }
    public Crop Crop { get; set; } = null!;
    public Guid? TenantId { get; set; }
    public Tenant? Tenant { get; set; }
    public Guid? CreatedByUserId { get; set; }
    public AppUser? CreatedByUser { get; set; }
    public string Name { get; set; } = string.Empty;
    public string NormalizedName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsSystemDefined { get; set; }
    public ICollection<GrowthProfile> GrowthProfiles { get; } = new List<GrowthProfile>();
}
