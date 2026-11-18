using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Application.Features.Notifications;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;
using Xunit;

namespace SmartFarm.Api.Tests;

/// <summary>Thông báo của luồng phiếu xuất kho và giao KTV: gửi đúng người, đúng loại, ReferenceId là mã đối tượng.</summary>
public class FlowNotificationTests
{
    private static async Task LoginAsync(HttpClient client, string email)
    {
        client.DefaultRequestHeaders.Authorization = null;
        var r = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = "ValidPassword1!" });
        r.EnsureSuccessStatusCode();
        using var j = JsonDocument.Parse(await r.Content.ReadAsStringAsync());
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", j.RootElement.GetProperty("accessToken").GetString());
    }

    private static async Task<List<Notification>> NotificationsAsync(TestApplicationFactory f, string email, NotificationType type)
    {
        await using var scope = f.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        var id = await db.AppUsers.Where(u => u.Email == email).Select(u => u.Id).SingleAsync();
        return await db.Notifications.Where(n => n.UserId == id && n.Type == type).ToListAsync();
    }

    [Fact]
    public async Task Voucher_lifecycle_notifies_admins_on_submit_and_the_technician_on_approval_and_cancel()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        Guid voucherId;
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            var farm = await db.Farms.SingleAsync(x => x.Id == seed.FarmAId);
            var v = new StockOut { TenantId = farm.TenantId, FarmId = farm.Id, StockOutCode = "PXK-NOTI-01", Status = StockOutStatus.Draft, CreatedByUserId = seed.TechnicianId };
            db.StockOuts.Add(v); await db.SaveChangesAsync(); voucherId = v.Id;
        }
        using var client = factory.CreateClient();
        await LoginAsync(client, "technician@example.com");
        (await client.PutAsJsonAsync($"/api/v1/farms/{seed.FarmAId}/stock-outs/{voucherId}/status", new { status = "Pending" })).EnsureSuccessStatusCode();
        var adminNotes = await NotificationsAsync(factory, "admin@example.com", NotificationType.StockOut);
        Assert.Single(adminNotes);
        Assert.Equal(voucherId.ToString(), adminNotes[0].ReferenceId);
        Assert.Empty(await NotificationsAsync(factory, "technician@example.com", NotificationType.StockOut)); // tự gửi thì không tự báo

        await LoginAsync(client, "admin@example.com");
        (await client.PutAsJsonAsync($"/api/v1/farms/{seed.FarmAId}/stock-outs/{voucherId}/status", new { status = "Approved" })).EnsureSuccessStatusCode();
        var techNotes = await NotificationsAsync(factory, "technician@example.com", NotificationType.StockOut);
        Assert.Single(techNotes);
        Assert.Contains("duyệt", techNotes[0].Title);
        Assert.Equal(voucherId.ToString(), techNotes[0].ReferenceId);
        Assert.False(techNotes[0].IsRead);

        (await client.PutAsJsonAsync($"/api/v1/farms/{seed.FarmAId}/stock-outs/{voucherId}/status", new { status = "Cancelled" })).EnsureSuccessStatusCode();
        Assert.Equal(2, (await NotificationsAsync(factory, "technician@example.com", NotificationType.StockOut)).Count);
    }

    [Fact]
    public async Task Repeated_alert_notifications_are_suppressed_only_while_the_first_is_unread()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        using var scope = factory.Services.CreateScope();
        var svc = scope.ServiceProvider.GetRequiredService<INotificationService>();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        var cmd = new CreateNotificationCommand(seed.OwnerAId, null, "t", "m", NotificationType.Alert, AlertSeverity.Critical, "/owner/alerts", "device-1", null, SuppressIfUnread: true);

        var first = await svc.CreateNotificationAsync(cmd);
        var second = await svc.CreateNotificationAsync(cmd);
        Assert.Equal(first.NotificationId, second.NotificationId);
        Assert.Equal(1, await db.Notifications.CountAsync());

        await svc.MarkAsReadAsync(seed.OwnerAId, first.NotificationId);
        var third = await svc.CreateNotificationAsync(cmd); // đã đọc → lần sự cố sau vẫn báo
        Assert.NotEqual(first.NotificationId, third.NotificationId);
        Assert.Equal(2, await db.Notifications.CountAsync());
    }
}
