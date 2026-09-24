using SmartFarm.Domain.Enums;

namespace SmartFarm.Domain.Entities;

public sealed class SeasonAppliedRequirement
{
    public Guid PlantingSeasonId { get; set; }
    public PlantingSeason PlantingSeason { get; set; } = null!;
    public EnvironmentalParameterCode ParameterCode { get; set; }
    public decimal MinValue { get; set; }
    public decimal MaxValue { get; set; }
    public decimal TargetValue { get; set; }
    public string Unit { get; set; } = string.Empty;
}
