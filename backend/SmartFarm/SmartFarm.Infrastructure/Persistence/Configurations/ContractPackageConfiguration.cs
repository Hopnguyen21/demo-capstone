using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartFarm.Domain.Entities;

namespace SmartFarm.Infrastructure.Persistence.Configurations;

internal sealed class ContractPackageConfiguration : IEntityTypeConfiguration<ContractPackage>
{
    public void Configure(EntityTypeBuilder<ContractPackage> b)
    {
        b.ToTable("ContractPackages");
        b.HasKey(x => x.Id);
        b.Property(x => x.PackageName).HasMaxLength(200).IsRequired();
        b.Property(x => x.Description).HasMaxLength(2000);
        b.Property(x => x.Price).HasPrecision(18, 2);
        b.Property(x => x.Currency).HasMaxLength(10).HasDefaultValue("VND");
        b.Property(x => x.Status).HasConversion<int>();
        b.Property(x => x.IsCustom).HasDefaultValue(false);
        b.Property(x => x.CustomerName).HasMaxLength(200);

        // ContractId là soft-reference tới ZoneContract — không phải FK thực,
        // chỉ lưu Guid để tra cứu. Khai báo tường minh là column thường để EF
        // không tự infer một FK ngược lại ZoneContracts và sinh JOIN sai.
        b.Property(x => x.ContractId);

        b.HasOne(x => x.CreatedByUser).WithMany().HasForeignKey(x => x.CreatedByUserId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.Tenant).WithMany().HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.SetNull);
    }
}
