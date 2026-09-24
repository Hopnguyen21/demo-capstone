using SmartFarm.Domain.Entities;

namespace SmartFarm.Application.Features.CropGrowth;

public static class CropGrowthMapping
{
    public static CropView ToView(this Crop x) => new(x.Id, x.Name, x.ScientificName, x.Description, x.IsSystemDefined, x.TenantId);
    public static VarietyView ToView(this CropVariety x) => new(x.Id, x.CropId, x.Name, x.Description, x.IsSystemDefined, x.TenantId);
    public static RequirementView ToView(this EnvironmentalRequirement x) => new(x.ParameterCode, x.MinValue, x.MaxValue, x.TargetValue, x.Unit);
    public static RequirementView ToView(this SeasonAppliedRequirement x) => new(x.ParameterCode, x.MinValue, x.MaxValue, x.TargetValue, x.Unit);
    public static GrowthStageView ToView(this GrowthStage x) => new(x.Id, x.Name, x.StageOrder, x.DurationDays, x.Requirements.OrderBy(r => r.ParameterCode).Select(r => r.ToView()).ToList());
    public static GrowthProfileView ToView(this GrowthProfile x) => new(x.Id, x.CropId, x.VarietyId, x.Name, x.Description, x.IsDefault, x.IsSystemDefined, x.TenantId, x.SourceProfileId, x.Stages.OrderBy(s => s.StageOrder).Select(s => s.ToView()).ToList());
    public static PlantingSeasonView ToView(this PlantingSeason x) => new(x.Id, x.ZoneId, x.CropId, x.VarietyId, x.GrowthProfileId, x.CurrentGrowthStageId, x.Name, x.StartDate, x.ExpectedEndDate, x.ActualEndDate, x.ActualYieldKg, x.Status, x.AppliedRequirements.OrderBy(r => r.ParameterCode).Select(r => r.ToView()).ToList(), x.StageTransitions.OrderBy(t => t.CreatedAtUtc).Select(t => new StageTransitionView(t.Id, t.PreviousGrowthStageId, t.CurrentGrowthStageId, t.CreatedAtUtc, t.Notes)).ToList());
}
