using SmartFarm.Domain.Common;

namespace SmartFarm.Domain.Entities;

public sealed class GrowthProfile : AuditableEntity
{
    public Guid CropId { get; set; }
    public Crop Crop { get; set; } = null!;
    public Guid? VarietyId { get; set; }
    public CropVariety? Variety { get; set; }
    public Guid? TenantId { get; set; }
    public Tenant? Tenant { get; set; }
    public Guid? SourceProfileId { get; set; }
    public GrowthProfile? SourceProfile { get; set; }
    public Guid? CreatedByUserId { get; set; }
    public AppUser? CreatedByUser { get; set; }
    public string Name { get; set; } = string.Empty;
    public string NormalizedName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsDefault { get; set; }
    public bool IsSystemDefined { get; set; }
    public ICollection<GrowthStage> Stages { get; } = new List<GrowthStage>();
}
