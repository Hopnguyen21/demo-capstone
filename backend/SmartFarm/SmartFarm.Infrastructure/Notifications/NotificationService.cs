using Microsoft.EntityFrameworkCore;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Application.Features.Notifications;
using SmartFarm.Domain.Entities;
using SmartFarm.Infrastructure.Persistence;

namespace SmartFarm.Infrastructure.Notifications;

public sealed class NotificationService(SmartFarmDbContext dbContext) : INotificationService
{
    public async Task<IReadOnlyList<NotificationView>> GetUserNotificationsAsync(
        Guid userId,
        bool? isRead,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = dbContext.Notifications
            .AsNoTracking()
            .Where(x => x.UserId == userId);

        if (isRead.HasValue)
        {
            query = query.Where(x => x.IsRead == isRead.Value);
        }

        var items = await query
            .OrderByDescending(x => x.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new NotificationView(
                x.Id,
                x.UserId,
                x.TenantId,
                x.Title,
                x.Message,
                x.Type,
                x.Severity,
                x.IsRead,
                x.ReadAtUtc,
                x.TargetUrl,
                x.ReferenceId,
                x.CreatedAtUtc
            ))
            .ToListAsync(ct);

        return items;
    }

    public async Task<UnreadNotificationCountView> GetUnreadCountAsync(Guid userId, CancellationToken ct = default)
    {
        var count = await dbContext.Notifications
            .AsNoTracking()
            .CountAsync(x => x.UserId == userId && !x.IsRead, ct);

        return new UnreadNotificationCountView(count);
    }

    public async Task<bool> MarkAsReadAsync(Guid userId, Guid notificationId, CancellationToken ct = default)
    {
        var notification = await dbContext.Notifications
            .FirstOrDefaultAsync(x => x.Id == notificationId && x.UserId == userId, ct);

        if (notification == null) return false;

        if (!notification.IsRead)
        {
            notification.IsRead = true;
            notification.ReadAtUtc = DateTime.UtcNow;
            await dbContext.SaveChangesAsync(ct);
        }

        return true;
    }

    public async Task<int> MarkAllAsReadAsync(Guid userId, CancellationToken ct = default)
    {
        var unreadItems = await dbContext.Notifications
            .Where(x => x.UserId == userId && !x.IsRead)
            .ToListAsync(ct);

        if (unreadItems.Count == 0) return 0;

        var now = DateTime.UtcNow;
        foreach (var item in unreadItems)
        {
            item.IsRead = true;
            item.ReadAtUtc = now;
        }

        await dbContext.SaveChangesAsync(ct);
        return unreadItems.Count;
    }

    public async Task<bool> DeleteNotificationAsync(Guid userId, Guid notificationId, CancellationToken ct = default)
    {
        var notification = await dbContext.Notifications
            .FirstOrDefaultAsync(x => x.Id == notificationId && x.UserId == userId, ct);

        if (notification == null) return false;

        dbContext.Notifications.Remove(notification);
        await dbContext.SaveChangesAsync(ct);
        return true;
    }

    public async Task<int> DeleteAllReadAsync(Guid userId, CancellationToken ct = default)
    {
        var readItems = await dbContext.Notifications
            .Where(x => x.UserId == userId && x.IsRead)
            .ToListAsync(ct);

        if (readItems.Count == 0) return 0;

        dbContext.Notifications.RemoveRange(readItems);
        await dbContext.SaveChangesAsync(ct);
        return readItems.Count;
    }

    public async Task<NotificationView> CreateNotificationAsync(CreateNotificationCommand command, CancellationToken ct = default)
    {
        var notification = new Notification
        {
            Id = Guid.NewGuid(),
            UserId = command.UserId,
            TenantId = command.TenantId,
            Title = command.Title,
            Message = command.Message,
            Type = command.Type,
            Severity = command.Severity,
            IsRead = false,
            TargetUrl = command.TargetUrl,
            ReferenceId = command.ReferenceId,
            MetadataJson = command.MetadataJson,
            CreatedAtUtc = DateTime.UtcNow
        };

        dbContext.Notifications.Add(notification);
        await dbContext.SaveChangesAsync(ct);

        return new NotificationView(
            notification.Id,
            notification.UserId,
            notification.TenantId,
            notification.Title,
            notification.Message,
            notification.Type,
            notification.Severity,
            notification.IsRead,
            notification.ReadAtUtc,
            notification.TargetUrl,
            notification.ReferenceId,
            notification.CreatedAtUtc
        );
    }
}
