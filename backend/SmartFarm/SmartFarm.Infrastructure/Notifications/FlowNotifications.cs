using Microsoft.EntityFrameworkCore;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;

namespace SmartFarm.Infrastructure.Notifications;

/// <summary>
/// Thông báo cho các bước của luồng lắp đặt và phiếu xuất kho (giao KTV, gửi hợp đồng, cọc, hoàn tất lắp đặt, nghiệm thu, duyệt phiếu).
/// Chỉ THÊM thực thể vào DbContext; người gọi lưu cùng lượt với thay đổi nghiệp vụ nên thông báo và thay đổi cùng thành công hoặc cùng huỷ.
/// ReferenceId là mã của đối tượng để mobile mở đúng màn: Service = mã phiếu dịch vụ, StockOut = mã phiếu xuất kho.
/// </summary>
internal static class FlowNotifications
{
    public static void Add(
        SmartFarmDbContext db,
        Guid userId,
        Guid? tenantId,
        string title,
        string message,
        NotificationType type,
        string referenceId,
        AlertSeverity severity = AlertSeverity.Info)
    {
        if (userId == Guid.Empty) return;
        db.Notifications.Add(new Notification
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TenantId = tenantId,
            Title = title,
            Message = message,
            Type = type,
            Severity = severity,
            IsRead = false,
            ReferenceId = referenceId,
            CreatedAtUtc = DateTime.UtcNow
        });
    }

    /// <summary>Tới mọi Admin đang hoạt động (phiếu xuất kho chờ duyệt).</summary>
    public static async Task AddForAdminsAsync(
        SmartFarmDbContext db, string title, string message, NotificationType type, string referenceId, CancellationToken ct)
    {
        var admins = await db.AppUsers.AsNoTracking()
            .Where(u => u.Role == UserRole.PlatformAdmin && u.Status == AccountStatus.Active)
            .Select(u => u.Id).ToListAsync(ct);
        foreach (var id in admins) Add(db, id, null, title, message, type, referenceId);
    }

    /// <summary>Tới chủ trang trại của yêu cầu: người tạo yêu cầu nếu có, không thì các FarmOwner đang hoạt động của tenant.</summary>
    public static async Task AddForOwnersAsync(
        SmartFarmDbContext db, Guid tenantId, Guid? preferredOwnerId, string title, string message, NotificationType type, string referenceId,
        CancellationToken ct, AlertSeverity severity = AlertSeverity.Info)
    {
        var owners = preferredOwnerId.HasValue && preferredOwnerId.Value != Guid.Empty
            ? new List<Guid> { preferredOwnerId.Value }
            : await db.AppUsers.AsNoTracking()
                .Where(u => u.TenantId == tenantId && u.Role == UserRole.FarmOwner && u.Status == AccountStatus.Active)
                .Select(u => u.Id).ToListAsync(ct);
        foreach (var id in owners) Add(db, id, tenantId, title, message, type, referenceId, severity);
    }
}
