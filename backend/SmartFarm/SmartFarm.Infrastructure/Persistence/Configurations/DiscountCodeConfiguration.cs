using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartFarm.Domain.Entities;

namespace SmartFarm.Infrastructure.Persistence.Configurations;

internal sealed class DiscountCodeConfiguration : IEntityTypeConfiguration<DiscountCode>
{
    public void Configure(EntityTypeBuilder<DiscountCode> b)
    {
        b.ToTable("DiscountCodes");
        b.HasKey(x => x.Id);
        b.Property(x => x.Code).HasMaxLength(50).IsRequired();
        b.Property(x => x.Description).HasMaxLength(500).IsRequired();
        b.Property(x => x.DiscountType).HasConversion<int>();
        b.Property(x => x.DiscountValue).HasPrecision(18, 2);
        b.Property(x => x.MinContractValue).HasPrecision(18, 2);
        b.Property(x => x.MaxDiscountAmount).HasPrecision(18, 2);

        b.HasIndex(x => x.Code).IsUnique();
        b.HasOne(x => x.CreatedByUser).WithMany().HasForeignKey(x => x.CreatedByUserId).OnDelete(DeleteBehavior.Restrict);
    }
}
