using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartFarm.Domain.Entities;

namespace SmartFarm.Infrastructure.Persistence.Configurations;

internal sealed class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> b)
    {
        b.ToTable("notifications");
        b.HasKey(x => x.Id);
        DeploymentRequestConfiguration.IdAudit(b);

        b.Property(x => x.UserId).HasColumnName("user_id");
        b.Property(x => x.TenantId).HasColumnName("tenant_id");
        b.Property(x => x.Title).HasColumnName("title").HasMaxLength(250).IsRequired();
        b.Property(x => x.Message).HasColumnName("message").HasMaxLength(2000).IsRequired();
        b.Property(x => x.Type).HasColumnName("type").HasConversion<string>().HasMaxLength(30);
        b.Property(x => x.Severity).HasColumnName("severity").HasConversion<string>().HasMaxLength(20);
        b.Property(x => x.IsRead).HasColumnName("is_read");
        b.Property(x => x.ReadAtUtc).HasColumnName("read_at_utc");
        b.Property(x => x.TargetUrl).HasColumnName("target_url").HasMaxLength(500);
        b.Property(x => x.ReferenceId).HasColumnName("reference_id").HasMaxLength(100);
        b.Property(x => x.MetadataJson).HasColumnName("metadata_json");

        b.HasIndex(x => new { x.UserId, x.IsRead, x.CreatedAtUtc });

        b.HasOne(x => x.User)
            .WithMany()
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasOne(x => x.Tenant)
            .WithMany()
            .HasForeignKey(x => x.TenantId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
