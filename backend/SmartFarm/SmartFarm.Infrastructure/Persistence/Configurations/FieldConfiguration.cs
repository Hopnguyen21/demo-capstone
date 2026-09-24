using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartFarm.Domain.Entities;

namespace SmartFarm.Infrastructure.Persistence.Configurations;

internal sealed class FieldConfiguration : IEntityTypeConfiguration<Field>
{
    public void Configure(EntityTypeBuilder<Field> builder)
    {
        builder.ToTable("fields", table =>
        {
            table.HasCheckConstraint("ck_fields_area", "area_m2 > 0");
            table.HasCheckConstraint("ck_fields_available_area", "available_area_m2 >= 0 AND available_area_m2 <= area_m2");
            table.HasCheckConstraint("ck_fields_latitude", "latitude IS NULL OR latitude BETWEEN -90 AND 90");
            table.HasCheckConstraint("ck_fields_longitude", "longitude IS NULL OR longitude BETWEEN -180 AND 180");
            table.HasCheckConstraint("ck_fields_boundary_json", "boundary_geo_json IS NULL OR jsonb_typeof(boundary_geo_json) = 'object'");
        });
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).HasColumnName("id");
        builder.Property(x => x.FarmId).HasColumnName("farm_id");
        builder.Property(x => x.Name).HasColumnName("name").HasMaxLength(200).IsRequired();
        builder.Property(x => x.AreaM2).HasColumnName("area_m2").HasPrecision(18, 2);
        builder.Property(x => x.AvailableAreaM2).HasColumnName("available_area_m2").HasPrecision(18, 2);
        builder.Property(x => x.SoilType).HasColumnName("soil_type").HasMaxLength(100);
        builder.Property(x => x.Latitude).HasColumnName("latitude").HasPrecision(9, 6);
        builder.Property(x => x.Longitude).HasColumnName("longitude").HasPrecision(9, 6);
        builder.Property(x => x.BoundaryGeoJson).HasColumnName("boundary_geo_json").HasColumnType("jsonb");
        builder.Property(x => x.ArchivedAtUtc).HasColumnName("archived_at_utc");
        builder.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc");
        builder.Property(x => x.UpdatedAtUtc).HasColumnName("updated_at_utc");
        builder.HasIndex(x => new { x.FarmId, x.Name }).IsUnique();
        builder.HasOne(x => x.Farm).WithMany(x => x.Fields).HasForeignKey(x => x.FarmId).OnDelete(DeleteBehavior.Restrict);
    }
}
