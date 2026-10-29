using SmartFarm.Domain.Common;

namespace SmartFarm.Domain.Entities;

public sealed class Crop : AuditableEntity
{
    public Guid? TenantId { get; set; }
    public Tenant? Tenant { get; set; }
    public Guid? CreatedByUserId { get; set; }
    public AppUser? CreatedByUser { get; set; }
    public string Name { get; set; } = string.Empty;
    public string NormalizedName { get; set; } = string.Empty;
    public string ScientificName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsSystemDefined { get; set; }
    
    // Vi khí hậu tối ưu & kế hoạch canh tác chuẩn hóa
    public string? Category { get; set; }
    public int? GrowthCycleDays { get; set; }
    public decimal? OptimalTemperatureMin { get; set; }
    public decimal? OptimalTemperatureMax { get; set; }
    public decimal? OptimalSoilMoistureMin { get; set; }
    public decimal? OptimalSoilMoistureMax { get; set; }
    public decimal? OptimalPhMin { get; set; }
    public decimal? OptimalPhMax { get; set; }
    public decimal? OptimalEcMin { get; set; }
    public decimal? OptimalEcMax { get; set; }
    public decimal? OptimalLux { get; set; }
    public string? CalendarIrrigationPlan { get; set; }

    public ICollection<CropVariety> Varieties { get; } = new List<CropVariety>();
    public ICollection<GrowthProfile> GrowthProfiles { get; } = new List<GrowthProfile>();
}
