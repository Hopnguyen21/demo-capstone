using SmartFarm.Domain.Common;

namespace SmartFarm.Domain.Entities;

public sealed class EnvironmentalMetricDefinition : AuditableEntity
{
    public string MetricCode { get; set; } = string.Empty;
    public string MetricName { get; set; } = string.Empty;
    public string Unit { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal DefaultMin { get; set; }
    public decimal DefaultTarget { get; set; }
    public decimal DefaultMax { get; set; }
    public bool HasSensorSupport { get; set; }
    public bool IsSystemDefined { get; set; }
    public Guid? TenantId { get; set; }
    public bool IsActive { get; set; } = true;
}
