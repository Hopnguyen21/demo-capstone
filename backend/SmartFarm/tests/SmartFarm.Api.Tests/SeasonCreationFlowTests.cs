using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;
using Xunit;

namespace SmartFarm.Api.Tests;

/// <summary>Luồng tạo vụ trồng (đơn lẻ + hàng loạt) trong một FarmingSeason: không tự đóng vụ đang chạy, lỗi nêu rõ tên vụ và hướng xử lý.</summary>
public sealed class SeasonCreationFlowTests
{
    private static readonly Guid Crop = Guid.Parse("10000000-0000-0000-0000-000000000001");
    private static readonly Guid Variety = Guid.Parse("10000000-0000-0000-0000-000000000002");
    private static readonly Guid SystemProfile = Guid.Parse("10000000-0000-0000-0000-000000000003");
    private static readonly Guid Stage1 = Guid.Parse("10000000-0000-0000-0000-000000000004");

    private static string Today(int addDays = 0) => DateOnly.FromDateTime(DateTime.UtcNow.AddDays(addDays)).ToString("yyyy-MM-dd");

    [Fact]
    public async Task Creating_a_season_while_one_is_running_is_refused_with_its_name_and_never_closes_it()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        await AddSeasonAsync(factory, seed.ZoneAId, "Vụ đang chạy A", PlantingSeasonStatus.InProgress);
        using var owner = factory.CreateClient(); await LoginAsync(owner, "owner-a@example.com");

