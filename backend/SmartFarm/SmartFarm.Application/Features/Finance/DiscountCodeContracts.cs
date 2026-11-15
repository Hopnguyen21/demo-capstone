using SmartFarm.Domain.Entities;

namespace SmartFarm.Application.Features.Finance;

public sealed record DiscountCodeView(
    Guid Id,
    string Code,
    string Description,
    DiscountType DiscountType,
    string DiscountTypeText,
    decimal DiscountValue,
    decimal MinContractValue,
    decimal? MaxDiscountAmount,
    DateTime? StartDateUtc,
    DateTime? EndDateUtc,
    int? UsageLimit,
    int UsedCount,
    bool IsActive,
    Guid CreatedByUserId,
    string CreatedByName,
    DateTime CreatedAtUtc);

public sealed record CreateDiscountCodeCommand(
    string Code,
    string Description,
    DiscountType DiscountType,
    decimal DiscountValue,
    decimal MinContractValue,
    decimal? MaxDiscountAmount,
    DateTime? StartDateUtc,
    DateTime? EndDateUtc,
    int? UsageLimit,
    bool IsActive);

public sealed record UpdateDiscountCodeCommand(
    string Description,
    DiscountType DiscountType,
    decimal DiscountValue,
    decimal MinContractValue,
    decimal? MaxDiscountAmount,
    DateTime? StartDateUtc,
    DateTime? EndDateUtc,
    int? UsageLimit,
    bool IsActive);

public sealed record ValidateDiscountRequest(
    string Code,
    decimal ContractAmount);

public sealed record ValidateDiscountResult(
    bool IsValid,
    string? Message,
    string? Code,
    DiscountType? DiscountType,
    decimal DiscountPercent,
    decimal DiscountAmount,
    decimal FinalAmount);

public sealed record BestDiscountResult(
    bool HasDiscount,
    string? Code,
    string? Description,
    DiscountType? DiscountType,
    decimal DiscountPercent,
    decimal DiscountAmount,
    decimal FinalAmount,
    string? Note);

public interface IDiscountCodeService
{
    Task<IReadOnlyList<DiscountCodeView>> GetAllAsync(bool activeOnly, CancellationToken ct);
    Task<DiscountCodeView> GetByIdAsync(Guid id, CancellationToken ct);
    Task<DiscountCodeView> CreateAsync(Guid adminUserId, CreateDiscountCodeCommand command, CancellationToken ct);
    Task<DiscountCodeView> UpdateAsync(Guid adminUserId, Guid id, UpdateDiscountCodeCommand command, CancellationToken ct);
    Task DeleteAsync(Guid adminUserId, Guid id, CancellationToken ct);
    Task<ValidateDiscountResult> ValidateCodeAsync(string code, decimal contractAmount, CancellationToken ct);
    Task<BestDiscountResult> GetBestDiscountAsync(decimal contractAmount, CancellationToken ct);
}
