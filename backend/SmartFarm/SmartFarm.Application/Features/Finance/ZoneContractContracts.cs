using SmartFarm.Domain.Enums;

namespace SmartFarm.Application.Features.Finance;

public sealed record ZoneContractView(
    Guid Id,
    Guid TenantId,
    Guid FarmId,
    string FarmName,
    Guid ZoneId,
    string ZoneName,
    Guid CreatedByOwnerId,
    Guid? ParentContractId,
    string? ParentContractNumber,
    string ContractNumber,
    string? CropType,
    decimal MonthlyRentVnd,
    decimal DepositVnd,
    decimal TotalContractValueVnd,
    DateOnly StartDate,
    DateOnly EndDate,
    ZoneContractStatus Status,
    string StatusText,
    int DaysRemaining,
    string LesseeName,
    string? LesseePhone,
    string? LesseeIdentityNumber,
    string? LesseeAddress,
    string? SpecialTerms,
    string? Notes,
    DateTime? SignedAtUtc,
    IReadOnlyList<ZoneContractRenewalView> Renewals,
    DateTime CreatedAtUtc);

public sealed record ZoneContractRenewalView(
    Guid Id,
    Guid ContractId,
    Guid CreatedByOwnerId,
    DateOnly NewEndDate,
    decimal? NewMonthlyRentVnd,
    decimal RenewalValueVnd,
    string? Notes,
    DateTime CreatedAtUtc);

public sealed record CreateZoneContractCommand(
    Guid FarmId,
    Guid? ParentContractId,
    string? ContractNumber,
    string? CropType,
    decimal MonthlyRentVnd,
    decimal DepositVnd,
    decimal TotalContractValueVnd,
    decimal? DiscountPercent,
    decimal? DiscountAmount,
    DateOnly StartDate,
    DateOnly EndDate,
    string LesseeName,
    string? LesseePhone,
    string? LesseeIdentityNumber,
    string? LesseeAddress,
    string? SpecialTerms,
    string? Notes);

public sealed record RenewZoneContractCommand(
    string DurationPreset, // "6_MONTHS", "1_YEAR", "3_YEARS", "CUSTOM"
    DateOnly? CustomEndDate,
    decimal? NewMonthlyRentVnd,
    decimal? DiscountPercent,
    decimal? DiscountAmount,
    string? Notes);

public sealed record DeviceDepreciationView(
    Guid Id,
    Guid ZoneId,
    string ZoneName,
    Guid DeviceId,
    string DeviceName,
    string HardwareAddress,
    string DeviceType,
    decimal OriginalCostVnd,
    decimal MonthlyDepreciationVnd,
    decimal AccumulatedDepreciationVnd,
    decimal CurrentBookValueVnd,
    int DepreciationLifetimeMonths,
    int MonthsElapsed,
    int RemainingMonths,
    string Method,
    DateOnly StartDate,
    string DepreciationStatus, // "Active", "ExpiringSoon", "FullyDepreciated"
    bool IsNearContractRenewal,
    string? Notes,
    DateTime CreatedAtUtc);

public sealed record CreateDeviceDepreciationCommand(
    Guid DeviceId,
    decimal OriginalCostVnd,
    int DepreciationLifetimeMonths,
    DateOnly StartDate,
    string? Notes);

public sealed record ExpiringContractAlertView(
    Guid ContractId,
    string ContractNumber,
    Guid FarmId,
    string FarmName,
    Guid ZoneId,
    string ZoneName,
    string? CropType,
    DateOnly EndDate,
    int DaysRemaining,
    ZoneContractStatus Status,
    decimal TotalContractValueVnd);

public interface IZoneContractService
{
    Task<IReadOnlyList<ZoneContractView>> GetAllContractsAsync(Guid ownerId, CancellationToken ct);
    Task<IReadOnlyList<ZoneContractView>> GetContractsByZoneAsync(Guid ownerId, Guid zoneId, CancellationToken ct);
    Task<IReadOnlyList<ZoneContractView>> GetContractsByFarmAsync(Guid ownerId, Guid farmId, CancellationToken ct);
    Task<ZoneContractView> GetContractByIdAsync(Guid ownerId, Guid contractId, CancellationToken ct);
    Task<ZoneContractView> CreateContractAsync(Guid ownerId, Guid tenantId, Guid zoneId, CreateZoneContractCommand command, CancellationToken ct);
    Task<ZoneContractView> RenewContractAsync(Guid ownerId, Guid contractId, RenewZoneContractCommand command, CancellationToken ct);
    Task<IReadOnlyList<ExpiringContractAlertView>> GetExpiringContractsAsync(Guid ownerId, Guid? farmId, int daysThreshold, CancellationToken ct);
    Task<IReadOnlyList<DeviceDepreciationView>> GetDepreciationsByZoneAsync(Guid ownerId, Guid zoneId, CancellationToken ct);
    Task<IReadOnlyList<DeviceDepreciationView>> GetDepreciationsByFarmAsync(Guid ownerId, Guid farmId, CancellationToken ct);
    Task<DeviceDepreciationView> CreateDepreciationAsync(Guid ownerId, Guid tenantId, Guid zoneId, CreateDeviceDepreciationCommand command, CancellationToken ct);
}
