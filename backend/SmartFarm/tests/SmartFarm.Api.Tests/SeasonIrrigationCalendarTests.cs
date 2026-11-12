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

/// <summary>Lịch tưới tùy chỉnh theo NGÀY của vụ trồng (Zone + mùa vụ), lưu ở backend; lịch profile theo giai đoạn giữ nguyên làm lịch mẫu.</summary>
public sealed class SeasonIrrigationCalendarTests
{
    private static readonly Guid Crop = Guid.Parse("10000000-0000-0000-0000-000000000001");
    private static readonly Guid Variety = Guid.Parse("10000000-0000-0000-0000-000000000002");
    private static readonly Guid SystemProfile = Guid.Parse("10000000-0000-0000-0000-000000000003");
    private static readonly Guid Stage1 = Guid.Parse("10000000-0000-0000-0000-000000000004");

    private const string CropPlan =
        """{"repeatType":"DAILY","sessions":[{"title":"Sáng","startTime":"06:00","durationMinutes":8,"enabled":true}]}""";

    private static object Session(string title, string time, int seconds, bool enabled = true, string? method = null, int? water = null) =>
        new { title, startTime = time, durationSeconds = seconds, enabled, method, waterPerPlantMl = water };

    private static string Url(Guid zone, Guid season) => $"/api/v1/zones/{zone}/planting-seasons/{season}/irrigation-calendar";

    // ── Đọc ──

    [Fact]
    public async Task Calendar_without_overrides_shows_profile_template_and_says_none_when_no_source_exists()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        var season = await AddSeasonAsync(factory, seed.ZoneAId);
        using var owner = factory.CreateClient(); await LoginAsync(owner, "owner-a@example.com");

        var json = await GetAsync(owner, seed.ZoneAId, season);

