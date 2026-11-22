namespace SmartFarm.Application.Features.Finance;

public sealed record PayOSConfigView(
    string ClientId,
    string ApiKeyMasked,
    string ChecksumKeyMasked,
    bool IsConfigured);

public sealed record UpdatePayOSConfigCommand(
    string ClientId,
    string? ApiKey,
    string? ChecksumKey);

public sealed record CreateBillPaymentCommand(
    decimal? Amount,
    string? ReturnUrl,
    string? CancelUrl);

public sealed record PayOSPaymentLinkResult(
    long OrderCode,
    decimal Amount,
    string Description,
    string Status,
    string CheckoutUrl,
    string? QrCode,
    string? BankAccountNumber,
    string? BankAccountName,
    string? BankBin,
    string? BankName,
    string? PaymentLinkId,
    Guid BillId,
    string BillCode);

public sealed record PayOSPaymentStatusResult(
    long OrderCode,
    string Status,
    decimal Amount,
    decimal AmountPaid,
    decimal AmountRemaining,
    bool IsSuccess,
    string? TransactionDateTime,
    string? Reference);

public sealed record PayOSTestResult(
    bool Success,
    string Message,
    string? ClientId);

public sealed record PayOSTransactionView(
    Guid Id,
    long OrderCode,
    Guid? BillId,
    decimal Amount,
    string Description,
    string Status,
    string? CheckoutUrl,
    string? QrCode,
    string? BankAccountNumber,
    string? BankAccountName,
    string? BankName,
    string? Reference,
    DateTime? PaidAtUtc,
    DateTime CreatedAtUtc);

public interface IPayOSService
{
    Task<PayOSConfigView> GetConfigAsync(CancellationToken ct);
    Task<PayOSConfigView> UpdateConfigAsync(UpdatePayOSConfigCommand command, Guid updatedByUserId, CancellationToken ct);
    Task<PayOSTestResult> TestConnectionAsync(CancellationToken ct);
    Task<PayOSPaymentLinkResult> CreateBillPaymentLinkAsync(Guid billId, decimal? customAmount, Guid userId, string? returnUrl, string? cancelUrl, CancellationToken ct);
    Task<PayOSPaymentStatusResult> CheckPaymentStatusAsync(long orderCode, CancellationToken ct);
    Task<PayOSPaymentStatusResult> ConfirmManualPaymentAsync(long orderCode, Guid userId, CancellationToken ct);
    Task<bool> ProcessWebhookAsync(string rawJson, CancellationToken ct);
    Task<bool> ConfirmWebhookUrlAsync(string webhookUrl, CancellationToken ct);
    Task<IReadOnlyList<PayOSTransactionView>> GetTransactionsByBillIdAsync(Guid billId, CancellationToken ct);
}
