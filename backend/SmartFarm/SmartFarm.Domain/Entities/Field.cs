using SmartFarm.Domain.Common;

namespace SmartFarm.Domain.Entities;

public sealed class Field : AuditableEntity
{
    public Guid FarmId { get; set; }
    public Farm Farm { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public decimal AreaM2 { get; set; }
    public decimal AvailableAreaM2 { get; set; }
    public string? SoilType { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public string? BoundaryGeoJson { get; set; }
    public DateTime? ArchivedAtUtc { get; set; }

    public ICollection<Zone> Zones { get; } = new List<Zone>();
}
