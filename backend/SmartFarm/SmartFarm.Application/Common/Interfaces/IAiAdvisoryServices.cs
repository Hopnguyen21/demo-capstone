using SmartFarm.Application.Features.Ai;

namespace SmartFarm.Application.Common.Interfaces;

public interface IAiAdvisoryProvider
{
    Task<AiProviderResult> GenerateAsync(AiProviderRequest request, CancellationToken cancellationToken);
}

public interface IAiWeatherProvider
{
    Task<AiWeatherResult> GetAsync(Guid farmId, Guid zoneId, CancellationToken cancellationToken);
}

public interface IAiAdvisoryService
{
    Task<AiZoneContext> GetContextAsync(Guid ownerId, Guid tenantId, Guid zoneId, CancellationToken cancellationToken);
    Task<AiRecommendationView> AskAsync(Guid ownerId, Guid tenantId, Guid zoneId, AskAiCommand command, CancellationToken cancellationToken);
    Task<AiDecisionResult> DecideAsync(Guid ownerId, Guid tenantId, Guid zoneId, DecideRecommendationCommand command, CancellationToken cancellationToken);
    Task<AiHistoryView> GetHistoryAsync(Guid ownerId, Guid tenantId, Guid zoneId, CancellationToken cancellationToken);
    Task HideHistoryAsync(Guid ownerId, Guid tenantId, Guid zoneId, CancellationToken cancellationToken);
}
