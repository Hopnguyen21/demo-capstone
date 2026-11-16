using SmartFarm.Domain.Entities;

namespace SmartFarm.Application.Features.CropGrowth;

public static class CropGrowthMapping
{
    public static CropView ToView(this Crop x) => new(
        x.Id, x.Name, x.ScientificName, x.Description, x.IsSystemDefined, x.TenantId,
        x.Category, x.GrowthCycleDays,
        x.OptimalTemperatureMin, x.OptimalTemperatureMax,
        x.OptimalSoilMoistureMin, x.OptimalSoilMoistureMax,
        x.OptimalPhMin, x.OptimalPhMax,
        x.OptimalEcMin, x.OptimalEcMax,
        x.OptimalLux, x.CalendarIrrigationPlan
    );

    private static readonly HashSet<string> KnownSensors = new(StringComparer.OrdinalIgnoreCase)
    {
        "Temperature", "SoilMoisture", "AirHumidity", "LightIntensity", "Ph", "Ec", "SoilTemperature"
    };

    public static VarietyView ToView(this CropVariety x) => new(x.Id, x.CropId, x.Name, x.Description, x.IsSystemDefined, x.TenantId);
    public static RequirementView ToView(this EnvironmentalRequirement x) => new(
        x.ParameterCode, x.MinValue, x.MaxValue, x.TargetValue, x.Unit,
        x.MetricName ?? x.ParameterCode, x.Description, x.IsEnabled,
        KnownSensors.Contains(x.ParameterCode));
    public static RequirementView ToView(this SeasonAppliedRequirement x) => new(
        x.ParameterCode, x.MinValue, x.MaxValue, x.TargetValue, x.Unit,
        x.MetricName ?? x.ParameterCode, x.Description, x.IsEnabled,
        KnownSensors.Contains(x.ParameterCode));
    public static EnvironmentalMetricDefinitionView ToView(this EnvironmentalMetricDefinition x) => new(
        x.Id, x.MetricCode, x.MetricName, x.Unit, x.Description,
        x.DefaultMin, x.DefaultTarget, x.DefaultMax,
        x.HasSensorSupport, x.IsSystemDefined, x.TenantId, x.IsActive);
    public static GrowthStageView ToView(this GrowthStage x) => new(x.Id, x.Name, x.StageOrder, x.DurationDays, x.Requirements.OrderBy(r => r.ParameterCode).Select(r => r.ToView()).ToList(), x.Description, x.FertilizerAction, x.IpmAction);
    public static GrowthProfileView ToView(this GrowthProfile x) => new(x.Id, x.CropId, x.Crop?.Name ?? "Cây trồng", x.VarietyId, x.Variety?.Name, x.Name, x.Description, x.IsDefault, x.IsSystemDefined, x.TenantId, x.SourceProfileId, x.Stages.OrderBy(s => s.StageOrder).Select(s => s.ToView()).ToList());
    public static PlantingSeasonView ToView(this PlantingSeason x) => new(x.Id, x.ZoneId, x.CropId, x.Crop.Name, x.VarietyId, x.Variety?.Name, x.GrowthProfileId, x.GrowthProfile.Name, x.CurrentGrowthStageId, x.CurrentGrowthStage.Name, x.Name, x.StartDate, x.ExpectedEndDate, x.ActualEndDate, x.ActualYieldKg, x.Status, x.AppliedRequirements.OrderBy(r => r.ParameterCode).Select(r => r.ToView()).ToList(), x.StageTransitions.OrderBy(t => t.CreatedAtUtc).Select(t => new StageTransitionView(t.Id, t.PreviousGrowthStageId, t.CurrentGrowthStageId, t.CreatedAtUtc, t.Notes)).ToList(), x.FarmingSeasonId, x.FarmingSeason?.Name);
}
