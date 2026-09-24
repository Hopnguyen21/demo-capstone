using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartFarm.Domain.Entities;

namespace SmartFarm.Infrastructure.Persistence.Configurations;

internal sealed class AiConsultationRequestConfiguration : IEntityTypeConfiguration<AiConsultationRequest>
{
    public void Configure(EntityTypeBuilder<AiConsultationRequest> b)
    {
        b.ToTable("ai_consultation_requests");
        b.HasKey(x => x.Id); DeploymentRequestConfiguration.IdAudit(b);
        b.Property(x => x.TenantId).HasColumnName("tenant_id");
        b.Property(x => x.FarmId).HasColumnName("farm_id");
        b.Property(x => x.ZoneId).HasColumnName("zone_id");
        b.Property(x => x.RequestedByUserId).HasColumnName("requested_by_user_id");
        b.Property(x => x.ParentRecommendationId).HasColumnName("parent_recommendation_id");
        b.Property(x => x.Question).HasColumnName("question").HasMaxLength(2000);
        b.Property(x => x.ContextSnapshotJson).HasColumnName("context_snapshot").HasColumnType("jsonb");
        b.Property(x => x.MissingDataCsv).HasColumnName("missing_data_csv").HasMaxLength(1000);
        b.Property(x => x.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(30);
        b.Property(x => x.ProviderName).HasColumnName("provider_name").HasMaxLength(100);
        b.Property(x => x.CompletedAtUtc).HasColumnName("completed_at_utc");
        b.Property(x => x.HiddenAtUtc).HasColumnName("hidden_at_utc");
        b.HasIndex(x => new { x.RequestedByUserId, x.ZoneId, x.CreatedAtUtc });
        b.HasIndex(x => new { x.ZoneId, x.HiddenAtUtc, x.CreatedAtUtc });
        b.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<Farm>().WithMany().HasForeignKey(x => x.FarmId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.Zone).WithMany().HasForeignKey(x => x.ZoneId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.RequestedByUser).WithMany().HasForeignKey(x => x.RequestedByUserId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<AiRecommendation>().WithMany().HasForeignKey(x => x.ParentRecommendationId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class AiRecommendationConfiguration : IEntityTypeConfiguration<AiRecommendation>
{
    public void Configure(EntityTypeBuilder<AiRecommendation> b)
    {
        b.ToTable("ai_recommendations", t => t.HasCheckConstraint("ck_ai_recommendation_confidence", "confidence BETWEEN 0 AND 1"));
        b.HasKey(x => x.Id); DeploymentRequestConfiguration.IdAudit(b);
        b.Property(x => x.ConsultationRequestId).HasColumnName("consultation_request_id");
        b.Property(x => x.TenantId).HasColumnName("tenant_id");
        b.Property(x => x.FarmId).HasColumnName("farm_id");
        b.Property(x => x.ZoneId).HasColumnName("zone_id");
        b.Property(x => x.GrowthStageId).HasColumnName("growth_stage_id");
        b.Property(x => x.Summary).HasColumnName("summary").HasMaxLength(500);
        b.Property(x => x.Details).HasColumnName("details").HasMaxLength(4000);
        b.Property(x => x.Limitations).HasColumnName("limitations").HasMaxLength(2000);
        b.Property(x => x.Confidence).HasColumnName("confidence").HasPrecision(5, 4);
        b.Property(x => x.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(30);
        b.Property(x => x.IsActionable).HasColumnName("is_actionable");
        b.Property(x => x.ValidUntilUtc).HasColumnName("valid_until_utc");
        b.Property(x => x.ProposedActuatorId).HasColumnName("proposed_actuator_id");
        b.Property(x => x.ProposedAction).HasColumnName("proposed_action").HasConversion<string>().HasMaxLength(20);
        b.Property(x => x.ProposedDurationSeconds).HasColumnName("proposed_duration_seconds");
        b.HasIndex(x => x.ConsultationRequestId).IsUnique();
        b.HasIndex(x => new { x.ZoneId, x.CreatedAtUtc });
        b.HasOne(x => x.ConsultationRequest).WithOne(x => x.Recommendation).HasForeignKey<AiRecommendation>(x => x.ConsultationRequestId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<Farm>().WithMany().HasForeignKey(x => x.FarmId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<Zone>().WithMany().HasForeignKey(x => x.ZoneId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<GrowthStage>().WithMany().HasForeignKey(x => x.GrowthStageId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<DeviceActuator>().WithMany().HasForeignKey(x => x.ProposedActuatorId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class AiRecommendationDecisionConfiguration : IEntityTypeConfiguration<AiRecommendationDecision>
{
    public void Configure(EntityTypeBuilder<AiRecommendationDecision> b)
    {
        b.ToTable("ai_recommendation_decisions");
        b.HasKey(x => x.Id); DeploymentRequestConfiguration.IdAudit(b);
        b.Property(x => x.RecommendationId).HasColumnName("recommendation_id");
        b.Property(x => x.OwnerUserId).HasColumnName("owner_user_id");
        b.Property(x => x.DecisionType).HasColumnName("decision_type").HasConversion<string>().HasMaxLength(30);
        b.Property(x => x.Reason).HasColumnName("reason").HasMaxLength(1000);
        b.Property(x => x.ActuatorCommandId).HasColumnName("actuator_command_id");
        b.Property(x => x.FollowUpConsultationId).HasColumnName("follow_up_consultation_id");
        b.HasIndex(x => x.RecommendationId).IsUnique();
        b.HasOne(x => x.Recommendation).WithMany(x => x.Decisions).HasForeignKey(x => x.RecommendationId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.OwnerUser).WithMany().HasForeignKey(x => x.OwnerUserId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.ActuatorCommand).WithMany().HasForeignKey(x => x.ActuatorCommandId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<AiConsultationRequest>().WithMany().HasForeignKey(x => x.FollowUpConsultationId).OnDelete(DeleteBehavior.Restrict);
    }
}
