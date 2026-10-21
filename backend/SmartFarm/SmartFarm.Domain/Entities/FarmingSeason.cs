using SmartFarm.Domain.Common;

namespace SmartFarm.Domain.Entities;

public sealed class FarmingSeason : AuditableEntity
{
    public Guid? TenantId { get; set; }
    public Tenant? Tenant { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public int Year { get; set; } = 2026;
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public string? Description { get; set; }
    public string Status { get; set; } = "Active";
    public bool IsActive { get; set; } = true;
    public ICollection<PlantingSeason> PlantingSeasons { get; } = new List<PlantingSeason>();
}
