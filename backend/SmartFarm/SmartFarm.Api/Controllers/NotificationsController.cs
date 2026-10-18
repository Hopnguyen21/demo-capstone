using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartFarm.Api.Extensions;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Application.Features.Notifications;

namespace SmartFarm.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/notifications")]
public sealed class NotificationsController(INotificationService notificationService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<NotificationView>>> GetNotifications(
        [FromQuery] bool? isRead,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var userId = User.GetUserId();
        var result = await notificationService.GetUserNotificationsAsync(userId, isRead, page, pageSize, ct);
        return Ok(result);
    }

    [HttpGet("unread-count")]
    public async Task<ActionResult<UnreadNotificationCountView>> GetUnreadCount(CancellationToken ct = default)
    {
        var userId = User.GetUserId();
        var result = await notificationService.GetUnreadCountAsync(userId, ct);
        return Ok(result);
    }

    [HttpPut("{notificationId:guid}/read")]
    public async Task<IActionResult> MarkAsRead(Guid notificationId, CancellationToken ct = default)
    {
        var userId = User.GetUserId();
        var success = await notificationService.MarkAsReadAsync(userId, notificationId, ct);
        if (!success)
        {
            return NotFound(new { message = "Thông báo không tồn tại hoặc bạn không có quyền truy cập." });
        }
        return NoContent();
    }

    [HttpPut("read-all")]
    public async Task<ActionResult<object>> MarkAllAsRead(CancellationToken ct = default)
    {
        var userId = User.GetUserId();
        var count = await notificationService.MarkAllAsReadAsync(userId, ct);
        return Ok(new { updatedCount = count });
    }

    [HttpDelete("{notificationId:guid}")]
    public async Task<IActionResult> Delete(Guid notificationId, CancellationToken ct = default)
    {
        var userId = User.GetUserId();
        var success = await notificationService.DeleteNotificationAsync(userId, notificationId, ct);
        if (!success)
        {
            return NotFound(new { message = "Thông báo không tồn tại hoặc bạn không có quyền truy cập." });
        }
        return NoContent();
    }

    [HttpDelete("read")]
    public async Task<ActionResult<object>> DeleteAllRead(CancellationToken ct = default)
    {
        var userId = User.GetUserId();
        var count = await notificationService.DeleteAllReadAsync(userId, ct);
        return Ok(new { deletedCount = count });
    }
}