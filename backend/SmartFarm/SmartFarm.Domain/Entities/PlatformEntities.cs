using System.ComponentModel.DataAnnotations;
using SmartFarm.Domain.Common;

namespace SmartFarm.Domain.Entities;

/// <summary>Nhật ký kiểm toán toàn sàn (Audit Logs)</summary>
public sealed class AuditLog
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? ActorUserId { get; set; }
    public AppUser? ActorUser { get; set; }
    public string ActorName { get; set; } = string.Empty;
    public string ActorRole { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string EntityName { get; set; } = string.Empty;
    public string EntityId { get; set; } = string.Empty;
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public string? Details { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

/// <summary>Cấu hình nền tảng SaaS runtime (Platform Settings)</summary>
public sealed class PlatformSetting
{
    [Key]
    public string Key { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
    public string Group { get; set; } = string.Empty;
    public string DataType { get; set; } = "String";
    public string? Description { get; set; }
    public bool IsSecret { get; set; } = false;
    public Guid? UpdatedByUserId { get; set; }
    public AppUser? UpdatedByUser { get; set; }
    public DateTime? UpdatedAtUtc { get; set; }
}

/// <summary>Kho thiết bị & linh kiện phần cứng hệ thống (Platform Hardware Items)</summary>
public sealed class PlatformHardwareItem : AuditableEntity
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string? Model { get; set; }
    public string? Manufacturer { get; set; }
    public string? SerialNumber { get; set; }
    public string? MacAddress { get; set; }
    public int QuantityInStock { get; set; } = 0;
    public string? LocationRack { get; set; }
    public decimal UnitPrice { get; set; } = 0;
    public string Status { get; set; } = "Available";
    public Guid? AssignedTechnicianId { get; set; }
    public AppUser? AssignedTechnician { get; set; }
}

/// <summary>Báo giá lắp đặt thiết bị gắn với Service Request (Service Request Quotation)</summary>
public sealed class ServiceRequestQuotation : AuditableEntity
{
    public Guid ServiceRequestId { get; set; }
    public ServiceRequest ServiceRequest { get; set; } = null!;
    public Guid TechnicianUserId { get; set; }
    public AppUser TechnicianUser { get; set; } = null!;
    public decimal Subtotal { get; set; }
    public decimal VatPercent { get; set; } = 8;
    public decimal VatAmount { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal Deposit30Percent { get; set; }
    public decimal Remaining70Percent { get; set; }
    public string? Notes { get; set; }
    public string? ContractTerms { get; set; }
    public string Status { get; set; } = "Draft";
    public ICollection<ServiceRequestQuotationItem> Items { get; } = new List<ServiceRequestQuotationItem>();
}

/// <summary>Dòng thiết bị trong Báo giá</summary>
public sealed class ServiceRequestQuotationItem
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid QuotationId { get; set; }
    public ServiceRequestQuotation Quotation { get; set; } = null!;
    public string HardwareItemCode { get; set; } = string.Empty;
    public string HardwareItemName { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string Unit { get; set; } = "Cái";
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal VatPercent { get; set; } = 8;
    public decimal TotalAmount { get; set; }
    public string? Notes { get; set; }
}

/// <summary>Giao dịch thanh toán theo đợt (Deposit 30% / Final 70%)</summary>
public sealed class ServiceRequestPayment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ServiceRequestId { get; set; }
    public ServiceRequest ServiceRequest { get; set; } = null!;
    public Guid? QuotationId { get; set; }
    public ServiceRequestQuotation? Quotation { get; set; }
    public string PaymentStage { get; set; } = string.Empty; // DEPOSIT_30 | FINAL_70
    public decimal Amount { get; set; }
    public string PaymentMethod { get; set; } = string.Empty;
    public string? TransactionReference { get; set; }
    public string SignerFullName { get; set; } = string.Empty;
    public string? SignatureHash { get; set; }
    public string Status { get; set; } = "PendingConfirmation";
    public DateTime PaidAtUtc { get; set; } = DateTime.UtcNow;
    public Guid? ConfirmedByAdminId { get; set; }
    public AppUser? ConfirmedByAdmin { get; set; }
}
