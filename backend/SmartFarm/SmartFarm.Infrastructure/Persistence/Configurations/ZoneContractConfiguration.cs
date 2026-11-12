using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartFarm.Domain.Entities;

namespace SmartFarm.Infrastructure.Persistence.Configurations;

internal sealed class ZoneContractConfiguration : IEntityTypeConfiguration<ZoneContract>
{
    public void Configure(EntityTypeBuilder<ZoneContract> b)
    {
        b.ToTable("ZoneContracts");
        b.HasKey(x => x.Id);

        b.HasOne(x => x.Farm)
            .WithMany()
            .HasForeignKey(x => x.FarmId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasOne(x => x.Zone)
            .WithMany()
            .HasForeignKey(x => x.ZoneId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasOne(x => x.ParentContract)
            .WithMany()
            .HasForeignKey(x => x.ParentContractId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasOne(x => x.ContractPackage)
            .WithMany()
            .HasForeignKey(x => x.ContractPackageId)
            .OnDelete(DeleteBehavior.SetNull);

        b.HasMany(x => x.Renewals)
            .WithOne(x => x.Contract)
            .HasForeignKey(x => x.ContractId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

