using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartFarm.Domain.Entities;

namespace SmartFarm.Infrastructure.Persistence.Configurations;

internal sealed class FinanceTransactionConfiguration : IEntityTypeConfiguration<FinanceTransaction>
{
    public void Configure(EntityTypeBuilder<FinanceTransaction> b)
    {
        b.ToTable("finance_transactions", t => t.HasCheckConstraint("ck_finance_amount_positive", "amount > 0"));
        b.HasKey(x => x.Id); DeploymentRequestConfiguration.IdAudit(b);
        b.Property(x => x.TenantId).HasColumnName("tenant_id"); b.Property(x => x.FarmId).HasColumnName("farm_id");
        b.Property(x => x.TransactionType).HasColumnName("transaction_type").HasConversion<string>().HasMaxLength(20);
        b.Property(x => x.ExpenseCategory).HasColumnName("expense_category").HasConversion<string>().HasMaxLength(30);
        b.Property(x => x.Amount).HasColumnName("amount").HasPrecision(18, 2); b.Property(x => x.OccurredAtUtc).HasColumnName("occurred_at_utc");
        b.Property(x => x.Description).HasColumnName("description").HasMaxLength(500); b.Property(x => x.Reference).HasColumnName("reference").HasMaxLength(200);
        b.Property(x => x.CreatedByOwnerId).HasColumnName("created_by_owner_id"); b.Property(x => x.ArchivedAtUtc).HasColumnName("archived_at_utc");
        b.HasIndex(x => new { x.FarmId, x.OccurredAtUtc }); b.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.Farm).WithMany().HasForeignKey(x => x.FarmId).OnDelete(DeleteBehavior.Restrict); b.HasOne<AppUser>().WithMany().HasForeignKey(x => x.CreatedByOwnerId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class ServiceRequestLifecycleConfiguration : IEntityTypeConfiguration<ServiceRequest>
{
    public void Configure(EntityTypeBuilder<ServiceRequest> b)
    {
        b.Property(x => x.CreatedByOwnerId).HasColumnName("created_by_owner_id"); b.Property(x => x.AssignedTechnicianId).HasColumnName("assigned_technician_id");
        b.Property(x => x.InspectionNotes).HasColumnName("inspection_notes").HasMaxLength(2000); b.Property(x => x.Diagnosis).HasColumnName("diagnosis").HasMaxLength(2000);
        b.Property(x => x.ResolutionAction).HasColumnName("resolution_action").HasConversion<string>().HasMaxLength(30); b.Property(x => x.WorkPerformed).HasColumnName("work_performed").HasMaxLength(2000);
        b.Property(x => x.CurrentDeviceId).HasColumnName("current_device_id"); b.Property(x => x.AcceptedAtUtc).HasColumnName("accepted_at_utc"); b.Property(x => x.ClosedAtUtc).HasColumnName("closed_at_utc");
        b.HasOne<AppUser>().WithMany().HasForeignKey(x => x.CreatedByOwnerId).OnDelete(DeleteBehavior.Restrict); b.HasOne(x => x.AssignedTechnician).WithMany().HasForeignKey(x => x.AssignedTechnicianId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.CurrentDevice).WithMany().HasForeignKey(x => x.CurrentDeviceId).OnDelete(DeleteBehavior.Restrict); b.HasIndex(x => new { x.AssignedTechnicianId, x.Status });
    }
}

internal sealed class ServiceRequestHistoryConfiguration : IEntityTypeConfiguration<ServiceRequestHistory>
{
    public void Configure(EntityTypeBuilder<ServiceRequestHistory> b) { b.ToTable("service_request_history"); b.HasKey(x => x.Id); DeploymentRequestConfiguration.IdAudit(b); b.Property(x => x.ServiceRequestId).HasColumnName("service_request_id"); b.Property(x => x.ActorUserId).HasColumnName("actor_user_id"); b.Property(x => x.EventType).HasColumnName("event_type").HasConversion<string>().HasMaxLength(30); b.Property(x => x.FromStatus).HasColumnName("from_status").HasConversion<string>().HasMaxLength(30); b.Property(x => x.ToStatus).HasColumnName("to_status").HasConversion<string>().HasMaxLength(30); b.Property(x => x.Notes).HasColumnName("notes").HasMaxLength(2000); b.HasOne(x => x.ServiceRequest).WithMany(x => x.History).HasForeignKey(x => x.ServiceRequestId).OnDelete(DeleteBehavior.Cascade); b.HasOne<AppUser>().WithMany().HasForeignKey(x => x.ActorUserId).OnDelete(DeleteBehavior.Restrict); b.HasIndex(x => new { x.ServiceRequestId, x.CreatedAtUtc }); }
}

internal sealed class DeviceReplacementConfiguration : IEntityTypeConfiguration<DeviceReplacement>
{
    public void Configure(EntityTypeBuilder<DeviceReplacement> b) { b.ToTable("device_replacements"); b.HasKey(x => x.Id); DeploymentRequestConfiguration.IdAudit(b); b.Property(x => x.ServiceRequestId).HasColumnName("service_request_id"); b.Property(x => x.OldDeviceId).HasColumnName("old_device_id"); b.Property(x => x.NewDeviceId).HasColumnName("new_device_id"); b.Property(x => x.ZoneId).HasColumnName("zone_id"); b.Property(x => x.TechnicianUserId).HasColumnName("technician_user_id"); b.HasOne(x => x.ServiceRequest).WithMany(x => x.Replacements).HasForeignKey(x => x.ServiceRequestId).OnDelete(DeleteBehavior.Restrict); b.HasOne(x => x.OldDevice).WithMany().HasForeignKey(x => x.OldDeviceId).OnDelete(DeleteBehavior.Restrict); b.HasOne(x => x.NewDevice).WithMany().HasForeignKey(x => x.NewDeviceId).OnDelete(DeleteBehavior.Restrict); b.HasOne<Zone>().WithMany().HasForeignKey(x => x.ZoneId).OnDelete(DeleteBehavior.Restrict); b.HasOne<AppUser>().WithMany().HasForeignKey(x => x.TechnicianUserId).OnDelete(DeleteBehavior.Restrict); b.HasIndex(x => x.NewDeviceId).IsUnique(); }
}
