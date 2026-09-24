using SmartFarm.Domain.Common;
using SmartFarm.Domain.Enums;

namespace SmartFarm.Domain.Entities;

public sealed class PlantingSeason : AuditableEntity
{
    public Guid ZoneId { get; set; }
    public Zone Zone { get; set; } = null!;
    public Guid CropId { get; set; }
    public Crop Crop { get; set; } = null!;
    public Guid? VarietyId { get; set; }
    public CropVariety? Variety { get; set; }
    public Guid GrowthProfileId { get; set; }
    public GrowthProfile GrowthProfile { get; set; } = null!;
    public Guid CurrentGrowthStageId { get; set; }
    public GrowthStage CurrentGrowthStage { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public DateOnly StartDate { get; set; }
    public DateOnly ExpectedEndDate { get; set; }
    public DateOnly? ActualEndDate { get; set; }
    public decimal? ActualYieldKg { get; set; }
    public string? CloseNotes { get; set; }
    public PlantingSeasonStatus Status { get; set; } = PlantingSeasonStatus.InProgress;
    public ICollection<SeasonAppliedRequirement> AppliedRequirements { get; } = new List<SeasonAppliedRequirement>();
    public ICollection<SeasonStageTransition> StageTransitions { get; } = new List<SeasonStageTransition>();
}