        var response = await owner.PostAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}/planting-seasons", new
        {
            name = "Vụ mới", cropId = Crop, varietyId = Variety, growthProfileId = SystemProfile, startDate = Today(-1), expectedEndDate = Today(60)
        });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("Vụ đang chạy A", body);
        Assert.Contains("kết thúc", body);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        Assert.Equal(PlantingSeasonStatus.InProgress, (await db.PlantingSeasons.SingleAsync(x => x.Name == "Vụ đang chạy A")).Status);
        Assert.Equal(1, await db.PlantingSeasons.CountAsync(x => x.ZoneId == seed.ZoneAId));
    }

    [Fact]
    public async Task Profile_that_does_not_match_the_variety_and_a_future_start_date_get_actionable_400s()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        using var owner = factory.CreateClient(); await LoginAsync(owner, "owner-a@example.com");
        var url = $"/api/v1/zones/{seed.ZoneAId}/planting-seasons";

        // Hồ sơ hệ thống gắn với giống Variety, nhưng yêu cầu lại không nêu giống.
        var mismatch = await owner.PostAsJsonAsync(url, new { name = "V", cropId = Crop, growthProfileId = SystemProfile, startDate = Today(-1), expectedEndDate = Today(60) });
        Assert.Equal(HttpStatusCode.BadRequest, mismatch.StatusCode);
        Assert.Contains("không khớp cây/giống", await mismatch.Content.ReadAsStringAsync());

        var future = await owner.PostAsJsonAsync(url, new { name = "V", cropId = Crop, varietyId = Variety, growthProfileId = SystemProfile, startDate = Today(30), expectedEndDate = Today(90) });
        Assert.Equal(HttpStatusCode.BadRequest, future.StatusCode);
        Assert.Contains("tương lai", await future.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Single_season_can_belong_to_a_farming_season_and_a_zone_joins_a_farming_season_only_once()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        var farming = await AddFarmingSeasonAsync(factory, seed.FarmAId, "Đông Xuân 2026");
        using var owner = factory.CreateClient(); await LoginAsync(owner, "owner-a@example.com");
        var url = $"/api/v1/zones/{seed.ZoneAId}/planting-seasons";
        var body = new { name = "Dưa lưới ĐX", cropId = Crop, varietyId = Variety, growthProfileId = SystemProfile, startDate = Today(-1), expectedEndDate = Today(60), farmingSeasonId = farming };

        var created = await owner.PostAsJsonAsync(url, body);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var json = JsonDocument.Parse(await created.Content.ReadAsStringAsync()).RootElement;
        Assert.Equal(farming, json.GetProperty("farmingSeasonId").GetGuid());
        Assert.Equal("InProgress", json.GetProperty("status").GetString());

        // Vụ đầu vẫn đang chạy: tạo thêm cho cùng Zone bị từ chối (không ghi đè vụ cũ).
        Assert.Equal(HttpStatusCode.Conflict, (await owner.PostAsJsonAsync(url, body)).StatusCode);
    }

    [Fact]
    public async Task Bulk_dry_run_names_the_blocking_season_creates_nothing_and_the_real_run_skips_only_invalid_zones()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        var farming = await AddFarmingSeasonAsync(factory, seed.FarmAId, "Đông Xuân 2026");
        var zone2 = await AddZoneAsync(factory, seed.FieldAId, "Zone A2");
        await AddSeasonAsync(factory, seed.ZoneAId, "Vụ cũ Zone A", PlantingSeasonStatus.InProgress);
        using var owner = factory.CreateClient(); await LoginAsync(owner, "owner-a@example.com");
        object Request(bool dryRun, bool skip) => new
        {
            cropId = Crop, varietyId = Variety, growthProfileId = SystemProfile, namePrefix = "ĐX", startDate = Today(-1), expectedEndDate = Today(60),
            zones = new[] { new { zoneId = seed.ZoneAId, setZoneCrop = true }, new { zoneId = zone2, setZoneCrop = true } }, dryRun, skipInvalid = skip
        };
        var url = $"/api/v1/farming-seasons/{farming}/planting-seasons/bulk";

        var dry = JsonDocument.Parse(await (await owner.PostAsJsonAsync(url, Request(true, false))).Content.ReadAsStringAsync()).RootElement;
        Assert.True(dry.GetProperty("dryRun").GetBoolean());
        Assert.Equal(1, dry.GetProperty("validCount").GetInt32());
        Assert.Equal(1, dry.GetProperty("invalidCount").GetInt32());
        var blocked = dry.GetProperty("zones").EnumerateArray().Single(z => z.GetProperty("zoneId").GetGuid() == seed.ZoneAId);
        Assert.Contains("Vụ cũ Zone A", blocked.GetProperty("problems")[0].GetString());
        using (var scope = factory.Services.CreateScope())
            Assert.Equal(1, await scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>().PlantingSeasons.CountAsync());

        // Không skipInvalid: có Zone sai thì không tạo gì.
        var strict = JsonDocument.Parse(await (await owner.PostAsJsonAsync(url, Request(false, false))).Content.ReadAsStringAsync()).RootElement;
        Assert.False(strict.GetProperty("created").GetBoolean());
        // skipInvalid: tạo cho Zone hợp lệ, vụ đang chạy của Zone A không bị đụng.
        var real = JsonDocument.Parse(await (await owner.PostAsJsonAsync(url, Request(false, true))).Content.ReadAsStringAsync()).RootElement;
        Assert.True(real.GetProperty("created").GetBoolean());
        using var scope2 = factory.Services.CreateScope();
        var db = scope2.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        Assert.Equal(2, await db.PlantingSeasons.CountAsync());
        Assert.Equal(PlantingSeasonStatus.InProgress, (await db.PlantingSeasons.SingleAsync(x => x.ZoneId == seed.ZoneAId)).Status);
        Assert.Equal(farming, (await db.PlantingSeasons.SingleAsync(x => x.ZoneId == zone2)).FarmingSeasonId);
    }

    [Fact]
    public async Task A_single_zone_is_enough_for_bulk_and_other_tenants_zones_and_farming_seasons_are_not_reachable()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        var farming = await AddFarmingSeasonAsync(factory, seed.FarmAId, "Đông Xuân 2026", seedTenant: true);
        using var owner = factory.CreateClient(); await LoginAsync(owner, "owner-a@example.com");
        object Request(Guid zone) => new
        {
            cropId = Crop, varietyId = Variety, growthProfileId = SystemProfile, namePrefix = "ĐX", startDate = Today(-1), expectedEndDate = Today(60),
            zones = new[] { new { zoneId = zone, setZoneCrop = true } }, dryRun = false, skipInvalid = false
        };

        var one = await owner.PostAsJsonAsync($"/api/v1/farming-seasons/{farming}/planting-seasons/bulk", Request(seed.ZoneAId));
        Assert.Equal(HttpStatusCode.OK, one.StatusCode);
        Assert.True(JsonDocument.Parse(await one.Content.ReadAsStringAsync()).RootElement.GetProperty("created").GetBoolean());

        // Zone của Tenant khác: chỉ báo "không tồn tại", không tạo gì.
        var foreign = JsonDocument.Parse(await (await owner.PostAsJsonAsync($"/api/v1/farming-seasons/{farming}/planting-seasons/bulk", Request(seed.ZoneBId))).Content.ReadAsStringAsync()).RootElement;
        Assert.False(foreign.GetProperty("created").GetBoolean());
        Assert.Contains("không tồn tại", foreign.GetProperty("zones")[0].GetProperty("problems")[0].GetString());

        // Mùa vụ (FarmingSeason) riêng của Tenant B: Tenant A không thấy.
        var other = await AddFarmingSeasonAsync(factory, seed.FarmBId, "Mùa vụ của B", tenantOfFarm: true);
        Assert.Equal(HttpStatusCode.NotFound, (await owner.PostAsJsonAsync($"/api/v1/farming-seasons/{other}/planting-seasons/bulk", Request(seed.ZoneAId))).StatusCode);
    }

    // ── Hỗ trợ ──

    private static async Task<Guid> AddFarmingSeasonAsync(TestApplicationFactory factory, Guid farmId, string name, bool seedTenant = false, bool tenantOfFarm = true)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        var farm = await db.Farms.SingleAsync(x => x.Id == farmId);
        var fs = new FarmingSeason
        {
            TenantId = tenantOfFarm ? farm.TenantId : null, Code = $"FS-{Guid.NewGuid():N}"[..12], Name = name, Year = 2026,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-30)), EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(120))
        };
        db.FarmingSeasons.Add(fs);
        await db.SaveChangesAsync();
        return fs.Id;
    }

    private static async Task<Guid> AddZoneAsync(TestApplicationFactory factory, Guid fieldId, string name)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        var zone = new Zone { FieldId = fieldId, Name = name, AreaM2 = 50, ZoneType = "Greenhouse" };
        db.Zones.Add(zone);
        await db.SaveChangesAsync();
        return zone.Id;
    }

    private static async Task AddSeasonAsync(TestApplicationFactory factory, Guid zoneId, string name, PlantingSeasonStatus status)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        var zone = await db.Zones.SingleAsync(z => z.Id == zoneId);
        zone.CropId = Crop; zone.CropVarietyId = Variety;
        db.PlantingSeasons.Add(new PlantingSeason
        {
            ZoneId = zoneId, CropId = Crop, VarietyId = Variety, GrowthProfileId = SystemProfile, CurrentGrowthStageId = Stage1, Name = name,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-5)), ExpectedEndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(60)), Status = status
        });
        await db.SaveChangesAsync();
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
