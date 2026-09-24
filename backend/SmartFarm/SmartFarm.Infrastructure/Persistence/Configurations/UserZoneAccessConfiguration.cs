using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartFarm.Domain.Entities;

namespace SmartFarm.Infrastructure.Persistence.Configurations;

internal sealed class UserZoneAccessConfiguration : IEntityTypeConfiguration<UserZoneAccess>
{
    public void Configure(EntityTypeBuilder<UserZoneAccess> builder)
    {
        builder.ToTable("user_zone_accesses");
        builder.HasKey(x => new { x.AppUserId, x.ZoneId });
        builder.Property(x => x.AppUserId).HasColumnName("app_user_id");
        builder.Property(x => x.ZoneId).HasColumnName("zone_id");
        builder.Property(x => x.CanControl).HasColumnName("can_control");
        builder.Property(x => x.AssignedAtUtc).HasColumnName("assigned_at_utc");
        builder.HasOne(x => x.AppUser).WithMany(x => x.ZoneAccesses).HasForeignKey(x => x.AppUserId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(x => x.Zone).WithMany(x => x.UserAccesses).HasForeignKey(x => x.ZoneId).OnDelete(DeleteBehavior.Cascade);
    }
}
