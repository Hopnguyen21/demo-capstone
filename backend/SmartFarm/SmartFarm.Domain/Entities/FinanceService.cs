using SmartFarm.Domain.Common;
using SmartFarm.Domain.Enums;

namespace SmartFarm.Domain.Entities;

public sealed class FinanceTransaction : AuditableEntity
{
    public Guid TenantId { get; set; }
    public Guid FarmId { get; set; }
    public Farm Farm { get; set; } = null!;
    public FinanceTransactionType TransactionType { get; set; }
    public ExpenseCategory? ExpenseCategory { get; set; }
    public decimal Amount { get; set; }
    public DateTime OccurredAtUtc { get; set; }
    public string Description { get; set; } = string.Empty;
    public string? Reference { get; set; }
    public Guid CreatedByOwnerId { get; set; }
    public DateTime? ArchivedAtUtc { get; set; }
}

public sealed class ServiceRequestHistory : AuditableEntity
{
    public Guid ServiceRequestId { get; set; }
    public ServiceRequest ServiceRequest { get; set; } = null!;
    public Guid ActorUserId { get; set; }
    public ServiceHistoryEventType EventType { get; set; }
    public ServiceRequestStatus FromStatus { get; set; }
    public ServiceRequestStatus ToStatus { get; set; }
    public string? Notes { get; set; }
}

public sealed class DeviceReplacement : AuditableEntity
{
    public Guid ServiceRequestId { get; set; }
    public ServiceRequest ServiceRequest { get; set; } = null!;
    public Guid OldDeviceId { get; set; }
    public Device OldDevice { get; set; } = null!;
    public Guid NewDeviceId { get; set; }
    public Device NewDevice { get; set; } = null!;
    public Guid ZoneId { get; set; }
    public Guid TechnicianUserId { get; set; }
}
