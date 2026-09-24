using SmartFarm.Application.Features.Tenants;

namespace SmartFarm.Application.Common.Interfaces;

public interface ITenantService
{
    Task<TenantView> RegisterAsync(Guid ownerUserId, RegisterTenantCommand command, CancellationToken cancellationToken);
    Task<TenantView> GetCurrentAsync(Guid ownerUserId, CancellationToken cancellationToken);
    Task<TenantView> UpdateCurrentAsync(Guid ownerUserId, UpdateTenantCommand command, CancellationToken cancellationToken);
}
