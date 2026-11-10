using SmartFarm.Domain.Enums;

namespace SmartFarm.Application.Features.Finance;

public sealed record BillView(
    Guid Id,
    Guid TenantId,
    string BillCode,
    Guid ContractId,
    string ContractNumber,
    Guid? CustomerTenantId,
    string LesseeName,
    decimal Amount,
    decimal PaidAmount,
    decimal RemainingAmount,
    BillStatus Status,
    string StatusText,
    DateOnly IssueDate,
    DateOnly DueDate,
    DateTime? PaidDate,
    string? PaymentMethod,
    string? Notes,
    Guid CreatedByUserId,
    string CreatedByName,
    DateTime CreatedAtUtc,
    DateTime? UpdatedAtUtc);

public sealed record CreateBillFromContractCommand(
    Guid ContractId,
    decimal? Amount,
    DateOnly DueDate,
    string? PaymentMethod,
    string? Notes);

public sealed record CreateBillCommand(
    Guid ContractId,
    decimal Amount,
    DateOnly IssueDate,
    DateOnly DueDate,
    string? PaymentMethod,
    string? Notes);

public sealed record RecordBillPaymentCommand(
    decimal PaymentAmount,
    string? PaymentMethod,
    string? Notes);

public sealed record UpdateBillStatusCommand(
    BillStatus Status,
    string? Notes);

public sealed record UpdateBillCommand(
    decimal Amount,
    DateOnly DueDate,
    string? PaymentMethod,
    string? Notes);

public interface IBillService
{
    Task<IReadOnlyList<BillView>> GetBillsAsync(Guid userId, Guid? tenantId, Guid? contractId, BillStatus? status, DateOnly? fromDate, DateOnly? toDate, CancellationToken ct);
    Task<BillView> GetBillByIdAsync(Guid userId, Guid? tenantId, Guid id, CancellationToken ct);
    Task<IReadOnlyList<BillView>> GetBillsByContractAsync(Guid userId, Guid? tenantId, Guid contractId, CancellationToken ct);
    Task<BillView> CreateBillFromContractAsync(Guid userId, Guid? tenantId, CreateBillFromContractCommand command, CancellationToken ct);
    Task<BillView> RecordPaymentAsync(Guid userId, Guid? tenantId, Guid billId, RecordBillPaymentCommand command, CancellationToken ct);
    Task<BillView> UpdateBillStatusAsync(Guid userId, Guid? tenantId, Guid billId, UpdateBillStatusCommand command, CancellationToken ct);
    Task<BillView> UpdateBillAsync(Guid userId, Guid? tenantId, Guid billId, UpdateBillCommand command, CancellationToken ct);
    Task DeleteBillAsync(Guid userId, Guid? tenantId, Guid billId, CancellationToken ct);
}

