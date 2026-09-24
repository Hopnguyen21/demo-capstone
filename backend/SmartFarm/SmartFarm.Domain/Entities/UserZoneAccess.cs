namespace SmartFarm.Domain.Entities;

public sealed class UserZoneAccess
{
    public Guid AppUserId { get; set; }
    public AppUser AppUser { get; set; } = null!;
    public Guid ZoneId { get; set; }
    public Zone Zone { get; set; } = null!;
    public bool CanControl { get; set; }
    public DateTime AssignedAtUtc { get; set; } = DateTime.UtcNow;
}
