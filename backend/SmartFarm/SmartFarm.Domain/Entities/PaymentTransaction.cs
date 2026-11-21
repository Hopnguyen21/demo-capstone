using SmartFarm.Domain.Common;

namespace SmartFarm.Domain.Entities;

public sealed class PaymentTransaction : AuditableEntity
{
    public long OrderCode { get; set; }
    public Guid? BillId { get; set; }
    public Bill? Bill { get; set; }
    public Guid? ServiceRequestId { get; set; }
    public decimal Amount { get; set; }
    public string Description { get; set; } = string.Empty;
    public string Status { get; set; } = "PENDING"; // PENDING, PAID, CANCELLED, EXPIRED
    public string? PaymentLinkId { get; set; }
    public string? CheckoutUrl { get; set; }
    public string? QrCode { get; set; }
    public string? BankAccountNumber { get; set; }
    public string? BankAccountName { get; set; }
    public string? BankBin { get; set; }
    public string? BankName { get; set; }
    public string? Reference { get; set; }
    public DateTime? PaidAtUtc { get; set; }
    public string? WebhookPayloadJson { get; set; }
    public Guid CreatedByUserId { get; set; }
}
