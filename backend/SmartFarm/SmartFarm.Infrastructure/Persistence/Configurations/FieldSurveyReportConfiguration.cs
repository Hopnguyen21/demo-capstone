using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartFarm.Domain.Entities;

namespace SmartFarm.Infrastructure.Persistence.Configurations;

public sealed class FieldSurveyReportConfiguration : IEntityTypeConfiguration<FieldSurveyReport>
{
    public void Configure(EntityTypeBuilder<FieldSurveyReport> builder)
    {
        builder.ToTable("FieldSurveyReports");
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Title).HasMaxLength(300).IsRequired();
        builder.Property(x => x.Location).HasMaxLength(500);
        builder.Property(x => x.SurveyorName).HasMaxLength(200);
        builder.Property(x => x.RepresentativeName).HasMaxLength(200);
        builder.Property(x => x.Status).HasMaxLength(50).HasDefaultValue("Submitted");

        builder.Property(x => x.FarmOverview).HasColumnType("text");
        builder.Property(x => x.CropAndSeasonStatus).HasColumnType("text");
        builder.Property(x => x.CultivationProcess).HasColumnType("text");
        builder.Property(x => x.EnvironmentalMonitoring).HasColumnType("text");
        builder.Property(x => x.EnvironmentalThresholdNeeds).HasColumnType("text");
        builder.Property(x => x.EquipmentAndDataCollection).HasColumnType("text");
        builder.Property(x => x.ManagementAndPermissions).HasColumnType("text");
        builder.Property(x => x.DifficultiesAndNeeds).HasColumnType("text");
        builder.Property(x => x.TeamAssessment).HasColumnType("text");

        builder.HasOne(x => x.Farm)
            .WithMany()
            .HasForeignKey(x => x.FarmId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(x => x.Tenant)
            .WithMany()
            .HasForeignKey(x => x.TenantId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(x => x.ServiceRequest)
            .WithMany()
            .HasForeignKey(x => x.ServiceRequestId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(x => x.Zone)
            .WithMany()
            .HasForeignKey(x => x.ZoneId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(x => x.CreatedByUser)
            .WithMany()
            .HasForeignKey(x => x.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(x => x.FarmId);
        builder.HasIndex(x => x.ServiceRequestId);
        builder.HasIndex(x => x.SurveyDate);
    }
}
