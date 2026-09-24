using SmartFarm.Domain.Enums;

namespace SmartFarm.Application.Features.Tenants;

public sealed record RegisterTenantCommand(string CompanyName, string Subdomain, string? TaxCode, string? Address, string? LogoUrl);
public sealed record UpdateTenantCommand(string CompanyName, string? TaxCode, string? Address, string? LogoUrl);
public sealed record TenantStatsView(int TotalFarms, int TotalZones, int ActiveUsers);
public sealed record TenantView(
    Guid TenantId,
    string CompanyName,
    string Subdomain,
    string? TaxCode,
    string? Address,
    string? LogoUrl,
    TenantStatus Status,
    TenantStatsView Stats,
    DateTime CreatedAtUtc,
    DateTime? UpdatedAtUtc);
