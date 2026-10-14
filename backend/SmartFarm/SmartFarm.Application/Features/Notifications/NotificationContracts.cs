using SmartFarm.Domain.Enums;

namespace SmartFarm.Application.Features.Notifications;

public sealed record NotificationView(
    Guid NotificationId,
    Guid UserId,
    Guid? TenantId,
    string Title,
    string Message,
    NotificationType Type,
    AlertSeverity Severity,
    bool IsRead,
    DateTime? ReadAtUtc,
    string? TargetUrl,
    string? ReferenceId,
    DateTime CreatedAtUtc
);

public sealed record UnreadNotificationCountView(
    int UnreadCount
);

public sealed record CreateNotificationCommand(
    Guid UserId,
    Guid? TenantId,
    string Title,
    string Message,
    NotificationType Type = NotificationType.System,
    AlertSeverity Severity = AlertSeverity.Info,
    string? TargetUrl = null,
    string? ReferenceId = null,
    string? MetadataJson = null
);
