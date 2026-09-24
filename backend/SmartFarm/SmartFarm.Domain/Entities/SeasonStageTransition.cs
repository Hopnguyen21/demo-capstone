using SmartFarm.Domain.Common;

namespace SmartFarm.Domain.Entities;

public sealed class SeasonStageTransition : AuditableEntity
{
    public Guid PlantingSeasonId { get; set; }
    public PlantingSeason PlantingSeason { get; set; } = null!;
    public Guid PreviousGrowthStageId { get; set; }
    public GrowthStage PreviousGrowthStage { get; set; } = null!;
    public Guid CurrentGrowthStageId { get; set; }
    public GrowthStage CurrentGrowthStage { get; set; } = null!;
    public Guid ChangedByUserId { get; set; }
    public AppUser ChangedByUser { get; set; } = null!;
    public string? Notes { get; set; }
}
