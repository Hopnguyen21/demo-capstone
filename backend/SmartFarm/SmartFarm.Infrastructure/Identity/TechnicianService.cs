using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using SmartFarm.Application.Common.Exceptions;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Application.Features.Technicians;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;

namespace SmartFarm.Infrastructure.Identity;

internal sealed class TechnicianService(
    SmartFarmDbContext dbContext,
    IPasswordHasher<AppUser> passwordHasher,
    TimeProvider timeProvider) : ITechnicianService
{
    public async Task<IReadOnlyList<TechnicianView>> ListAsync(Guid adminUserId, CancellationToken cancellationToken)
    {
        await EnsureAdminAsync(adminUserId, cancellationToken);
        var technicians = await dbContext.AppUsers.AsNoTracking()
            .Where(x => x.Role == UserRole.PlatformTechnician)
            .OrderBy(x => x.FullName)
            .ToListAsync(cancellationToken);
        return technicians.Select(ToView).ToList();
    }

    public async Task<TechnicianView> CreateAsync(
        Guid adminUserId,
        CreateTechnicianCommand command,
        CancellationToken cancellationToken)
    {
        await EnsureAdminAsync(adminUserId, cancellationToken);
        AuthService.ValidatePassword(command.InitialPassword);
        var normalizedEmail = AuthService.NormalizeEmail(command.Email);
        if (await dbContext.AppUsers.AnyAsync(x => x.NormalizedEmail == normalizedEmail, cancellationToken))
        {
            throw new ResourceConflictException("An account with this email already exists.");
        }

        var technician = new AppUser
        {
            Email = command.Email.Trim(),
            NormalizedEmail = normalizedEmail,
            FullName = AuthService.RequireText(command.FullName, nameof(command.FullName), 150),
            Phone = AuthService.NormalizeOptional(command.Phone, 20),
            Role = UserRole.PlatformTechnician,
            Status = AccountStatus.Active,
            CreatedAtUtc = timeProvider.GetUtcNow().UtcDateTime
        };
        technician.PasswordHash = passwordHasher.HashPassword(technician, command.InitialPassword);
        dbContext.AppUsers.Add(technician);
        await dbContext.SaveChangesAsync(cancellationToken);
        return ToView(technician);
    }

    public async Task<TechnicianView> UpdateAsync(
        Guid adminUserId,
        Guid userId,
        UpdateTechnicianCommand command,
        CancellationToken cancellationToken)
    {
        await EnsureAdminAsync(adminUserId, cancellationToken);
        var technician = await dbContext.AppUsers.SingleOrDefaultAsync(
            x => x.Id == userId && x.Role == UserRole.PlatformTechnician,
            cancellationToken);
        if (technician is null)
        {
            throw new ResourceNotFoundException("PlatformTechnician was not found.");
        }

        if (command.Status is AccountStatus.Invited or AccountStatus.Locked)
        {
            throw new RequestValidationException(nameof(command.Status), "Technician status may be Active or Disabled.");
        }

        technician.FullName = AuthService.RequireText(command.FullName, nameof(command.FullName), 150);
        technician.Phone = AuthService.NormalizeOptional(command.Phone, 20);
        technician.Status = command.Status;
        technician.UpdatedAtUtc = timeProvider.GetUtcNow().UtcDateTime;
        if (command.Status == AccountStatus.Disabled)
        {
            var activeSessions = await dbContext.RefreshTokens
                .Where(x => x.AppUserId == technician.Id && x.RevokedAtUtc == null)
                .ToListAsync(cancellationToken);
            foreach (var session in activeSessions)
            {
                session.RevokedAtUtc = technician.UpdatedAtUtc;
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return ToView(technician);
    }

    private async Task EnsureAdminAsync(Guid userId, CancellationToken cancellationToken)
    {
        var isAdmin = await dbContext.AppUsers.AnyAsync(
            x => x.Id == userId && x.Role == UserRole.PlatformAdmin && x.Status == AccountStatus.Active &&
                 x.TenantId == null && x.FarmId == null,
            cancellationToken);
        if (!isAdmin)
        {
            throw new AuthorizationException("PlatformAdmin is required.");
        }
    }

    private static TechnicianView ToView(AppUser user) => new(
        user.Id,
        user.Email,
        user.FullName,
        user.Phone,
        user.Status,
        user.CreatedAtUtc);
}
