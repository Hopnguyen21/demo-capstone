using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartFarm.Domain.Entities;

namespace SmartFarm.Infrastructure.Persistence.Configurations;

internal sealed class FarmConfiguration : IEntityTypeConfiguration<Farm>
{
    public void Configure(EntityTypeBuilder<Farm> builder)
    {
        builder.ToTable("farms", table =>
        {
            table.HasCheckConstraint("ck_farms_total_area", "total_area_m2 > 0");
            table.HasCheckConstraint("ck_farms_max_area", "total_area_m2 <= 1000000");
            table.HasCheckConstraint("ck_farms_latitude", "latitude IS NULL OR latitude BETWEEN -90 AND 90");
            table.HasCheckConstraint("ck_farms_longitude", "longitude IS NULL OR longitude BETWEEN -180 AND 180");
        });
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).HasColumnName("id");
        builder.Property(x => x.TenantId).HasColumnName("tenant_id");
        builder.Property(x => x.Name).HasColumnName("name").HasMaxLength(200).IsRequired();
        builder.Property(x => x.LocationText).HasColumnName("location_text").HasMaxLength(500);
        builder.Property(x => x.Latitude).HasColumnName("latitude").HasPrecision(9, 6);
        builder.Property(x => x.Longitude).HasColumnName("longitude").HasPrecision(9, 6);
        builder.Property(x => x.TotalAreaM2).HasColumnName("total_area_m2").HasPrecision(18, 2);
        builder.Property(x => x.TimeZone).HasColumnName("time_zone").HasMaxLength(100).IsRequired();
        builder.Property(x => x.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(30);
        builder.Property(x => x.ArchivedAtUtc).HasColumnName("archived_at_utc");
        builder.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc");
        builder.Property(x => x.UpdatedAtUtc).HasColumnName("updated_at_utc");
        builder.HasIndex(x => new { x.TenantId, x.Name }).IsUnique();
        builder.HasOne(x => x.Tenant).WithMany(x => x.Farms).HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Restrict);
    }
}
