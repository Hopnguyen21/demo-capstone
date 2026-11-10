using SmartFarm.Domain.Enums;

namespace SmartFarm.Application.Features.Finance;

public sealed record ContractPackageView(
    Guid Id,
    string PackageName,
    string? Description,
    int DurationMonths,
    int MaxZones,
    decimal Price,
    string Currency,
    PackageStatus Status,
    string StatusText,
    Guid CreatedByUserId,
    string CreatedByName,
    DateTime CreatedAtUtc,
    DateTime? UpdatedAtUtc,
    bool IsCustom = false,
    string? CustomerName = null,
    Guid? ContractId = null);

public sealed record CreateContractPackageCommand(
    string PackageName,
    string? Description,
    int DurationMonths,
    int MaxZones,
    decimal Price,
    string? Currency);

public sealed record UpdateContractPackageCommand(
    string PackageName,
    string? Description,
    int DurationMonths,
    int MaxZones,
    decimal Price,
    string? Currency,
    PackageStatus? Status);

public interface IContractPackageService
{
    Task<IReadOnlyList<ContractPackageView>> GetAllPackagesAsync(bool? activeOnly, bool? isCustom = false, CancellationToken ct = default);
    Task<ContractPackageView> GetPackageByIdAsync(Guid id, CancellationToken ct);
    Task<ContractPackageView> CreatePackageAsync(Guid userId, CreateContractPackageCommand command, CancellationToken ct);
    Task<ContractPackageView> UpdatePackageAsync(Guid userId, Guid id, UpdateContractPackageCommand command, CancellationToken ct);
    Task<ContractPackageView> TogglePackageStatusAsync(Guid userId, Guid id, CancellationToken ct);
    Task DeletePackageAsync(Guid userId, Guid id, CancellationToken ct);
}

