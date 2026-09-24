using SmartFarm.Application.Features.Users;
using SmartFarm.Domain.Enums;

namespace SmartFarm.Application.Common.Interfaces;

public interface IUserService
{
    Task<IReadOnlyList<UserDetailView>> ListTenantUsersAsync(Guid ownerUserId, UserRole? role, CancellationToken cancellationToken);
    Task<UserDetailView> GetTenantUserAsync(Guid ownerUserId, Guid userId, CancellationToken cancellationToken);
    Task<UserDetailView> GetCurrentUserAsync(Guid userId, CancellationToken cancellationToken);
    Task<FarmerAssignmentView> InviteFarmerAsync(Guid ownerUserId, InviteFarmerCommand command, CancellationToken cancellationToken);
    Task<ZoneAccessView> ReplaceZoneAccessAsync(Guid ownerUserId, Guid farmerUserId, ReplaceZoneAccessCommand command, CancellationToken cancellationToken);
}
