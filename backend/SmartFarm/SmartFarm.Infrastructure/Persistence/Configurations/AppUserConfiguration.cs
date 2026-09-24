using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartFarm.Domain.Entities;

namespace SmartFarm.Infrastructure.Persistence.Configurations;

internal sealed class AppUserConfiguration : IEntityTypeConfiguration<AppUser>
{
    public void Configure(EntityTypeBuilder<AppUser> builder)
    {
        builder.ToTable("app_users", table => table.HasCheckConstraint(
            "ck_app_users_role_scope",
            "(role IN ('PlatformAdmin', 'PlatformTechnician') AND tenant_id IS NULL AND farm_id IS NULL) OR " +
            "(role = 'FarmOwner' AND farm_id IS NULL) OR " +
            "(role = 'Farmer' AND ((tenant_id IS NULL AND farm_id IS NULL) OR (tenant_id IS NOT NULL AND farm_id IS NOT NULL)))"));
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).HasColumnName("id");
        builder.Property(x => x.Email).HasColumnName("email").HasMaxLength(320).IsRequired();
        builder.Property(x => x.NormalizedEmail).HasColumnName("normalized_email").HasMaxLength(320).IsRequired();
        builder.Property(x => x.FullName).HasColumnName("full_name").HasMaxLength(150).IsRequired();
        builder.Property(x => x.Phone).HasColumnName("phone").HasMaxLength(20);
        builder.Property(x => x.PasswordHash).HasColumnName("password_hash").HasMaxLength(500).IsRequired();
        builder.Property(x => x.Role).HasColumnName("role").HasConversion<string>().HasMaxLength(30);
        builder.Property(x => x.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(20);
        builder.Property(x => x.FailedLoginAttempts).HasColumnName("failed_login_attempts");
        builder.Property(x => x.LockedUntilUtc).HasColumnName("locked_until_utc");
        builder.Property(x => x.LastLoginAtUtc).HasColumnName("last_login_at_utc");
        builder.Property(x => x.TenantId).HasColumnName("tenant_id");
        builder.Property(x => x.FarmId).HasColumnName("farm_id");
        builder.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc");
        builder.Property(x => x.UpdatedAtUtc).HasColumnName("updated_at_utc");
        builder.HasIndex(x => x.NormalizedEmail).IsUnique();
        builder.HasIndex(x => x.TenantId);
        builder.HasIndex(x => x.FarmId);
        builder.HasOne(x => x.Tenant).WithMany(x => x.Users).HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.Farm).WithMany(x => x.Farmers).HasForeignKey(x => x.FarmId).OnDelete(DeleteBehavior.Restrict);
    }
}
