using Microsoft.EntityFrameworkCore;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Application.Features.Notifications;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;

namespace SmartFarm.Api.HostedServices;

/// <summary>
/// Gửi thông báo khi hợp đồng Zone sắp hết hạn hoặc vừa hết hạn, cho Chủ trang trại của Tenant và các Admin (Admin là người gia hạn).
/// Mốc nhắc: còn 30, 14, 7 ngày và khi đã hết hạn (trong 7 ngày đầu). Mỗi (hợp đồng, ngày hết hạn, mốc, người nhận) chỉ nhắc MỘT lần,
/// kể cả khi đã đọc; gia hạn xong ngày hết hạn đổi nên kỳ sau nhắc lại từ đầu.
/// </summary>
public sealed class ContractExpiryWorker(
    IServiceScopeFactory scopes,
    TimeProvider clock,
    ILogger<ContractExpiryWorker> logger) : BackgroundService
{
    private static readonly TimeSpan CheckInterval = TimeSpan.FromHours(6);

    /// <summary>Các mốc còn lại (ngày) theo thứ tự giảm dần; 0 = đã hết hạn.</summary>
    public static readonly int[] Milestones = [30, 14, 7, 0];

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
                var notifications = scope.ServiceProvider.GetRequiredService<INotificationService>();
                var today = DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);
                var created = await NotifyOnceAsync(db, notifications, today, stoppingToken);
                if (created > 0) logger.LogInformation("Đã gửi {Count} thông báo hợp đồng sắp hết hạn.", created);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Contract expiry check failed");
            }

            await Task.Delay(CheckInterval, stoppingToken);
        }
    }

    /// <summary>Một lượt quét (gọi trực tiếp được khi kiểm thử với đồng hồ giả). Trả số thông báo MỚI được tạo.</summary>
    public static async Task<int> NotifyOnceAsync(SmartFarmDbContext db, INotificationService notifications, DateOnly today, CancellationToken ct)
    {
        var limit = today.AddDays(Milestones[0]);
        var oldest = today.AddDays(-7);
        var contracts = await db.ZoneContracts.AsNoTracking()
            .Include(c => c.Zone)
            .Where(c => c.Status != ZoneContractStatus.Terminated && c.Status != ZoneContractStatus.Renewed
                        && c.EndDate <= limit && c.EndDate >= oldest)
            .ToListAsync(ct);
        if (contracts.Count == 0) return 0;

        var tenantIds = contracts.Select(c => c.TenantId).Distinct().ToList();
        var owners = await db.AppUsers.AsNoTracking()
            .Where(u => u.Role == UserRole.FarmOwner && u.Status == AccountStatus.Active && u.TenantId != null && tenantIds.Contains(u.TenantId.Value))
            .Select(u => new { u.Id, TenantId = u.TenantId!.Value })
            .ToListAsync(ct);
        var adminIds = await db.AppUsers.AsNoTracking()
            .Where(u => u.Role == UserRole.PlatformAdmin && u.Status == AccountStatus.Active)
            .Select(u => u.Id).ToListAsync(ct);

        var created = 0;
        foreach (var c in contracts)
        {
            var days = c.EndDate.DayNumber - today.DayNumber;
            var milestone = MilestoneFor(days);
            var expired = days < 0;
            var title = expired ? "Hợp đồng đã hết hạn" : "Hợp đồng sắp hết hạn";
            var zone = c.Zone?.Name ?? "Zone";
            var when = c.EndDate.ToString("dd/MM/yyyy");
            var message = expired
                ? $"Hợp đồng {c.ContractNumber} ({zone}) đã hết hạn từ {when}. Cần gia hạn hoặc tái ký."
                : days == 0
                    ? $"Hợp đồng {c.ContractNumber} ({zone}) hết hạn hôm nay ({when}). Cần gia hạn ngay."
                    : $"Hợp đồng {c.ContractNumber} ({zone}) còn {days} ngày, hết hạn {when}. Hãy gửi yêu cầu gia hạn.";
            var severity = days <= 7 ? AlertSeverity.Critical : AlertSeverity.Warning;
            var reference = $"contract-expiry:{c.Id}:{c.EndDate:yyyyMMdd}:{milestone}";

            var recipients = owners.Where(o => o.TenantId == c.TenantId).Select(o => (o.Id, (Guid?)c.TenantId))
                .Concat(adminIds.Select(a => (a, (Guid?)null)));
            foreach (var (userId, tenantId) in recipients)
            {
                var before = await db.Notifications.AsNoTracking().AnyAsync(n => n.UserId == userId && n.Type == NotificationType.Contract && n.ReferenceId == reference, ct);
                if (before) continue;
                await notifications.CreateNotificationAsync(new CreateNotificationCommand(
                    userId, tenantId, title, message, NotificationType.Contract, severity,
                    TargetUrl: "/zone-contracts", ReferenceId: reference, DeduplicateByReference: true), ct);
                created++;
            }
        }
        return created;
    }

    /// <summary>Mốc đang áp dụng cho số ngày còn lại: mốc nhỏ nhất mà ngày còn lại đã chạm tới (30 → 14 → 7 → 0).</summary>
    public static int MilestoneFor(int daysRemaining)
    {
        var current = Milestones[0];
        foreach (var m in Milestones)
            if (daysRemaining <= m) current = m;
        return current;
    }
}
