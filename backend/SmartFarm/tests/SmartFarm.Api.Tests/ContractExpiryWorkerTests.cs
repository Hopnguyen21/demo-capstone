using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SmartFarm.Api.HostedServices;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;
using Xunit;

namespace SmartFarm.Api.Tests;

/// <summary>Thông báo hợp đồng sắp hết hạn: đúng người nhận, đúng mốc, mỗi mốc một lần, gia hạn xong nhắc lại kỳ sau.</summary>
public sealed class ContractExpiryWorkerTests
{
    private static async Task<(Guid ContractId, Guid OwnerId)> AddContractAsync(TestApplicationFactory f, SeedData seed, DateOnly end, string number, ZoneContractStatus status = ZoneContractStatus.Active)
    {
        using var scope = f.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        var zone = await db.Zones.Include(z => z.Field).ThenInclude(x => x.Farm).SingleAsync(z => z.Id == seed.ZoneAId);
        var owner = await db.AppUsers.SingleAsync(u => u.Email == "owner-a@example.com");
        var contract = new ZoneContract
        {
            TenantId = zone.Field.Farm.TenantId, FarmId = zone.Field.FarmId, ZoneId = zone.Id, CreatedByOwnerId = owner.Id,
            ContractNumber = number, StartDate = end.AddYears(-1), EndDate = end, LesseeName = "Khách", MonthlyRentVnd = 1, DepositVnd = 1,
            TotalContractValueVnd = 12, Status = status
        };
        db.ZoneContracts.Add(contract);
        await db.SaveChangesAsync();
        return (contract.Id, owner.Id);
    }

    private static async Task<int> RunAsync(TestApplicationFactory f, DateOnly today)
    {
        using var scope = f.Services.CreateScope();
        return await ContractExpiryWorker.NotifyOnceAsync(
            scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>(),
            scope.ServiceProvider.GetRequiredService<INotificationService>(), today, CancellationToken.None);
    }

    private static async Task<List<Notification>> ContractNotesAsync(TestApplicationFactory f, string email)
    {
        using var scope = f.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        var userId = (await db.AppUsers.SingleAsync(u => u.Email == email)).Id;
        return await db.Notifications.Where(n => n.UserId == userId && n.Type == NotificationType.Contract).OrderBy(n => n.CreatedAtUtc).ToListAsync();
    }

    [Theory]
    [InlineData(30, 30)]
    [InlineData(20, 30)]
    [InlineData(14, 14)]
    [InlineData(10, 14)]
    [InlineData(7, 7)]
    [InlineData(1, 7)]
    [InlineData(0, 0)]
    [InlineData(-3, 0)]
    public void Milestone_is_the_smallest_threshold_already_reached(int days, int expected) =>
        Assert.Equal(expected, ContractExpiryWorker.MilestoneFor(days));

    [Fact]
    public async Task Owner_of_the_tenant_and_admins_are_notified_but_not_other_tenants()
    {
        using var f = new TestApplicationFactory(); var seed = await f.SeedAsync();
        var today = new DateOnly(2026, 11, 18);
        await AddContractAsync(f, seed, today.AddDays(10), "HD-EXP-1");

        Assert.True(await RunAsync(f, today) >= 2);
        var owner = Assert.Single(await ContractNotesAsync(f, "owner-a@example.com"));
        Assert.Contains("HD-EXP-1", owner.Message);
        Assert.Contains("còn 10 ngày", owner.Message);
        Assert.Equal(AlertSeverity.Warning, owner.Severity);
        Assert.Single(await ContractNotesAsync(f, "admin@example.com"));
        Assert.Empty(await ContractNotesAsync(f, "owner-b@example.com"));
    }

    [Fact]
    public async Task Same_milestone_is_sent_once_even_if_read_and_escalates_at_the_next_milestone()
    {
        using var f = new TestApplicationFactory(); var seed = await f.SeedAsync();
        var today = new DateOnly(2026, 11, 18);
        await AddContractAsync(f, seed, today.AddDays(10), "HD-EXP-2");
        await RunAsync(f, today);
        using (var scope = f.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            foreach (var n in await db.Notifications.Where(n => n.Type == NotificationType.Contract).ToListAsync()) { n.IsRead = true; }
            await db.SaveChangesAsync();
        }
        Assert.Equal(0, await RunAsync(f, today.AddDays(1))); // vẫn mốc 14, đã đọc cũng không nhắc lại
        Assert.Single(await ContractNotesAsync(f, "owner-a@example.com"));

        Assert.True(await RunAsync(f, today.AddDays(5)) > 0); // còn 5 ngày → mốc 7, mức Critical
        var notes = await ContractNotesAsync(f, "owner-a@example.com");
        Assert.Equal(2, notes.Count);
        Assert.Equal(AlertSeverity.Critical, notes[1].Severity);
    }

    [Fact]
    public async Task Far_or_closed_contracts_are_not_notified_and_expired_ones_are_reported_once()
    {
        using var f = new TestApplicationFactory(); var seed = await f.SeedAsync();
        var today = new DateOnly(2026, 11, 18);
        await AddContractAsync(f, seed, today.AddDays(45), "HD-FAR");
        await AddContractAsync(f, seed, today.AddDays(5), "HD-RENEWED", ZoneContractStatus.Renewed);
        await AddContractAsync(f, seed, today.AddDays(-60), "HD-ANCIENT");
        Assert.Equal(0, await RunAsync(f, today));

        await AddContractAsync(f, seed, today.AddDays(-2), "HD-EXPIRED");
        Assert.True(await RunAsync(f, today) > 0);
        var owner = Assert.Single(await ContractNotesAsync(f, "owner-a@example.com"));
        Assert.Equal("Hợp đồng đã hết hạn", owner.Title);
        Assert.Contains("HD-EXPIRED", owner.Message);
        Assert.Equal(0, await RunAsync(f, today));
    }

    [Fact]
    public async Task After_a_renewal_the_next_term_is_reminded_again()
    {
        using var f = new TestApplicationFactory(); var seed = await f.SeedAsync();
        var today = new DateOnly(2026, 11, 18);
        var (id, _) = await AddContractAsync(f, seed, today.AddDays(10), "HD-RENEW");
        await RunAsync(f, today);
        using (var scope = f.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            (await db.ZoneContracts.SingleAsync(c => c.Id == id)).EndDate = today.AddYears(1); // gia hạn 1 năm
            await db.SaveChangesAsync();
        }
        Assert.Equal(0, await RunAsync(f, today.AddDays(30)));
        Assert.True(await RunAsync(f, today.AddYears(1).AddDays(-20)) > 0); // kỳ mới còn 20 ngày → nhắc lại
        Assert.Equal(2, (await ContractNotesAsync(f, "owner-a@example.com")).Count);
    }
}
