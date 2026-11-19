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
    string? MetadataJson = null,
    /// <summary>Có ReferenceId trùng (cùng người nhận và loại) thì trả lại thông báo cũ thay vì tạo thêm; dùng khi thử lại.</summary>
    bool DeduplicateByReference = false,
    /// <summary>Còn thông báo CHƯA ĐỌC cùng người nhận, loại và ReferenceId thì không tạo thêm (trả lại thông báo đó). Đã đọc/xóa rồi thì lần sau vẫn báo lại; dùng cho cảnh báo lặp theo thiết bị/zone.</summary>
    bool SuppressIfUnread = false
);
