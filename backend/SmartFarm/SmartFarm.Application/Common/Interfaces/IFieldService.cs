using SmartFarm.Application.Features.Farms;
using SmartFarm.Application.Features.Fields;

namespace SmartFarm.Application.Common.Interfaces;

public interface IFieldService
{
    Task<IReadOnlyList<FieldSummaryView>> ListAsync(Guid ownerUserId, Guid tenantId, Guid farmId, CancellationToken cancellationToken);
    Task<FieldDetailView> CreateAsync(Guid ownerUserId, Guid tenantId, Guid farmId, CreateFieldCommand command, CancellationToken cancellationToken);
    Task<FieldDetailView> GetAsync(Guid ownerUserId, Guid tenantId, Guid fieldId, CancellationToken cancellationToken);
    Task<FieldDetailView> UpdateAsync(Guid ownerUserId, Guid tenantId, Guid fieldId, UpdateFieldCommand command, CancellationToken cancellationToken);
    Task<ArchiveView> ArchiveAsync(Guid ownerUserId, Guid tenantId, Guid fieldId, CancellationToken cancellationToken);
}
