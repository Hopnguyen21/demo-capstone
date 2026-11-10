using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartFarm.Domain.Entities;

namespace SmartFarm.Infrastructure.Persistence.Configurations;

internal sealed class BillConfiguration : IEntityTypeConfiguration<Bill>
{
    public void Configure(EntityTypeBuilder<Bill> b)
    {
        b.ToTable("Bills");
        b.HasKey(x => x.Id);
        b.Property(x => x.BillCode).HasMaxLength(100).IsRequired();
        b.Property(x => x.LesseeName).HasMaxLength(200).IsRequired();
        b.Property(x => x.Amount).HasPrecision(18, 2);
        b.Property(x => x.PaidAmount).HasPrecision(18, 2);
        b.Property(x => x.RemainingAmount).HasPrecision(18, 2);
        b.Property(x => x.Status).HasConversion<int>();
        b.Property(x => x.PaymentMethod).HasMaxLength(100);
        b.Property(x => x.Notes).HasMaxLength(2000);

        b.HasOne(x => x.Contract).WithMany().HasForeignKey(x => x.ContractId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.CreatedByUser).WithMany().HasForeignKey(x => x.CreatedByUserId).OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(x => new { x.TenantId, x.BillCode }).IsUnique();
        b.HasIndex(x => x.ContractId);
    }
}

