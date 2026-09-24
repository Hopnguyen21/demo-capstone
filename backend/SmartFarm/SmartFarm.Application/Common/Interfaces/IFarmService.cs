using SmartFarm.Application.Features.Farms;
using SmartFarm.Domain.Enums;

namespace SmartFarm.Application.Common.Interfaces;

public interface IFarmService
{
    Task<IReadOnlyList<FarmSummaryView>> ListAsync(Guid ownerUserId, Guid tenantId, FarmStatus? status, CancellationToken cancellationToken);
    Task<FarmDetailView> CreateAsync(Guid ownerUserId, Guid tenantId, CreateFarmCommand command, CancellationToken cancellationToken);
    Task<FarmDetailView> GetAsync(Guid ownerUserId, Guid tenantId, Guid farmId, CancellationToken cancellationToken);
    Task<FarmDetailView> UpdateAsync(Guid ownerUserId, Guid tenantId, Guid farmId, UpdateFarmCommand command, CancellationToken cancellationToken);
    Task<ArchiveView> ArchiveAsync(Guid ownerUserId, Guid tenantId, Guid farmId, CancellationToken cancellationToken);
    Task<FarmStructureView> GetStructureAsync(Guid ownerUserId, Guid tenantId, Guid farmId, CancellationToken cancellationToken);
}
