namespace SmartFarm.Domain.Enums;

public enum AiConsultationStatus
{
    Pending,
    Completed,
    Limited,
    Failed
}

public enum AiRecommendationStatus
{
    Ready,
    InsufficientData,
    LowConfidence,
    ProviderUnavailable,
    InvalidProviderOutput,
    Superseded,
    Accepted,
    Rejected,
    Ignored
}

public enum AiRecommendationDecisionType
{
    Accepted,
    Rejected,
    Ignored,
    MoreAnalysisRequested
}
