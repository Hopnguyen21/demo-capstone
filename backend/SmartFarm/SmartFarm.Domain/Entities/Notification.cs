using SmartFarm.Domain.Common;
using SmartFarm.Domain.Enums;

namespace SmartFarm.Domain.Entities;

public sealed class Notification : AuditableEntity
{
    public Guid UserId { get; set; }
    public AppUser User { get; set; } = null!;

    public Guid? TenantId { get; set; }
    public Tenant? Tenant { get; set; }

    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public NotificationType Type { get; set; } = NotificationType.System;
    public AlertSeverity Severity { get; set; } = AlertSeverity.Info;

    public bool IsRead { get; set; } = false;
    public DateTime? ReadAtUtc { get; set; }

    public string? TargetUrl { get; set; }
    public string? ReferenceId { get; set; }
    public string? MetadataJson { get; set; }
}
