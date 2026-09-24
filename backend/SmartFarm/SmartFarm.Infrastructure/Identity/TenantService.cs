using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using SmartFarm.Application.Common.Exceptions;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Application.Features.Tenants;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;

namespace SmartFarm.Infrastructure.Identity;

internal sealed partial class TenantService(SmartFarmDbContext dbContext, TimeProvider timeProvider) : ITenantService
{
    public async Task<TenantView> RegisterAsync(
        Guid ownerUserId,
        RegisterTenantCommand command,
        CancellationToken cancellationToken)
    {
        var owner = await GetOwnerAsync(ownerUserId, requireTenant: false, cancellationToken);
        if (owner.TenantId.HasValue)
        {
            throw new ResourceConflictException("The FarmOwner already belongs to a Tenant.");
        }

        var subdomain = command.Subdomain.Trim().ToLowerInvariant();
        if (!SubdomainPattern().IsMatch(subdomain))
        {
            throw new RequestValidationException(nameof(command.Subdomain),
                "Subdomain must be 3-30 lower-case letters, digits or hyphens and cannot start or end with a hyphen.");
        }

        if (await dbContext.Tenants.AnyAsync(x => x.Subdomain == subdomain, cancellationToken))
        {
            throw new ResourceConflictException("The subdomain is already registered.");
        }

        var now = timeProvider.GetUtcNow().UtcDateTime;
        var tenant = new Tenant
        {
            CompanyName = AuthService.RequireText(command.CompanyName, nameof(command.CompanyName), 200),
            Subdomain = subdomain,
            TaxCode = AuthService.NormalizeOptional(command.TaxCode, 30),
            Address = AuthService.NormalizeOptional(command.Address, 500),
            LogoUrl = ValidateLogoUrl(command.LogoUrl),
            Status = TenantStatus.Active,
            CreatedAtUtc = now
        };

        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);
        dbContext.Tenants.Add(tenant);
        owner.Tenant = tenant;
        owner.UpdatedAtUtc = now;
        await dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return ToView(tenant, new TenantStatsView(0, 0, 1));
    }

    public async Task<TenantView> GetCurrentAsync(Guid ownerUserId, CancellationToken cancellationToken)
    {
        var owner = await GetOwnerAsync(ownerUserId, requireTenant: true, cancellationToken);
        return await LoadViewAsync(owner.TenantId!.Value, cancellationToken);
    }

    public async Task<TenantView> UpdateCurrentAsync(
        Guid ownerUserId,
        UpdateTenantCommand command,
        CancellationToken cancellationToken)
    {
        var owner = await GetOwnerAsync(ownerUserId, requireTenant: true, cancellationToken);
        var tenant = await dbContext.Tenants.SingleAsync(x => x.Id == owner.TenantId, cancellationToken);
        tenant.CompanyName = AuthService.RequireText(command.CompanyName, nameof(command.CompanyName), 200);
        tenant.TaxCode = AuthService.NormalizeOptional(command.TaxCode, 30);
        tenant.Address = AuthService.NormalizeOptional(command.Address, 500);
        tenant.LogoUrl = ValidateLogoUrl(command.LogoUrl);
        tenant.UpdatedAtUtc = timeProvider.GetUtcNow().UtcDateTime;
        await dbContext.SaveChangesAsync(cancellationToken);
        return await LoadViewAsync(tenant.Id, cancellationToken);
    }

    private async Task<AppUser> GetOwnerAsync(Guid userId, bool requireTenant, CancellationToken cancellationToken)
    {
        var owner = await dbContext.AppUsers.SingleOrDefaultAsync(x => x.Id == userId, cancellationToken);
        if (owner is null || owner.Role != UserRole.FarmOwner || (requireTenant && !owner.TenantId.HasValue))
        {
            throw new AuthorizationException("A FarmOwner account in the required onboarding state is required.");
        }

        return owner;
    }

    private async Task<TenantView> LoadViewAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        var tenant = await dbContext.Tenants.AsNoTracking().SingleAsync(x => x.Id == tenantId, cancellationToken);
        var totalFarms = await dbContext.Farms.CountAsync(x => x.TenantId == tenantId, cancellationToken);
        var totalZones = await dbContext.Zones.CountAsync(x => x.Field.Farm.TenantId == tenantId, cancellationToken);
        var activeUsers = await dbContext.AppUsers.CountAsync(
            x => x.TenantId == tenantId && x.Status == AccountStatus.Active,
            cancellationToken);
        return ToView(tenant, new TenantStatsView(totalFarms, totalZones, activeUsers));
    }

    private static TenantView ToView(Tenant tenant, TenantStatsView stats) => new(
        tenant.Id,
        tenant.CompanyName,
        tenant.Subdomain,
        tenant.TaxCode,
        tenant.Address,
        tenant.LogoUrl,
        tenant.Status,
        stats,
        tenant.CreatedAtUtc,
        tenant.UpdatedAtUtc);

    private static string? ValidateLogoUrl(string? value)
    {
        var normalized = AuthService.NormalizeOptional(value, 2048);
        if (normalized is not null &&
            (!Uri.TryCreate(normalized, UriKind.Absolute, out var uri) || uri.Scheme is not ("http" or "https")))
        {
            throw new RequestValidationException(nameof(value), "Logo URL must be an absolute HTTP or HTTPS URL.");
        }

        return normalized;
    }

    [GeneratedRegex("^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$")]
    private static partial Regex SubdomainPattern();
}
