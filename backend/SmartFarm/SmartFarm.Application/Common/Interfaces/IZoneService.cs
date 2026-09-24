using SmartFarm.Application.Features.Farms;
using SmartFarm.Application.Features.Zones;
using SmartFarm.Domain.Enums;

namespace SmartFarm.Application.Common.Interfaces;

public interface IZoneService
{
    Task<IReadOnlyList<ZoneView>> ListAsync(Guid ownerUserId, Guid tenantId, Guid fieldId, ZoneStatus? status, CancellationToken cancellationToken);
    Task<ZoneView> CreateAsync(Guid ownerUserId, Guid tenantId, Guid fieldId, CreateZoneCommand command, CancellationToken cancellationToken);
    Task<ZoneView> GetAsync(Guid ownerUserId, Guid tenantId, Guid zoneId, CancellationToken cancellationToken);
    Task<ZoneView> UpdateAsync(Guid ownerUserId, Guid tenantId, Guid zoneId, UpdateZoneCommand command, CancellationToken cancellationToken);
    Task<ArchiveView> ArchiveAsync(Guid ownerUserId, Guid tenantId, Guid zoneId, CancellationToken cancellationToken);
}
