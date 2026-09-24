using Microsoft.EntityFrameworkCore;
using SmartFarm.Application.Common.Exceptions;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Application.Features.Users;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;

namespace SmartFarm.Infrastructure.Identity;

internal sealed class UserService(SmartFarmDbContext dbContext, TimeProvider timeProvider) : IUserService
{
    public async Task<IReadOnlyList<UserDetailView>> ListTenantUsersAsync(
        Guid ownerUserId,
        UserRole? role,
        CancellationToken cancellationToken)
    {
        var owner = await GetOwnerAsync(ownerUserId, cancellationToken);
        var query = dbContext.AppUsers
            .AsNoTracking()
            .Include(x => x.ZoneAccesses)
            .Where(x => x.TenantId == owner.TenantId);
        if (role.HasValue)
        {
            query = query.Where(x => x.Role == role.Value);
        }

        var users = await query.OrderBy(x => x.FullName).ToListAsync(cancellationToken);
        return users.Select(ToDetailView).ToList();
    }

    public async Task<UserDetailView> GetTenantUserAsync(Guid ownerUserId, Guid userId, CancellationToken cancellationToken)
    {
        var owner = await GetOwnerAsync(ownerUserId, cancellationToken);
        var user = await dbContext.AppUsers
            .AsNoTracking()
            .Include(x => x.ZoneAccesses)
            .SingleOrDefaultAsync(x => x.Id == userId && x.TenantId == owner.TenantId, cancellationToken);

        return user is null
            ? throw new ResourceNotFoundException("User was not found in the current Tenant.")
            : ToDetailView(user);
    }

    public async Task<UserDetailView> GetCurrentUserAsync(Guid userId, CancellationToken cancellationToken)
    {
        var user = await dbContext.AppUsers
            .AsNoTracking()
            .Include(x => x.ZoneAccesses)
            .SingleOrDefaultAsync(x => x.Id == userId, cancellationToken);

        return user is null
            ? throw new ResourceNotFoundException("User was not found.")
            : ToDetailView(user);
    }

    public async Task<FarmerAssignmentView> InviteFarmerAsync(
        Guid ownerUserId,
        InviteFarmerCommand command,
        CancellationToken cancellationToken)
    {
        var owner = await GetOwnerAsync(ownerUserId, cancellationToken);
        var farm = await dbContext.Farms.SingleOrDefaultAsync(
            x => x.Id == command.FarmId && x.TenantId == owner.TenantId,
            cancellationToken);
        if (farm is null)
        {
            throw new ResourceNotFoundException("Farm was not found in the current Tenant.");
        }

        var normalizedEmail = AuthService.NormalizeEmail(command.Email);
        var farmer = await dbContext.AppUsers.SingleOrDefaultAsync(
            x => x.NormalizedEmail == normalizedEmail,
            cancellationToken);
        if (farmer is null || farmer.Role != UserRole.Farmer)
        {
            throw new ResourceNotFoundException("An eligible Farmer account was not found.");
        }

        if (farmer.Status != AccountStatus.Active)
        {
            throw new ResourceConflictException("The Farmer account is not active.");
        }

        if (farmer.TenantId.HasValue || farmer.FarmId.HasValue)
        {
            throw new ResourceConflictException("The Farmer already belongs to a Farm.");
        }

        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);
        farmer.TenantId = owner.TenantId;
        farmer.FarmId = farm.Id;
        farmer.UpdatedAtUtc = timeProvider.GetUtcNow().UtcDateTime;
        await dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return new FarmerAssignmentView(
            farmer.Id,
            owner.TenantId!.Value,
            farm.Id,
            farmer.Status,
            farmer.UpdatedAtUtc.Value);
    }

    public async Task<ZoneAccessView> ReplaceZoneAccessAsync(
        Guid ownerUserId,
        Guid farmerUserId,
        ReplaceZoneAccessCommand command,
        CancellationToken cancellationToken)
    {
        var owner = await GetOwnerAsync(ownerUserId, cancellationToken);
        var farmer = await dbContext.AppUsers
            .Include(x => x.ZoneAccesses)
            .SingleOrDefaultAsync(
                x => x.Id == farmerUserId && x.TenantId == owner.TenantId && x.Role == UserRole.Farmer,
                cancellationToken);
        if (farmer?.FarmId is null)
        {
            throw new ResourceNotFoundException("Assigned Farmer was not found in the current Tenant.");
        }

        var duplicateZone = command.Access.GroupBy(x => x.ZoneId).FirstOrDefault(x => x.Count() > 1);
        if (duplicateZone is not null)
        {
            throw new RequestValidationException(nameof(command.Access), "Zone IDs must be unique.");
        }

        var requestedZoneIds = command.Access.Select(x => x.ZoneId).ToArray();
        var validZoneIds = await dbContext.Zones
            .Where(x => requestedZoneIds.Contains(x.Id) && x.Field.FarmId == farmer.FarmId)
            .Select(x => x.Id)
            .ToListAsync(cancellationToken);
        if (validZoneIds.Count != requestedZoneIds.Length)
        {
            throw new ResourceNotFoundException("One or more Zones are outside the Farmer's assigned Farm.");
        }

        var now = timeProvider.GetUtcNow().UtcDateTime;
        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);
        dbContext.UserZoneAccesses.RemoveRange(farmer.ZoneAccesses);
        var newAccess = command.Access.Select(x => new UserZoneAccess
        {
            AppUserId = farmer.Id,
            ZoneId = x.ZoneId,
            CanControl = x.CanControl,
            AssignedAtUtc = now
        }).ToList();
        dbContext.UserZoneAccesses.AddRange(newAccess);
        await dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return new ZoneAccessView(
            farmer.Id,
            farmer.FarmId.Value,
            newAccess.Select(x => new ZonePermissionView(x.ZoneId, x.CanControl)).ToList(),
            now);
    }

    private async Task<AppUser> GetOwnerAsync(Guid userId, CancellationToken cancellationToken)
    {
        var owner = await dbContext.AppUsers.SingleOrDefaultAsync(x => x.Id == userId, cancellationToken);
        if (owner is null || owner.Role != UserRole.FarmOwner || !owner.TenantId.HasValue)
        {
            throw new AuthorizationException("A FarmOwner with a Tenant is required.");
        }

        return owner;
    }

    private static UserDetailView ToDetailView(AppUser user) => new(
        user.Id,
        user.Email,
        user.FullName,
        user.Phone,
        user.Role,
        user.Status,
        user.TenantId,
        user.FarmId,
        user.LastLoginAtUtc,
        user.ZoneAccesses.Select(x => new ZonePermissionView(x.ZoneId, x.CanControl)).ToList());
}
