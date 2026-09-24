using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartFarm.Domain.Entities;

namespace SmartFarm.Infrastructure.Persistence.Configurations;

internal sealed class TenantConfiguration : IEntityTypeConfiguration<Tenant>
{
    public void Configure(EntityTypeBuilder<Tenant> builder)
    {
        builder.ToTable("tenants");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).HasColumnName("id");
        builder.Property(x => x.CompanyName).HasColumnName("company_name").HasMaxLength(200).IsRequired();
        builder.Property(x => x.Subdomain).HasColumnName("subdomain").HasMaxLength(30).IsRequired();
        builder.Property(x => x.TaxCode).HasColumnName("tax_code").HasMaxLength(30);
        builder.Property(x => x.Address).HasColumnName("address").HasMaxLength(500);
        builder.Property(x => x.LogoUrl).HasColumnName("logo_url").HasMaxLength(2048);
        builder.Property(x => x.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(20);
        builder.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc");
        builder.Property(x => x.UpdatedAtUtc).HasColumnName("updated_at_utc");
        builder.HasIndex(x => x.Subdomain).IsUnique();
        builder.HasIndex(x => x.TaxCode).IsUnique().HasFilter("tax_code IS NOT NULL");
    }
}
