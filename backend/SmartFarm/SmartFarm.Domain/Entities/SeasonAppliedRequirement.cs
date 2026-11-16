namespace SmartFarm.Domain.Entities;

public sealed class SeasonAppliedRequirement
{
    public Guid PlantingSeasonId { get; set; }
    public PlantingSeason PlantingSeason { get; set; } = null!;
    public string ParameterCode { get; set; } = string.Empty;
    public string? MetricName { get; set; }
    public string? Description { get; set; }
    public decimal MinValue { get; set; }
    public decimal MaxValue { get; set; }
    public decimal TargetValue { get; set; }
    public string Unit { get; set; } = string.Empty;
    public bool IsEnabled { get; set; } = true;
}
