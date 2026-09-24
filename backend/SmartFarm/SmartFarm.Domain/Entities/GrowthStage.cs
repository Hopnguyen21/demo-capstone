using SmartFarm.Domain.Common;

namespace SmartFarm.Domain.Entities;

public sealed class GrowthStage : AuditableEntity
{
    public Guid GrowthProfileId { get; set; }
    public GrowthProfile GrowthProfile { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public int StageOrder { get; set; }
    public int DurationDays { get; set; }
    public ICollection<EnvironmentalRequirement> Requirements { get; } = new List<EnvironmentalRequirement>();
}
