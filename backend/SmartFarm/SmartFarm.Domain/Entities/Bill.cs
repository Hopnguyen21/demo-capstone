using SmartFarm.Domain.Common;
using SmartFarm.Domain.Enums;

namespace SmartFarm.Domain.Entities;

public sealed class Bill : AuditableEntity
{
    public Guid TenantId { get; set; }
    public string BillCode { get; set; } = string.Empty;
    public Guid ContractId { get; set; }
    public ZoneContract Contract { get; set; } = null!;
    public Guid? CustomerTenantId { get; set; }
    public string LesseeName { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public decimal PaidAmount { get; set; } = 0;
    public decimal RemainingAmount { get; set; }
    public BillStatus Status { get; set; } = BillStatus.Issued;
    public DateOnly IssueDate { get; set; }
    public DateOnly DueDate { get; set; }
    public DateTime? PaidDate { get; set; }
    public string? PaymentMethod { get; set; }
    public string? Notes { get; set; }
    public Guid CreatedByUserId { get; set; }
    public AppUser? CreatedByUser { get; set; }
}

