using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SmartFarm.Domain.Entities;
using SmartFarm.Infrastructure.Persistence;
using Xunit;

namespace SmartFarm.Api.Tests;

/// <summary>Cảnh báo hợp đồng sắp hết hạn lọc được theo Zone (màn hợp đồng mở từ Zone Detail) mà vẫn giữ phạm vi Tenant.</summary>
public sealed class ZoneContractScopeTests
{
    [Fact]
    public async Task Expiring_alerts_can_be_limited_to_one_zone_and_never_cross_tenants()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        Guid zoneA2;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            var zoneA = await db.Zones.Include(z => z.Field).ThenInclude(f => f.Farm).SingleAsync(z => z.Id == seed.ZoneAId);
            var zoneB = await db.Zones.Include(z => z.Field).ThenInclude(f => f.Farm).SingleAsync(z => z.Id == seed.ZoneBId);
            var second = new Zone { FieldId = zoneA.FieldId, Name = "Zone A2", AreaM2 = 50, ZoneType = "Greenhouse" };
            db.Zones.Add(second);
            await db.SaveChangesAsync();
            zoneA2 = second.Id;
            var ownerA = await db.AppUsers.FirstAsync(u => u.TenantId == zoneA.Field.Farm.TenantId && u.Email == "owner-a@example.com");
            var ownerB = await db.AppUsers.FirstAsync(u => u.Email == "owner-b@example.com");
            var soon = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(10));
            ZoneContract Make(Zone z, AppUser owner, string number) => new()
            {
                TenantId = z.Field.Farm.TenantId, FarmId = z.Field.FarmId, ZoneId = z.Id, CreatedByOwnerId = owner.Id, ContractNumber = number,
                StartDate = soon.AddYears(-1), EndDate = soon, LesseeName = "Bên thuê", MonthlyRentVnd = 1, DepositVnd = 1, TotalContractValueVnd = 12
            };
            second.Field = zoneA.Field;
            db.ZoneContracts.AddRange(Make(zoneA, ownerA, "HD-A"), Make(second, ownerA, "HD-A2"), Make(zoneB, ownerB, "HD-B"));
            await db.SaveChangesAsync();
        }
        using var owner = factory.CreateClient(); await LoginAsync(owner, "owner-a@example.com");

        var all = JsonDocument.Parse(await (await owner.GetAsync("/api/v1/zone-contracts/expiring?daysThreshold=30")).Content.ReadAsStringAsync()).RootElement;
        Assert.Equal(new[] { "HD-A", "HD-A2" }, all.EnumerateArray().Select(x => x.GetProperty("contractNumber").GetString()!).Order().ToArray());

        var one = await owner.GetAsync($"/api/v1/zone-contracts/expiring?daysThreshold=30&zoneId={seed.ZoneAId}");
        Assert.Equal(HttpStatusCode.OK, one.StatusCode);
        var only = JsonDocument.Parse(await one.Content.ReadAsStringAsync()).RootElement;
        Assert.Equal("HD-A", Assert.Single(only.EnumerateArray()).GetProperty("contractNumber").GetString());

        // Zone của Tenant khác: không thấy gì (không lộ dữ liệu).
        var foreign = JsonDocument.Parse(await (await owner.GetAsync($"/api/v1/zone-contracts/expiring?daysThreshold=30&zoneId={seed.ZoneBId}")).Content.ReadAsStringAsync()).RootElement;
        Assert.Equal(0, foreign.GetArrayLength());
        Assert.NotEqual(Guid.Empty, zoneA2);
    }

    private static async Task LoginAsync(HttpClient client, string email)
    {
        client.DefaultRequestHeaders.Authorization = null;
        var response = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = "ValidPassword1!" });
        response.EnsureSuccessStatusCode();
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", json.RootElement.GetProperty("accessToken").GetString());
    }
}
