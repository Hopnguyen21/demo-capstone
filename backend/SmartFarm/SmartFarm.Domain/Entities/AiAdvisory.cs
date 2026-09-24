using SmartFarm.Domain.Common;
using SmartFarm.Domain.Enums;

namespace SmartFarm.Domain.Entities;

public sealed class AiConsultationRequest : AuditableEntity
{
    public Guid TenantId { get; set; }
    public Guid FarmId { get; set; }
    public Guid ZoneId { get; set; }
    public Zone Zone { get; set; } = null!;
    public Guid RequestedByUserId { get; set; }
    public AppUser RequestedByUser { get; set; } = null!;
    public Guid? ParentRecommendationId { get; set; }
    public string Question { get; set; } = string.Empty;
    public string ContextSnapshotJson { get; set; } = "{}";
    public string? MissingDataCsv { get; set; }
    public AiConsultationStatus Status { get; set; } = AiConsultationStatus.Pending;
    public string? ProviderName { get; set; }
    public DateTime? CompletedAtUtc { get; set; }
    public DateTime? HiddenAtUtc { get; set; }
    public AiRecommendation? Recommendation { get; set; }
}

public sealed class AiRecommendation : AuditableEntity
{
    public Guid ConsultationRequestId { get; set; }
    public AiConsultationRequest ConsultationRequest { get; set; } = null!;
    public Guid TenantId { get; set; }
    public Guid FarmId { get; set; }
    public Guid ZoneId { get; set; }
    public Guid? GrowthStageId { get; set; }
    public string Summary { get; set; } = string.Empty;
    public string Details { get; set; } = string.Empty;
    public string? Limitations { get; set; }
    public decimal Confidence { get; set; }
    public AiRecommendationStatus Status { get; set; }
    public bool IsActionable { get; set; }
    public DateTime ValidUntilUtc { get; set; }
    public Guid? ProposedActuatorId { get; set; }
    public ActuatorCommandAction? ProposedAction { get; set; }
    public int? ProposedDurationSeconds { get; set; }
    public ICollection<AiRecommendationDecision> Decisions { get; } = new List<AiRecommendationDecision>();
}

public sealed class AiRecommendationDecision : AuditableEntity
{
    public Guid RecommendationId { get; set; }
    public AiRecommendation Recommendation { get; set; } = null!;
    public Guid OwnerUserId { get; set; }
    public AppUser OwnerUser { get; set; } = null!;
    public AiRecommendationDecisionType DecisionType { get; set; }
    public string? Reason { get; set; }
    public Guid? ActuatorCommandId { get; set; }
    public ActuatorCommand? ActuatorCommand { get; set; }
    public Guid? FollowUpConsultationId { get; set; }
}
