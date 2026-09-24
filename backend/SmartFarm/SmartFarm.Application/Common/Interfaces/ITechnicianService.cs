using SmartFarm.Application.Features.Technicians;

namespace SmartFarm.Application.Common.Interfaces;

public interface ITechnicianService
{
    Task<IReadOnlyList<TechnicianView>> ListAsync(Guid adminUserId, CancellationToken cancellationToken);
    Task<TechnicianView> CreateAsync(Guid adminUserId, CreateTechnicianCommand command, CancellationToken cancellationToken);
    Task<TechnicianView> UpdateAsync(Guid adminUserId, Guid userId, UpdateTechnicianCommand command, CancellationToken cancellationToken);
}
