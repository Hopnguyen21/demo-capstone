using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Application.Features.Ai;

namespace SmartFarm.Infrastructure.Ai;

public sealed class UnavailableAiAdvisoryProvider : IAiAdvisoryProvider
{
    public Task<AiProviderResult> GenerateAsync(AiProviderRequest request, CancellationToken cancellationToken) =>
        throw new InvalidOperationException("No AI advisory provider is configured.");
}

public sealed class UnavailableAiWeatherProvider : IAiWeatherProvider
{
    public Task<AiWeatherResult> GetAsync(Guid farmId, Guid zoneId, CancellationToken cancellationToken) =>
        Task.FromResult(new AiWeatherResult(false, null, null, null, null, "Weather provider is not configured."));
}
