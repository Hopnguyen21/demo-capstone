using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartFarm.Domain.Entities;

namespace SmartFarm.Infrastructure.Persistence.Configurations;

internal sealed class StockOutConfiguration : IEntityTypeConfiguration<StockOut>
{
    public void Configure(EntityTypeBuilder<StockOut> b)
    {
        b.ToTable("StockOuts");
        b.HasKey(x => x.Id);
        b.Property(x => x.StockOutCode).HasMaxLength(100).IsRequired();
        b.Property(x => x.Status).HasConversion<int>();
        b.Property(x => x.Notes).HasMaxLength(2000);

        b.HasOne(x => x.Farm).WithMany().HasForeignKey(x => x.FarmId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.Zone).WithMany().HasForeignKey(x => x.ZoneId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne(x => x.CreatedByUser).WithMany().HasForeignKey(x => x.CreatedByUserId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.ApprovedByUser).WithMany().HasForeignKey(x => x.ApprovedByUserId).OnDelete(DeleteBehavior.Restrict);

        b.HasMany(x => x.Details).WithOne(x => x.StockOut).HasForeignKey(x => x.StockOutId).OnDelete(DeleteBehavior.Cascade);
        b.HasIndex(x => new { x.TenantId, x.FarmId, x.StockOutCode }).IsUnique();
    }
}

internal sealed class StockOutDetailConfiguration : IEntityTypeConfiguration<StockOutDetail>
{
    public void Configure(EntityTypeBuilder<StockOutDetail> b)
    {
        b.ToTable("StockOutDetails");
        b.HasKey(x => x.Id);
        b.Property(x => x.Quantity).HasPrecision(18, 4);
        b.Property(x => x.Notes).HasMaxLength(1000);

        b.HasOne(x => x.InventoryItem).WithMany().HasForeignKey(x => x.InventoryItemId).IsRequired(false).OnDelete(DeleteBehavior.Restrict);
    }
}

