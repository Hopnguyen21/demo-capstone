using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartFarm.Domain.Entities;

namespace SmartFarm.Infrastructure.Persistence.Configurations;

internal sealed class ZoneConfiguration : IEntityTypeConfiguration<Zone>
{
    public void Configure(EntityTypeBuilder<Zone> builder)
    {
        builder.ToTable("zones", table =>
        {
            table.HasCheckConstraint("ck_zones_area", "area_m2 > 0");
            table.HasCheckConstraint("ck_zones_boundary_valid", "boundary IS NULL OR ST_IsValid(boundary)");
        });
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).HasColumnName("id");
        builder.Property(x => x.FieldId).HasColumnName("field_id");
        builder.Property(x => x.Name).HasColumnName("name").HasMaxLength(200).IsRequired();
        builder.Property(x => x.AreaM2).HasColumnName("area_m2").HasPrecision(18, 2);
        builder.Property(x => x.ZoneType).HasColumnName("zone_type").HasMaxLength(50).IsRequired();
        builder.Property(x => x.BoundaryGeoJson)
            .HasColumnName("boundary")
            .HasColumnType("geometry(Polygon,4326)")
            .HasConversion(GeoJsonPolygonValueConverter.Instance);
        builder.Property(x => x.Notes).HasColumnName("notes").HasMaxLength(1000);
        builder.Property(x => x.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(20);
        builder.Property(x => x.ArchivedAtUtc).HasColumnName("archived_at_utc");
        builder.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc");
        builder.Property(x => x.UpdatedAtUtc).HasColumnName("updated_at_utc");
        builder.HasIndex(x => new { x.FieldId, x.Name }).IsUnique();
        builder.HasIndex(x => x.BoundaryGeoJson).HasDatabaseName("ix_zones_boundary_gist").HasMethod("gist");
        builder.HasOne(x => x.Field).WithMany(x => x.Zones).HasForeignKey(x => x.FieldId).OnDelete(DeleteBehavior.Restrict);
    }
}