        Assert.Equal("NoOverrides", json.GetProperty("status").GetString());
        Assert.False(json.GetProperty("hasOverrides").GetBoolean());
        Assert.Equal(66, json.GetProperty("totalDays").GetInt32());
        Assert.Equal(66, json.GetProperty("days").GetArrayLength());
        Assert.Equal(6, json.GetProperty("todayDayNumber").GetInt32());
        Assert.True(json.GetProperty("isEditable").GetBoolean());
        var day1 = json.GetProperty("days")[0];
        Assert.Equal("None", day1.GetProperty("source").GetString());
        Assert.Equal(0, day1.GetProperty("sessions").GetArrayLength());
        Assert.Equal(1, day1.GetProperty("dayNumber").GetInt32());
    }

    [Fact]
    public async Task Calendar_falls_back_profile_then_crop_sample_and_labels_each_source()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        var season = await AddSeasonAsync(factory, seed.ZoneAId);
        await SetCropPlanAsync(factory, CropPlan);
        using var owner = factory.CreateClient(); await LoginAsync(owner, "owner-a@example.com");

        var crop = await GetAsync(owner, seed.ZoneAId, season);
        Assert.Equal("Crop", crop.GetProperty("days")[0].GetProperty("source").GetString());
        Assert.Equal("06:00", crop.GetProperty("days")[0].GetProperty("sessions")[0].GetProperty("startTime").GetString());

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            db.GrowthStageIrrigationSessions.Add(new GrowthStageIrrigationSession { GrowthStageId = Stage1, SortOrder = 0, Title = "Profile ca", StartTime = new TimeOnly(5, 30), DurationSeconds = 300 });
            await db.SaveChangesAsync();
        }
        var profile = await GetAsync(owner, seed.ZoneAId, season);
        Assert.Equal("Profile", profile.GetProperty("days")[0].GetProperty("source").GetString());
        Assert.Equal("05:30", profile.GetProperty("days")[0].GetProperty("sessions")[0].GetProperty("startTime").GetString());
        // Giai đoạn 2 chưa có ca riêng => vẫn là lịch mẫu của cây; ngày ngoài giai đoạn của profile => không có nguồn.
        Assert.Equal("Crop", profile.GetProperty("days")[20].GetProperty("source").GetString());
        Assert.Equal("None", profile.GetProperty("days")[60].GetProperty("source").GetString());
    }

    // ── Ghi / khôi phục ──

    [Fact]
    public async Task Saving_one_day_persists_it_and_leaves_other_days_and_the_profile_unchanged()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        var season = await AddSeasonAsync(factory, seed.ZoneAId);
        await SetCropPlanAsync(factory, CropPlan);
        using var owner = factory.CreateClient(); await LoginAsync(owner, "owner-a@example.com");

        var put = await owner.PutAsJsonAsync(Url(seed.ZoneAId, season), new { days = new[] { new { dayNumber = 3, sessions = new[] { Session("Trưa", "12:15", 240, true, "Phun sương", 80), Session("Chiều", "16:45", 180) } } } });

        Assert.Equal(HttpStatusCode.OK, put.StatusCode);
        var saved = JsonDocument.Parse(await put.Content.ReadAsStringAsync()).RootElement;
        Assert.Equal("Current", saved.GetProperty("status").GetString());
        Assert.Equal(1, saved.GetProperty("overrideDayCount").GetInt32());
        Assert.NotEqual(JsonValueKind.Null, saved.GetProperty("updatedAtUtc").ValueKind);
        Assert.Equal(seed.OwnerAId, saved.GetProperty("updatedByUserId").GetGuid());

        var reload = await GetAsync(owner, seed.ZoneAId, season);
        var day3 = reload.GetProperty("days")[2];
        Assert.Equal("Override", day3.GetProperty("source").GetString());
        Assert.True(day3.GetProperty("isOverride").GetBoolean());
        Assert.Equal(2, day3.GetProperty("sessions").GetArrayLength());
        Assert.Equal("12:15", day3.GetProperty("sessions")[0].GetProperty("startTime").GetString());
        Assert.Equal("Phun sương", day3.GetProperty("sessions")[0].GetProperty("method").GetString());
        Assert.Equal(80, day3.GetProperty("sessions")[0].GetProperty("waterPerPlantMl").GetInt32());
        Assert.Equal("Crop", reload.GetProperty("days")[3].GetProperty("source").GetString()); // ngày 4 không đổi
        // Lịch mẫu của profile hệ thống không bị đụng tới.
        using var scope = factory.Services.CreateScope();
        Assert.Equal(0, await scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>().GrowthStageIrrigationSessions.CountAsync());
    }

    [Fact]
    public async Task Saving_the_same_day_again_replaces_its_sessions_and_an_empty_list_means_no_irrigation_that_day()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        var season = await AddSeasonAsync(factory, seed.ZoneAId);
        using var owner = factory.CreateClient(); await LoginAsync(owner, "owner-a@example.com");
        await owner.PutAsJsonAsync(Url(seed.ZoneAId, season), new { days = new[] { new { dayNumber = 2, sessions = new[] { Session("A", "06:00", 60), Session("B", "07:00", 60) } } } });

        var second = await owner.PutAsJsonAsync(Url(seed.ZoneAId, season), new { days = new[] { new { dayNumber = 2, sessions = new[] { Session("Mới", "09:00", 90) } }, new { dayNumber = 4, sessions = Array.Empty<object>() } } });

        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
        var json = await GetAsync(owner, seed.ZoneAId, season);
        Assert.Equal(1, json.GetProperty("days")[1].GetProperty("sessions").GetArrayLength());
        Assert.Equal("Mới", json.GetProperty("days")[1].GetProperty("sessions")[0].GetProperty("title").GetString());
        Assert.Equal("Override", json.GetProperty("days")[3].GetProperty("source").GetString());
        Assert.Equal(0, json.GetProperty("days")[3].GetProperty("sessions").GetArrayLength());
        Assert.Equal(2, json.GetProperty("overrideDayCount").GetInt32());
    }

    [Fact]
    public async Task Restoring_one_day_or_the_whole_season_goes_back_to_the_template_without_touching_the_rest()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        var season = await AddSeasonAsync(factory, seed.ZoneAId);
        using var owner = factory.CreateClient(); await LoginAsync(owner, "owner-a@example.com");
        await owner.PutAsJsonAsync(Url(seed.ZoneAId, season), new { days = new[] { new { dayNumber = 1, sessions = new[] { Session("A", "06:00", 60) } }, new { dayNumber = 2, sessions = new[] { Session("B", "07:00", 60) } } } });

        var one = await owner.DeleteAsync(Url(seed.ZoneAId, season) + "/days/1");
        Assert.Equal(HttpStatusCode.OK, one.StatusCode);
        var afterOne = JsonDocument.Parse(await one.Content.ReadAsStringAsync()).RootElement;
        Assert.Equal(1, afterOne.GetProperty("overrideDayCount").GetInt32());
        Assert.Equal("None", afterOne.GetProperty("days")[0].GetProperty("source").GetString());
        Assert.Equal("Override", afterOne.GetProperty("days")[1].GetProperty("source").GetString());

        var all = await owner.DeleteAsync(Url(seed.ZoneAId, season));
        var afterAll = JsonDocument.Parse(await all.Content.ReadAsStringAsync()).RootElement;
        Assert.Equal("NoOverrides", afterAll.GetProperty("status").GetString());
        Assert.False(afterAll.GetProperty("hasOverrides").GetBoolean());
        // Khôi phục khi không có override vẫn thành công (idempotent).
        Assert.Equal(HttpStatusCode.OK, (await owner.DeleteAsync(Url(seed.ZoneAId, season) + "/days/9")).StatusCode);
    }

    [Fact]
    public async Task Invalid_input_is_rejected_with_400_and_saves_nothing()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        var season = await AddSeasonAsync(factory, seed.ZoneAId);
        using var owner = factory.CreateClient(); await LoginAsync(owner, "owner-a@example.com");
        var url = Url(seed.ZoneAId, season);

        Assert.Equal(HttpStatusCode.BadRequest, (await owner.PutAsJsonAsync(url, new { days = new[] { new { dayNumber = 67, sessions = Array.Empty<object>() } } })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await owner.PutAsJsonAsync(url, new { days = new[] { new { dayNumber = 0, sessions = Array.Empty<object>() } } })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await owner.PutAsJsonAsync(url, new { days = new[] { new { dayNumber = 1, sessions = new[] { Session("A", "25:00", 60) } } } })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await owner.PutAsJsonAsync(url, new { days = new[] { new { dayNumber = 1, sessions = new[] { Session("A", "06:00", 1801) } } } })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await owner.PutAsJsonAsync(url, new { days = new[] { new { dayNumber = 1, sessions = new[] { Session("A", "06:00", 60), Session("B", "06:00", 60) } } } })).StatusCode);
        var nine = Enumerable.Range(0, 9).Select(i => Session($"Ca {i}", $"0{i}:00", 60)).ToArray();
        Assert.Equal(HttpStatusCode.BadRequest, (await owner.PutAsJsonAsync(url, new { days = new[] { new { dayNumber = 1, sessions = nine } } })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await owner.PutAsJsonAsync(url, new { days = new[] { new { dayNumber = 1, sessions = Array.Empty<object>() }, new { dayNumber = 1, sessions = Array.Empty<object>() } } })).StatusCode);
        // Một ngày hợp lệ đi cùng một ngày sai => không lưu gì cả.
        Assert.Equal(HttpStatusCode.BadRequest, (await owner.PutAsJsonAsync(url, new { days = new[] { new { dayNumber = 1, sessions = new[] { Session("A", "06:00", 60) } }, new { dayNumber = 99, sessions = Array.Empty<object>() } } })).StatusCode);

        Assert.False((await GetAsync(owner, seed.ZoneAId, season)).GetProperty("hasOverrides").GetBoolean());
    }

    [Fact]
    public async Task Finished_season_is_read_only()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        var season = await AddSeasonAsync(factory, seed.ZoneAId, status: PlantingSeasonStatus.Completed);
        using var owner = factory.CreateClient(); await LoginAsync(owner, "owner-a@example.com");

        var json = await GetAsync(owner, seed.ZoneAId, season);
        Assert.False(json.GetProperty("isEditable").GetBoolean());
        Assert.Equal(HttpStatusCode.Conflict, (await owner.PutAsJsonAsync(Url(seed.ZoneAId, season), new { days = new[] { new { dayNumber = 1, sessions = Array.Empty<object>() } } })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await owner.DeleteAsync(Url(seed.ZoneAId, season))).StatusCode);
    }

    // ── Quyền truy cập ──

    [Fact]
    public async Task Other_tenant_and_wrong_zone_cannot_read_or_change_the_calendar()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        var season = await AddSeasonAsync(factory, seed.ZoneAId);
        using var ownerB = factory.CreateClient(); await LoginAsync(ownerB, "owner-b@example.com");

        Assert.Equal(HttpStatusCode.NotFound, (await ownerB.GetAsync(Url(seed.ZoneAId, season))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await ownerB.PutAsJsonAsync(Url(seed.ZoneAId, season), new { days = new[] { new { dayNumber = 1, sessions = Array.Empty<object>() } } })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await ownerB.DeleteAsync(Url(seed.ZoneAId, season))).StatusCode);
        // Vụ của Zone A truy cập qua Zone B của chính Tenant B cũng không thấy (kiểm tra cả chuỗi cha-con).
        Assert.Equal(HttpStatusCode.NotFound, (await ownerB.GetAsync(Url(seed.ZoneBId, season))).StatusCode);
        using var ownerA = factory.CreateClient(); await LoginAsync(ownerA, "owner-a@example.com");
        Assert.Equal(HttpStatusCode.NotFound, (await ownerA.GetAsync(Url(seed.ZoneBId, season))).StatusCode);
    }

    [Fact]
    public async Task Farmer_with_zone_access_can_read_but_not_change_and_a_farmer_without_access_sees_nothing()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        var season = await AddSeasonAsync(factory, seed.ZoneAId);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            var farm = await db.Farms.SingleAsync(x => x.Id == seed.FarmAId);
            var farmer = await db.AppUsers.SingleAsync(x => x.Id == seed.UnassignedFarmerId);
            farmer.TenantId = farm.TenantId; farmer.FarmId = farm.Id;
            await db.SaveChangesAsync();
        }
        using var client = factory.CreateClient(); await LoginAsync(client, "farmer@example.com");
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync(Url(seed.ZoneAId, season))).StatusCode);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            db.UserZoneAccesses.Add(new UserZoneAccess { AppUserId = seed.UnassignedFarmerId, ZoneId = seed.ZoneAId, CanControl = true });
            await db.SaveChangesAsync();
        }
        var json = JsonDocument.Parse(await (await client.GetAsync(Url(seed.ZoneAId, season))).Content.ReadAsStringAsync()).RootElement;
        Assert.False(json.GetProperty("isEditable").GetBoolean());
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PutAsJsonAsync(Url(seed.ZoneAId, season), new { days = new[] { new { dayNumber = 1, sessions = Array.Empty<object>() } } })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.DeleteAsync(Url(seed.ZoneAId, season))).StatusCode);
    }

    // ── Vụ đổi: không âm thầm xóa dữ liệu ──

    [Fact]
    public async Task Changing_the_season_marks_the_calendar_stale_and_keeps_every_saved_day()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        var season = await AddSeasonAsync(factory, seed.ZoneAId);
        using var owner = factory.CreateClient(); await LoginAsync(owner, "owner-a@example.com");
        await owner.PutAsJsonAsync(Url(seed.ZoneAId, season), new { days = new[] { new { dayNumber = 3, sessions = new[] { Session("A", "06:00", 60) } }, new { dayNumber = 60, sessions = new[] { Session("Z", "08:00", 60) } } } });

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            var s = await db.PlantingSeasons.SingleAsync(x => x.Id == season);
            s.StartDate = s.StartDate.AddDays(1);          // đổi ngày bắt đầu
            s.ExpectedEndDate = s.StartDate.AddDays(30);   // rút ngắn vụ còn 31 ngày
            await db.SaveChangesAsync();
        }

        var json = await GetAsync(owner, seed.ZoneAId, season);
        Assert.Equal("Stale", json.GetProperty("status").GetString());
        var reasons = json.GetProperty("staleReasons").EnumerateArray().Select(x => x.GetString()).ToList();
        Assert.Contains("StartDateChanged", reasons);
        Assert.Contains("DurationChanged", reasons);
        Assert.Contains("DaysOutOfRange", reasons);
        Assert.Equal(2, json.GetProperty("overrideDayCount").GetInt32());
        var outOfRange = json.GetProperty("days").EnumerateArray().Single(d => d.GetProperty("outOfRange").GetBoolean());
        Assert.Equal(60, outOfRange.GetProperty("dayNumber").GetInt32());
        Assert.Equal("Z", outOfRange.GetProperty("sessions")[0].GetProperty("title").GetString());
        // Ngày 3 vẫn còn, ngày/giờ hiển thị theo ngày bắt đầu MỚI.
        Assert.Equal("Override", json.GetProperty("days")[2].GetProperty("source").GetString());
        // Người dùng khôi phục tường minh ngày ngoài vụ.
        var reset = await owner.DeleteAsync(Url(seed.ZoneAId, season) + "/days/60");
        Assert.Equal(1, JsonDocument.Parse(await reset.Content.ReadAsStringAsync()).RootElement.GetProperty("overrideDayCount").GetInt32());
    }

    // ── Đồng bộ thiết bị ──

    [Fact]
    public async Task Sync_uses_todays_override_when_present_and_reports_the_source_and_leaves_manual_schedules_alone()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        var season = await AddSeasonAsync(factory, seed.ZoneAId);
        await SetCropPlanAsync(factory, CropPlan);
        var pump = await AddPumpAsync(factory, seed.ZoneAId);
        using var owner = factory.CreateClient(); await LoginAsync(owner, "owner-a@example.com");
        await owner.PutAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}", new { name = "Zone A", growthProfileId = SystemProfile });
        var manual = await AddScheduleAsync(factory, seed.ZoneAId, pump, "Lịch thủ công của tôi");

        // Chưa có override hôm nay (ngày 6) => lịch mẫu của cây, báo nguồn Crop.
        var before = JsonDocument.Parse(await (await owner.PostAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}/schedules/sync-from-profile", new { actuatorId = pump })).Content.ReadAsStringAsync()).RootElement;
        Assert.Equal("Crop", before.GetProperty("source").GetString());

        // Override NGÀY KHÁC không ảnh hưởng; override HÔM NAY được dùng.
        await owner.PutAsJsonAsync(Url(seed.ZoneAId, season), new { days = new[] { new { dayNumber = 5, sessions = new[] { Session("Khác", "03:00", 60) } }, new { dayNumber = 6, sessions = new[] { Session("Hôm nay", "11:20", 200), Session("Tắt", "13:00", 100, false) } } } });
        var response = await owner.PostAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}/schedules/sync-from-profile", new { actuatorId = pump });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
        Assert.Equal("SeasonOverride", json.GetProperty("source").GetString());
        Assert.Equal(season, json.GetProperty("seasonId").GetGuid());
        Assert.Equal(6, json.GetProperty("dayNumber").GetInt32());
        var schedule = Assert.Single(json.GetProperty("schedules").EnumerateArray());
        Assert.Equal("20 11 * * *", schedule.GetProperty("cronExpression").GetString());
        Assert.Equal(200, schedule.GetProperty("durationSeconds").GetInt32());

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        Assert.True(await db.ControlSchedules.AnyAsync(x => x.Id == manual && x.IsActive), "lịch thủ công không được xóa/ghi đè");
        Assert.Equal(1, await db.ControlSchedules.CountAsync(x => x.ZoneId == seed.ZoneAId && x.Name.StartsWith("[AutoSync]")));

        // Khôi phục ngày hôm nay => đồng bộ lại quay về lịch theo giai đoạn/profile (ở đây là lịch mẫu của cây).
        await owner.DeleteAsync(Url(seed.ZoneAId, season) + "/days/6");
        var after = JsonDocument.Parse(await (await owner.PostAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}/schedules/sync-from-profile", new { actuatorId = pump })).Content.ReadAsStringAsync()).RootElement;
        Assert.Equal("Crop", after.GetProperty("source").GetString());
        Assert.False(after.TryGetProperty("dayNumber", out var n) && n.ValueKind != JsonValueKind.Null);
    }

    [Fact]
    public async Task Sync_refuses_a_today_override_without_enabled_sessions_instead_of_inventing_a_schedule()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        var season = await AddSeasonAsync(factory, seed.ZoneAId);
        await SetCropPlanAsync(factory, CropPlan);
        var pump = await AddPumpAsync(factory, seed.ZoneAId);
        using var owner = factory.CreateClient(); await LoginAsync(owner, "owner-a@example.com");
        await owner.PutAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}", new { name = "Zone A", growthProfileId = SystemProfile });
        await owner.PutAsJsonAsync(Url(seed.ZoneAId, season), new { days = new[] { new { dayNumber = 6, sessions = Array.Empty<object>() } } });

        var response = await owner.PostAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}/schedules/sync-from-profile", new { actuatorId = pump });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Contains("không tưới", await response.Content.ReadAsStringAsync());
    }

    // ── Hỗ trợ ──

    private static async Task<JsonElement> GetAsync(HttpClient client, Guid zone, Guid season)
    {
        var response = await client.GetAsync(Url(zone, season));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
    }

    /// <summary>Vụ bắt đầu 5 ngày trước (hôm nay là NGÀY 6), kết thúc dự kiến sau 60 ngày => 66 ngày.</summary>
    private static async Task<Guid> AddSeasonAsync(TestApplicationFactory factory, Guid zoneId, PlantingSeasonStatus status = PlantingSeasonStatus.InProgress)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        var zone = await db.Zones.SingleAsync(z => z.Id == zoneId);
        zone.CropId = Crop; zone.CropVarietyId = Variety;
        var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, TimeZoneInfo.FindSystemTimeZoneById("Asia/Ho_Chi_Minh")));
        var season = new PlantingSeason
        {
            ZoneId = zoneId, CropId = Crop, VarietyId = Variety, GrowthProfileId = SystemProfile, CurrentGrowthStageId = Stage1, Name = "Vụ test",
            StartDate = today.AddDays(-5), ExpectedEndDate = today.AddDays(60), Status = status
        };
        db.PlantingSeasons.Add(season);
        await db.SaveChangesAsync();
        return season.Id;
    }

    private static async Task SetCropPlanAsync(TestApplicationFactory factory, string plan)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        (await db.Crops.SingleAsync(c => c.Id == Crop)).CalendarIrrigationPlan = plan;
        await db.SaveChangesAsync();
    }

    private static async Task<Guid> AddScheduleAsync(TestApplicationFactory factory, Guid zoneId, Guid actuatorId, string name)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        var zone = await db.Zones.Include(z => z.Field).ThenInclude(f => f.Farm).SingleAsync(z => z.Id == zoneId);
        var schedule = new ControlSchedule { TenantId = zone.Field.Farm.TenantId, FarmId = zone.Field.FarmId, ZoneId = zoneId, ActuatorId = actuatorId, Name = name, CronExpression = "0 18 * * *", DurationSeconds = 120, IsActive = true, NextRunAtUtc = DateTime.UtcNow.AddHours(1) };
        db.ControlSchedules.Add(schedule);
        await db.SaveChangesAsync();
        return schedule.Id;
    }

    private static async Task<Guid> AddPumpAsync(TestApplicationFactory factory, Guid zoneId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        var zone = await db.Zones.Include(z => z.Field).ThenInclude(f => f.Farm).SingleAsync(z => z.Id == zoneId);
        var owner = await db.AppUsers.FirstAsync(u => u.Role == UserRole.FarmOwner && u.TenantId == zone.Field.Farm.TenantId);
        var tech = await db.AppUsers.FirstAsync(u => u.Role == UserRole.PlatformTechnician);
        var farmId = zone.Field.FarmId;
        var season = new PlantingSeason
        {
            ZoneId = zoneId, CropId = Crop, VarietyId = Variety, GrowthProfileId = SystemProfile, CurrentGrowthStageId = Stage1, Name = "Vụ lắp đặt",
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-30)), ExpectedEndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-5)), Status = PlantingSeasonStatus.Completed
        };
        var deployment = new DeploymentRequest { TenantId = zone.Field.Farm.TenantId, FarmId = farmId, ZoneId = zoneId, PlantingSeason = season, OwnerUserId = owner.Id, TechnicianUserId = tech.Id, Status = DeploymentRequestStatus.Completed, RequiredParametersCsv = "SoilMoisture" };
        var gateway = new Gateway { FarmId = farmId, DeploymentRequest = deployment, MacAddress = $"AA:BB:CC:DD:{Random.Shared.Next(10, 99)}:{Random.Shared.Next(10, 99)}", GatewaySerial = $"GP-{Guid.NewGuid():N}", FrequencyBand = "433MHz", FirmwareVersion = "v1", MqttClientId = $"gp-{Guid.NewGuid():N}", ClientCertificateFingerprint = new string('C', 64), Status = GatewayStatus.Online, LastSeenAtUtc = DateTime.UtcNow };
        var device = new Device { FarmId = farmId, Gateway = gateway, DeploymentRequest = deployment, ZoneId = zoneId, HardwareAddress = $"GP-{Guid.NewGuid():N}", DeviceType = DeviceType.ActuatorNode, Status = DeviceStatus.Online };
        var pump = new DeviceActuator { Device = device, ActuatorType = "WaterPump", RelayChannel = 1, MaxDurationMinutes = 30 };
        db.AddRange(season, deployment, gateway, device, pump);
        await db.SaveChangesAsync();
        return pump.Id;
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
