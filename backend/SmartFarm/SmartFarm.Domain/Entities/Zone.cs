using SmartFarm.Domain.Common;
using SmartFarm.Domain.Enums;

namespace SmartFarm.Domain.Entities;

public sealed class Zone : AuditableEntity
{
    public Guid FieldId { get; set; }
    public Field Field { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public decimal AreaM2 { get; set; }
    public string ZoneType { get; set; } = string.Empty;
    public string? BoundaryGeoJson { get; set; }
    public string? Notes { get; set; }
    public ZoneStatus Status { get; set; } = ZoneStatus.Inactive;
    public DateTime? ArchivedAtUtc { get; set; }

    public ICollection<UserZoneAccess> UserAccesses { get; } = new List<UserZoneAccess>();
    public ICollection<PlantingSeason> PlantingSeasons { get; } = new List<PlantingSeason>();
}
