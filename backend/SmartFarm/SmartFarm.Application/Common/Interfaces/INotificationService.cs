using SmartFarm.Application.Features.Notifications;

namespace SmartFarm.Application.Common.Interfaces;

public interface INotificationService
{
    Task<IReadOnlyList<NotificationView>> GetUserNotificationsAsync(Guid userId, bool? isRead, int page, int pageSize, CancellationToken ct = default);
    Task<UnreadNotificationCountView> GetUnreadCountAsync(Guid userId, CancellationToken ct = default);
    Task<bool> MarkAsReadAsync(Guid userId, Guid notificationId, CancellationToken ct = default);
    Task<int> MarkAllAsReadAsync(Guid userId, CancellationToken ct = default);
    Task<NotificationView> CreateNotificationAsync(CreateNotificationCommand command, CancellationToken ct = default);
}
