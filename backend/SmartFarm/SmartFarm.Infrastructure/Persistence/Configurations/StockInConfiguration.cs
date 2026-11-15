using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartFarm.Domain.Entities;

namespace SmartFarm.Infrastructure.Persistence.Configurations;

internal sealed class StockInConfiguration : IEntityTypeConfiguration<StockIn>
{
    public void Configure(EntityTypeBuilder<StockIn> b)
    {
        b.ToTable("StockIns");
        b.HasKey(x => x.Id);
        b.Property(x => x.StockInCode).HasMaxLength(100).IsRequired();
        b.Property(x => x.SupplierName).HasMaxLength(200);
        b.Property(x => x.Status).HasConversion<int>();
        b.Property(x => x.Notes).HasMaxLength(2000);

        b.HasOne(x => x.Farm).WithMany().HasForeignKey(x => x.FarmId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.CreatedByUser).WithMany().HasForeignKey(x => x.CreatedByUserId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.ApprovedByUser).WithMany().HasForeignKey(x => x.ApprovedByUserId).OnDelete(DeleteBehavior.Restrict);

        b.HasMany(x => x.Details).WithOne(x => x.StockIn).HasForeignKey(x => x.StockInId).OnDelete(DeleteBehavior.Cascade);
        b.HasIndex(x => new { x.TenantId, x.FarmId, x.StockInCode }).IsUnique();
    }
}

internal sealed class StockInDetailConfiguration : IEntityTypeConfiguration<StockInDetail>
{
    public void Configure(EntityTypeBuilder<StockInDetail> b)
    {
        b.ToTable("StockInDetails");
        b.HasKey(x => x.Id);
        b.Property(x => x.Quantity).HasPrecision(18, 4);
        b.Property(x => x.UnitPrice).HasPrecision(18, 2);
        b.Property(x => x.Notes).HasMaxLength(1000);

        // InventoryItemId trỏ tới inventory_items hoặc PlatformHardwareItems nên cố ý KHÔNG có khóa ngoại.
        b.HasIndex(x => x.InventoryItemId);
    }
}
