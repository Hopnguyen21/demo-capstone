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

/// <summary>Cây/giống hiện tại là thuộc tính của Zone, độc lập với vụ mùa.</summary>
public sealed class ZoneCropTests
{
    private static readonly Guid SystemCrop = Guid.Parse("10000000-0000-0000-0000-000000000001");
    private static readonly Guid SystemVariety = Guid.Parse("10000000-0000-0000-0000-000000000002");
    private static readonly Guid SystemProfile = Guid.Parse("10000000-0000-0000-0000-000000000003");

    private static async Task<HttpClient> OwnerAsync(TestApplicationFactory factory, string email = "owner-a@example.com")
    {
        var client = factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = "ValidPassword1!" });
        response.EnsureSuccessStatusCode();
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", json.RootElement.GetProperty("accessToken").GetString());
        return client;
    }

    private static async Task<JsonElement> GetZoneAsync(HttpClient client, Guid zoneId)
    {
        var response = await client.GetAsync($"/api/v1/zones/{zoneId}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement.Clone();
    }

    private static async Task<HttpResponseMessage> UpdateZoneAsync(HttpClient client, Guid zoneId, object crop)
    {
        var zone = await GetZoneAsync(client, zoneId);
        var body = new Dictionary<string, object?> { ["name"] = zone.GetProperty("name").GetString() };
        foreach (var p in crop.GetType().GetProperties()) body[p.Name] = p.GetValue(crop);
        return await client.PutAsJsonAsync($"/api/v1/zones/{zoneId}", body);
    }

    // Cây chỉ được gán cho Zone khi tạo vụ; test dựng sẵn trạng thái Zone đã có cây bằng cách ghi thẳng cơ sở dữ liệu.
    private static async Task AssignCropAsync(TestApplicationFactory factory, Guid zoneId, Guid cropId, Guid? varietyId = null)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        var zone = await db.Zones.SingleAsync(x => x.Id == zoneId);
        zone.CropId = cropId; zone.CropVarietyId = varietyId;
        await db.SaveChangesAsync();
    }

    private static async Task<Guid> AddCropAsync(TestApplicationFactory factory, string name, Guid? tenantId = null)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        var crop = new Crop { Name = name, NormalizedName = name.ToUpperInvariant(), TenantId = tenantId };
        db.Crops.Add(crop);
        await db.SaveChangesAsync();
        return crop.Id;
    }

    private static async Task<Guid> AddSeasonAsync(TestApplicationFactory factory, Guid zoneId, Guid cropId, Guid? varietyId, PlantingSeasonStatus status)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        var stage = await db.GrowthStages.AsNoTracking().FirstAsync(x => x.GrowthProfileId == SystemProfile);
        var season = new PlantingSeason
        {
            ZoneId = zoneId, CropId = cropId, VarietyId = varietyId, GrowthProfileId = SystemProfile, CurrentGrowthStageId = stage.Id,
            Name = $"Vụ {status}", StartDate = new DateOnly(2026, 9, 1), ExpectedEndDate = new DateOnly(2026, 12, 1), Status = status
        };
        db.PlantingSeasons.Add(season);
        await db.SaveChangesAsync();
        return season.Id;
    }

    [Fact]
    public async Task New_zone_has_no_crop_and_shows_the_empty_state_instead_of_a_default()
    {
        using var factory = new TestApplicationFactory();
        var seed = await factory.SeedAsync();
        using var client = await OwnerAsync(factory);

        var zone = await GetZoneAsync(client, seed.ZoneAId);

        Assert.Equal(JsonValueKind.Null, zone.GetProperty("currentCrop").ValueKind);
        Assert.Equal(JsonValueKind.Null, zone.GetProperty("currentStage").ValueKind);
        Assert.Equal("None", zone.GetProperty("seasonStatus").GetString());
    }

    private static Task<HttpResponseMessage> CreateSeasonAsync(HttpClient client, Guid zoneId, bool setZoneCrop) =>
        client.PostAsJsonAsync($"/api/v1/zones/{zoneId}/planting-seasons", new
        {
            cropId = SystemCrop, varietyId = SystemVariety, growthProfileId = SystemProfile, name = "Vụ mới",
            startDate = "2026-10-01", expectedEndDate = "2026-12-20", setZoneCrop
        });

    [Fact]
    public async Task Zone_update_cannot_assign_a_crop_but_keeps_an_existing_one()
    {
        using var factory = new TestApplicationFactory();
        var seed = await factory.SeedAsync();
        using var client = await OwnerAsync(factory);

        Assert.Equal(HttpStatusCode.OK, (await UpdateZoneAsync(client, seed.ZoneAId, new { cropId = SystemCrop, varietyId = SystemVariety })).StatusCode);
        Assert.Equal(JsonValueKind.Null, (await GetZoneAsync(client, seed.ZoneAId)).GetProperty("currentCrop").ValueKind); // cropId bị bỏ qua

        await AssignCropAsync(factory, seed.ZoneAId, SystemCrop, SystemVariety);
        Assert.Equal(HttpStatusCode.OK, (await UpdateZoneAsync(client, seed.ZoneAId, new { notes = "ghi chú mới" })).StatusCode);
        Assert.Equal(SystemCrop, (await GetZoneAsync(client, seed.ZoneAId)).GetProperty("cropId").GetGuid());
        Assert.Equal(HttpStatusCode.OK, (await UpdateZoneAsync(client, seed.ZoneAId, new { clearCrop = true })).StatusCode);
        Assert.Equal(JsonValueKind.Null, (await GetZoneAsync(client, seed.ZoneAId)).GetProperty("currentCrop").ValueKind);
    }

    [Fact]
    public async Task Clearing_the_zone_crop_is_refused_while_an_in_progress_season_exists()
    {
        using var factory = new TestApplicationFactory();
        var seed = await factory.SeedAsync();
        using var client = await OwnerAsync(factory);
        await AssignCropAsync(factory, seed.ZoneAId, SystemCrop, SystemVariety);
        await AddSeasonAsync(factory, seed.ZoneAId, SystemCrop, SystemVariety, PlantingSeasonStatus.InProgress);

        Assert.Equal(HttpStatusCode.Conflict, (await UpdateZoneAsync(client, seed.ZoneAId, new { clearCrop = true })).StatusCode);
        Assert.Equal(SystemCrop, (await GetZoneAsync(client, seed.ZoneAId)).GetProperty("cropId").GetGuid());
    }

    [Fact]
    public async Task Creating_a_season_is_the_only_way_to_assign_the_zone_crop()
    {
        using var factory = new TestApplicationFactory();
        var seed = await factory.SeedAsync();
        using var client = await OwnerAsync(factory);

        Assert.Equal(HttpStatusCode.Created, (await CreateSeasonAsync(client, seed.ZoneAId, setZoneCrop: false)).StatusCode);

        var zone = await GetZoneAsync(client, seed.ZoneAId);
        Assert.Equal(SystemCrop, zone.GetProperty("cropId").GetGuid()); // Zone chưa có cây nên vụ mới gán cây, không cần cờ xác nhận
        Assert.Equal("InProgress", zone.GetProperty("seasonStatus").GetString());
    }

    [Fact]
    public async Task Completed_and_cancelled_seasons_never_become_the_current_crop()
    {
        using var factory = new TestApplicationFactory();
        var seed = await factory.SeedAsync();
        await AddSeasonAsync(factory, seed.ZoneAId, SystemCrop, SystemVariety, PlantingSeasonStatus.Completed);
        await AddSeasonAsync(factory, seed.ZoneAId, SystemCrop, SystemVariety, PlantingSeasonStatus.Cancelled);
        using var client = await OwnerAsync(factory);

        var zone = await GetZoneAsync(client, seed.ZoneAId);

        Assert.Equal(JsonValueKind.Null, zone.GetProperty("currentCrop").ValueKind);
        Assert.Equal("None", zone.GetProperty("seasonStatus").GetString());
    }

    [Fact]
    public async Task Planned_season_is_shown_as_planned_crop_not_as_current_crop()
    {
        using var factory = new TestApplicationFactory();
        var seed = await factory.SeedAsync();
        await AddSeasonAsync(factory, seed.ZoneAId, SystemCrop, SystemVariety, PlantingSeasonStatus.Planned);
        using var client = await OwnerAsync(factory);

        var zone = await GetZoneAsync(client, seed.ZoneAId);

        Assert.Equal(JsonValueKind.Null, zone.GetProperty("currentCrop").ValueKind);
        Assert.Equal("PlannedOnly", zone.GetProperty("seasonStatus").GetString());
        Assert.False(string.IsNullOrWhiteSpace(zone.GetProperty("plannedCrop").GetString()));
    }

    [Fact]
    public async Task In_progress_season_of_another_crop_is_reported_as_mismatch_and_gives_no_stage()
    {
        using var factory = new TestApplicationFactory();
        var seed = await factory.SeedAsync();
        var zoneCrop = await AddCropAsync(factory, "Cây của Zone");
        using var client = await OwnerAsync(factory);
        await AssignCropAsync(factory, seed.ZoneAId, zoneCrop);
        await AddSeasonAsync(factory, seed.ZoneAId, SystemCrop, SystemVariety, PlantingSeasonStatus.InProgress);

        var zone = await GetZoneAsync(client, seed.ZoneAId);

        Assert.Equal("Cây của Zone", zone.GetProperty("currentCrop").GetString());
        Assert.Equal("Mismatch", zone.GetProperty("seasonStatus").GetString());
        Assert.Equal(JsonValueKind.Null, zone.GetProperty("currentStage").ValueKind);
    }

    [Fact]
    public async Task In_progress_season_of_the_same_crop_gives_the_stage()
    {
        using var factory = new TestApplicationFactory();
        var seed = await factory.SeedAsync();
        using var client = await OwnerAsync(factory);
        await AssignCropAsync(factory, seed.ZoneAId, SystemCrop, SystemVariety);
        await AddSeasonAsync(factory, seed.ZoneAId, SystemCrop, SystemVariety, PlantingSeasonStatus.InProgress);

        var zone = await GetZoneAsync(client, seed.ZoneAId);

        Assert.Equal("InProgress", zone.GetProperty("seasonStatus").GetString());
        Assert.False(string.IsNullOrWhiteSpace(zone.GetProperty("currentStage").GetString()));
    }

    [Fact]
    public async Task Starting_a_season_with_a_different_crop_needs_explicit_confirmation_to_change_the_zone_crop()
    {
        using var factory = new TestApplicationFactory();
        var seed = await factory.SeedAsync();
        var zoneCrop = await AddCropAsync(factory, "Cây của Zone");
        using var client = await OwnerAsync(factory);
        await AssignCropAsync(factory, seed.ZoneAId, zoneCrop);

        var refused = await CreateSeasonAsync(client, seed.ZoneAId, setZoneCrop: false);
        Assert.Equal(HttpStatusCode.Conflict, refused.StatusCode);
        Assert.Equal(zoneCrop, (await GetZoneAsync(client, seed.ZoneAId)).GetProperty("cropId").GetGuid()); // không ghi đè ngầm
        Assert.Empty(await SeasonsOfAsync(factory, seed.ZoneAId));

        var confirmed = await CreateSeasonAsync(client, seed.ZoneAId, setZoneCrop: true);
        Assert.Equal(HttpStatusCode.Created, confirmed.StatusCode);
        var zone = await GetZoneAsync(client, seed.ZoneAId);
        Assert.Equal(SystemCrop, zone.GetProperty("cropId").GetGuid());
        Assert.Equal("InProgress", zone.GetProperty("seasonStatus").GetString());
    }

    [Fact]
    public async Task Future_start_date_cannot_create_an_in_progress_season()
    {
        using var factory = new TestApplicationFactory();
        var seed = await factory.SeedAsync();
        using var client = await OwnerAsync(factory);

        var response = await client.PostAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}/planting-seasons", new
        {
            cropId = SystemCrop, varietyId = SystemVariety, growthProfileId = SystemProfile, name = "Tương lai",
            startDate = DateTime.UtcNow.AddDays(10).ToString("yyyy-MM-dd"), expectedEndDate = DateTime.UtcNow.AddDays(60).ToString("yyyy-MM-dd")
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private static async Task<List<PlantingSeason>> SeasonsOfAsync(TestApplicationFactory factory, Guid zoneId)
    {
        using var scope = factory.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>().PlantingSeasons.AsNoTracking().Where(x => x.ZoneId == zoneId).ToListAsync();
    }

    [Fact]
    public async Task Owner_of_another_tenant_cannot_change_the_crop_of_this_zone()
    {
        using var factory = new TestApplicationFactory();
        var seed = await factory.SeedAsync();
        using var clientB = await OwnerAsync(factory, "owner-b@example.com");

        var response = await clientB.PutAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}", new { name = "Zone khác", cropId = SystemCrop });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // ── Tạo vụ hàng loạt: mỗi Zone một vụ riêng trong cùng mùa vụ ──
    private static async Task<(Guid FarmingSeasonId, Guid ZoneB1, Guid ZoneB2)> PrepareBulkAsync(TestApplicationFactory factory, SeedData seed)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        var tenantId = await db.Farms.AsNoTracking().Where(x => x.Id == seed.FarmAId).Select(x => x.TenantId).SingleAsync();
        var fs = new FarmingSeason { TenantId = tenantId, Code = "DX26", Name = "Đông Xuân 2026", Year = 2026, StartDate = new DateOnly(2026, 9, 1), EndDate = new DateOnly(2027, 3, 1) };
        Zone Extra(string name) => new() { FieldId = seed.FieldAId, Name = name, AreaM2 = 10, ZoneType = "Greenhouse", Status = ZoneStatus.Inactive };
        var z1 = Extra("Bulk Z1"); var z2 = Extra("Bulk Z2");
        db.AddRange(fs, z1, z2);
        await db.SaveChangesAsync();
        return (fs.Id, z1.Id, z2.Id);
    }

    private static Task<HttpResponseMessage> BulkAsync(HttpClient client, Guid farmingSeasonId, IEnumerable<object> zones, bool dryRun = false, bool skipInvalid = false) =>
        client.PostAsJsonAsync($"/api/v1/farming-seasons/{farmingSeasonId}/planting-seasons/bulk", new
        {
            cropId = SystemCrop, varietyId = SystemVariety, growthProfileId = SystemProfile, namePrefix = "Đông Xuân",
            startDate = "2026-10-01", expectedEndDate = "2026-12-20", zones, dryRun, skipInvalid
        });

    [Fact]
    public async Task Bulk_dry_run_reports_each_zone_and_creates_nothing()
    {
        using var factory = new TestApplicationFactory();
        var seed = await factory.SeedAsync();
        var (fsId, z1, z2) = await PrepareBulkAsync(factory, seed);
        await AddSeasonAsync(factory, z2, SystemCrop, SystemVariety, PlantingSeasonStatus.InProgress);
        using var client = await OwnerAsync(factory);

        var response = await BulkAsync(client, fsId, [new { zoneId = z1, setZoneCrop = true }, new { zoneId = z2, setZoneCrop = true }, new { zoneId = seed.ZoneBId, setZoneCrop = true }], dryRun: true);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
        Assert.False(body.GetProperty("created").GetBoolean());
        Assert.Equal(1, body.GetProperty("validCount").GetInt32());
        var zones = body.GetProperty("zones").EnumerateArray().ToList();
        Assert.True(zones[0].GetProperty("valid").GetBoolean());
        Assert.Contains("đang canh tác", zones[1].GetProperty("problems")[0].GetString());
        Assert.Contains("không tồn tại", zones[2].GetProperty("problems")[0].GetString()); // Zone tenant khác không bị lộ
        Assert.Empty(await SeasonsOfAsync(factory, z1));
    }

    [Fact]
    public async Task Bulk_create_is_all_or_nothing_unless_invalid_zones_are_skipped()
    {
        using var factory = new TestApplicationFactory();
        var seed = await factory.SeedAsync();
        var (fsId, z1, z2) = await PrepareBulkAsync(factory, seed);
        await AddSeasonAsync(factory, z2, SystemCrop, SystemVariety, PlantingSeasonStatus.InProgress);
        using var client = await OwnerAsync(factory);
        var zones = new object[] { new { zoneId = z1, setZoneCrop = true }, new { zoneId = z2, setZoneCrop = true } };

        var strict = JsonDocument.Parse(await (await BulkAsync(client, fsId, zones)).Content.ReadAsStringAsync()).RootElement;
        Assert.False(strict.GetProperty("created").GetBoolean());
        Assert.Empty(await SeasonsOfAsync(factory, z1));

        var skipped = JsonDocument.Parse(await (await BulkAsync(client, fsId, zones, skipInvalid: true)).Content.ReadAsStringAsync()).RootElement;
        Assert.True(skipped.GetProperty("created").GetBoolean());
        var created = await SeasonsOfAsync(factory, z1);
        Assert.Single(created);
        Assert.Equal(fsId, created[0].FarmingSeasonId);
        Assert.Equal(SystemCrop, (await GetZoneAsync(client, z1)).GetProperty("cropId").GetGuid()); // gán cây vì Owner xác nhận
    }

    [Fact]
    public async Task Bulk_create_needs_per_zone_confirmation_to_set_the_zone_crop_and_never_repeats_a_zone_in_a_season()
    {
        using var factory = new TestApplicationFactory();
        var seed = await factory.SeedAsync();
        var (fsId, z1, _) = await PrepareBulkAsync(factory, seed);
        await AssignCropAsync(factory, z1, await AddCropAsync(factory, "Cây đang có"));
        using var client = await OwnerAsync(factory);

        var unconfirmed = JsonDocument.Parse(await (await BulkAsync(client, fsId, [new { zoneId = z1 }])).Content.ReadAsStringAsync()).RootElement;
        Assert.False(unconfirmed.GetProperty("created").GetBoolean());
        Assert.Contains("xác nhận", unconfirmed.GetProperty("zones")[0].GetProperty("problems")[0].GetString());

        Assert.True(JsonDocument.Parse(await (await BulkAsync(client, fsId, [new { zoneId = z1, setZoneCrop = true }])).Content.ReadAsStringAsync()).RootElement.GetProperty("created").GetBoolean());
        var again = JsonDocument.Parse(await (await BulkAsync(client, fsId, [new { zoneId = z1, setZoneCrop = true }])).Content.ReadAsStringAsync()).RootElement;
        Assert.False(again.GetProperty("created").GetBoolean()); // một Zone chỉ một vụ trong một mùa vụ
        Assert.Single(await SeasonsOfAsync(factory, z1));
    }
}
