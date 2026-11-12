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

/// <summary>Zone gắn trực tiếp Growth Profile (không tạo vụ mùa) và lịch tưới thuộc profile theo giai đoạn.</summary>
public sealed class ZoneGrowthProfileTests
{
    private static readonly Guid Crop = Guid.Parse("10000000-0000-0000-0000-000000000001");
    private static readonly Guid Variety = Guid.Parse("10000000-0000-0000-0000-000000000002");
    private static readonly Guid SystemProfile = Guid.Parse("10000000-0000-0000-0000-000000000003");
    private static readonly Guid Stage1 = Guid.Parse("10000000-0000-0000-0000-000000000004");
    private static readonly Guid Stage2 = Guid.Parse("10000000-0000-0000-0000-000000000005");

    private const string CropPlan =
        """{"repeatType":"DAILY","sessions":[{"title":"Sáng","startTime":"06:00","durationMinutes":8,"enabled":true},{"title":"Chiều","startTime":"16:30","durationMinutes":6,"enabled":true}]}""";

    // ── Zone ↔ profile ──

    [Fact]
    public async Task Owner_attaches_a_system_profile_to_a_zone_without_creating_a_season()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        using var owner = factory.CreateClient(); await LoginAsync(owner, "owner-a@example.com");

        var response = await owner.PutAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}", new { name = "Zone A", growthProfileId = SystemProfile });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(SystemProfile, json.RootElement.GetProperty("growthProfileId").GetGuid());
        Assert.True(json.RootElement.GetProperty("growthProfileIsSystemDefined").GetBoolean());
        Assert.Equal(Crop, json.RootElement.GetProperty("cropId").GetGuid());
        Assert.Equal(Variety, json.RootElement.GetProperty("varietyId").GetGuid());
        using var scope = factory.Services.CreateScope();
        Assert.Equal(0, await scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>().PlantingSeasons.CountAsync());
    }

    [Fact]
    public async Task Attached_profile_is_returned_by_get_and_list_after_reload()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        using var owner = factory.CreateClient(); await LoginAsync(owner, "owner-a@example.com");
        await owner.PutAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}", new { name = "Zone A", growthProfileId = SystemProfile });

        var one = JsonDocument.Parse(await (await owner.GetAsync($"/api/v1/zones/{seed.ZoneAId}")).Content.ReadAsStringAsync());
        Assert.Equal(SystemProfile, one.RootElement.GetProperty("growthProfileId").GetGuid());
        var list = JsonDocument.Parse(await (await owner.GetAsync($"/api/v1/fields/{seed.FieldAId}/zones")).Content.ReadAsStringAsync());
        Assert.Equal(SystemProfile, list.RootElement.EnumerateArray().Single(z => z.GetProperty("zoneId").GetGuid() == seed.ZoneAId).GetProperty("growthProfileId").GetGuid());
        var all = JsonDocument.Parse(await (await owner.GetAsync("/api/v1/zones")).Content.ReadAsStringAsync());
        Assert.Equal(SystemProfile, all.RootElement.EnumerateArray().Single(z => z.GetProperty("zoneId").GetGuid() == seed.ZoneAId).GetProperty("growthProfileId").GetGuid());
    }

    [Fact]
    public async Task Zone_without_profile_still_opens_and_has_null_profile()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        using var owner = factory.CreateClient(); await LoginAsync(owner, "owner-a@example.com");

        var json = JsonDocument.Parse(await (await owner.GetAsync($"/api/v1/zones/{seed.ZoneAId}")).Content.ReadAsStringAsync());

        Assert.Equal(JsonValueKind.Null, json.RootElement.GetProperty("growthProfileId").ValueKind);
    }

    [Fact]
    public async Task Update_without_profile_field_keeps_the_attached_profile_and_clear_removes_it()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        using var owner = factory.CreateClient(); await LoginAsync(owner, "owner-a@example.com");
        await owner.PutAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}", new { name = "Zone A", growthProfileId = SystemProfile });

        var rename = await owner.PutAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}", new { name = "Zone A đổi tên" });
        Assert.Equal(SystemProfile, JsonDocument.Parse(await rename.Content.ReadAsStringAsync()).RootElement.GetProperty("growthProfileId").GetGuid());

        var clear = await owner.PutAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}", new { name = "Zone A đổi tên", clearGrowthProfile = true });
        var cleared = JsonDocument.Parse(await clear.Content.ReadAsStringAsync()).RootElement;
        Assert.Equal(JsonValueKind.Null, cleared.GetProperty("growthProfileId").ValueKind);
        Assert.Equal(Crop, cleared.GetProperty("cropId").GetGuid());
    }

    [Fact]
    public async Task Attach_and_clear_in_one_request_is_rejected()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        using var owner = factory.CreateClient(); await LoginAsync(owner, "owner-a@example.com");

        var response = await owner.PutAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}", new { name = "Zone A", growthProfileId = SystemProfile, clearGrowthProfile = true });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Profile_of_another_tenant_cannot_be_attached()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        using var ownerB = factory.CreateClient(); await LoginAsync(ownerB, "owner-b@example.com");
        var copy = await ownerB.PostAsJsonAsync("/api/v1/growth-profiles", new { cropId = Crop, varietyId = Variety, name = "Bản của B", sourceProfileId = SystemProfile, isDefault = false });
        var copyId = JsonDocument.Parse(await copy.Content.ReadAsStringAsync()).RootElement.GetProperty("profileId").GetGuid();
        using var ownerA = factory.CreateClient(); await LoginAsync(ownerA, "owner-a@example.com");

        var response = await ownerA.PutAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}", new { name = "Zone A", growthProfileId = copyId });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var scope = factory.Services.CreateScope();
        Assert.Null((await scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>().Zones.AsNoTracking().SingleAsync(z => z.Id == seed.ZoneAId)).GrowthProfileId);
    }

    [Fact]
    public async Task Own_copy_can_be_attached_and_unknown_profile_is_rejected()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        using var owner = factory.CreateClient(); await LoginAsync(owner, "owner-a@example.com");
        var copy = await owner.PostAsJsonAsync("/api/v1/growth-profiles", new { cropId = Crop, varietyId = Variety, name = "Bản của A", sourceProfileId = SystemProfile, isDefault = false });
        var copyId = JsonDocument.Parse(await copy.Content.ReadAsStringAsync()).RootElement.GetProperty("profileId").GetGuid();

        var ok = await owner.PutAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}", new { name = "Zone A", growthProfileId = copyId });
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        var view = JsonDocument.Parse(await ok.Content.ReadAsStringAsync()).RootElement;
        Assert.False(view.GetProperty("growthProfileIsSystemDefined").GetBoolean());

        var unknown = await owner.PutAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}", new { name = "Zone A", growthProfileId = Guid.NewGuid() });
        Assert.Equal(HttpStatusCode.BadRequest, unknown.StatusCode);
    }

    [Fact]
    public async Task Attaching_a_profile_of_another_crop_sets_the_zone_crop_from_the_profile()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        var other = await AddCropWithProfileAsync(factory, "Cây khác");
        using var owner = factory.CreateClient(); await LoginAsync(owner, "owner-a@example.com");
        var response = await owner.PutAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}", new { name = "Zone A", growthProfileId = other.ProfileId });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var view = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
        Assert.Equal(other.CropId, view.GetProperty("cropId").GetGuid());
    }

    [Fact]
    public async Task Switching_to_a_profile_of_another_crop_is_blocked_while_a_season_is_in_progress_and_season_profile_is_untouched()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        var other = await AddCropWithProfileAsync(factory, "Cây khác");
        await AddInProgressSeasonAsync(factory, seed.ZoneAId);
        using var owner = factory.CreateClient(); await LoginAsync(owner, "owner-a@example.com");

        var response = await owner.PutAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}", new { name = "Zone A", growthProfileId = other.ProfileId });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        using var scope = factory.Services.CreateScope();
        var season = await scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>().PlantingSeasons.AsNoTracking().SingleAsync();
        Assert.Equal(SystemProfile, season.GrowthProfileId);
    }

    [Fact]
    public async Task Changing_zone_profile_within_the_same_crop_does_not_change_the_running_season()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        await AddInProgressSeasonAsync(factory, seed.ZoneAId);
        using var owner = factory.CreateClient(); await LoginAsync(owner, "owner-a@example.com");
        var copy = await owner.PostAsJsonAsync("/api/v1/growth-profiles", new { cropId = Crop, varietyId = Variety, name = "Bản mới", sourceProfileId = SystemProfile, isDefault = false });
        var copyId = JsonDocument.Parse(await copy.Content.ReadAsStringAsync()).RootElement.GetProperty("profileId").GetGuid();

        var response = await owner.PutAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}", new { name = "Zone A", growthProfileId = copyId });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        Assert.Equal(copyId, (await db.Zones.AsNoTracking().SingleAsync(z => z.Id == seed.ZoneAId)).GrowthProfileId);
        Assert.Equal(SystemProfile, (await db.PlantingSeasons.AsNoTracking().SingleAsync()).GrowthProfileId);
        Assert.Equal(1, await db.PlantingSeasons.CountAsync());
    }

    [Fact]
    public async Task Farmer_and_other_tenant_owner_cannot_attach_a_profile()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        using var farmer = factory.CreateClient(); await LoginAsync(farmer, "farmer-b@example.com");
        using var ownerB = factory.CreateClient(); await LoginAsync(ownerB, "owner-b@example.com");

        Assert.Equal(HttpStatusCode.Forbidden, (await farmer.PutAsJsonAsync($"/api/v1/zones/{seed.ZoneBId}", new { name = "Zone B", growthProfileId = SystemProfile })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await ownerB.PutAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}", new { name = "Zone A", growthProfileId = SystemProfile })).StatusCode);
    }

    // ── Lịch tưới của profile ──

    [Fact]
    public async Task System_profile_shows_crop_sample_schedule_read_only_and_never_writes_to_the_crop()
    {
        using var factory = new TestApplicationFactory(); await factory.SeedAsync();
        await SetCropPlanAsync(factory, CropPlan);
        using var owner = factory.CreateClient(); await LoginAsync(owner, "owner-a@example.com");

        var view = JsonDocument.Parse(await (await owner.GetAsync($"/api/v1/growth-profiles/{SystemProfile}/irrigation-schedule")).Content.ReadAsStringAsync()).RootElement;

        Assert.False(view.GetProperty("isEditable").GetBoolean());
        Assert.Equal("DAILY", view.GetProperty("repeatType").GetString());
        var stage = view.GetProperty("stages")[0];
        Assert.Equal("Crop", stage.GetProperty("source").GetString());
        Assert.Equal("06:00", stage.GetProperty("sessions")[0].GetProperty("startTime").GetString());
        Assert.Equal(480, stage.GetProperty("sessions")[0].GetProperty("durationSeconds").GetInt32());
    }

    [Fact]
    public async Task System_profile_without_any_sample_has_none_source()
    {
        using var factory = new TestApplicationFactory(); await factory.SeedAsync();
        using var owner = factory.CreateClient(); await LoginAsync(owner, "owner-a@example.com");

        var view = JsonDocument.Parse(await (await owner.GetAsync($"/api/v1/growth-profiles/{SystemProfile}/irrigation-schedule")).Content.ReadAsStringAsync()).RootElement;

        Assert.Equal("None", view.GetProperty("stages")[0].GetProperty("source").GetString());
        Assert.Equal(0, view.GetProperty("stages")[0].GetProperty("sessions").GetArrayLength());
    }

    [Fact]
    public async Task Cloning_a_system_profile_clones_its_schedule_or_materializes_the_crop_sample()
    {
        using var factory = new TestApplicationFactory(); await factory.SeedAsync();
        await SetCropPlanAsync(factory, CropPlan);
        using var owner = factory.CreateClient(); await LoginAsync(owner, "owner-a@example.com");

        var copyId = await CloneAsync(owner, "Bản có lịch");
        var view = JsonDocument.Parse(await (await owner.GetAsync($"/api/v1/growth-profiles/{copyId}/irrigation-schedule")).Content.ReadAsStringAsync()).RootElement;

        Assert.True(view.GetProperty("isEditable").GetBoolean());
        foreach (var stage in view.GetProperty("stages").EnumerateArray())
        {
            Assert.Equal("Profile", stage.GetProperty("source").GetString());
            Assert.Equal(2, stage.GetProperty("sessions").GetArrayLength());
        }
        // Crop không bị sửa bởi việc sao chép.
        using var scope = factory.Services.CreateScope();
        Assert.Equal(CropPlan, (await scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>().Crops.AsNoTracking().SingleAsync(c => c.Id == Crop)).CalendarIrrigationPlan);
    }

    [Fact]
    public async Task Owner_edits_own_copy_schedule_and_it_reloads_from_the_backend_without_touching_crop_or_system_profile()
    {
        using var factory = new TestApplicationFactory(); await factory.SeedAsync();
        await SetCropPlanAsync(factory, CropPlan);
        using var owner = factory.CreateClient(); await LoginAsync(owner, "owner-a@example.com");
        var copyId = await CloneAsync(owner, "Bản chỉnh lịch");
        var stageId = await FirstStageIdAsync(owner, copyId);

        var put = await owner.PutAsJsonAsync($"/api/v1/growth-profiles/{copyId}/irrigation-schedule", new
        {
            stages = new[] { new { stageId, sessions = new object[] {
                new { title = "Tưới đêm", startTime = "21:15", durationSeconds = 300, enabled = true, method = "Nhỏ giọt", waterPerPlantMl = 150 },
                new { title = "Tưới sớm", startTime = "05:30", durationSeconds = 600, enabled = false } } } }
        });

        Assert.Equal(HttpStatusCode.OK, put.StatusCode);
        var reload = JsonDocument.Parse(await (await owner.GetAsync($"/api/v1/growth-profiles/{copyId}/irrigation-schedule")).Content.ReadAsStringAsync()).RootElement;
        var edited = reload.GetProperty("stages").EnumerateArray().Single(s => s.GetProperty("stageId").GetGuid() == stageId);
        var sessions = edited.GetProperty("sessions").EnumerateArray().ToList();
        Assert.Equal(2, sessions.Count);
        Assert.Equal("21:15", sessions[0].GetProperty("startTime").GetString());
        Assert.Equal(300, sessions[0].GetProperty("durationSeconds").GetInt32());
        Assert.Equal("Nhỏ giọt", sessions[0].GetProperty("method").GetString());
        Assert.Equal(150, sessions[0].GetProperty("waterPerPlantMl").GetInt32());
        Assert.False(sessions[1].GetProperty("enabled").GetBoolean());
        // Giai đoạn không liệt kê giữ nguyên lịch đã sao chép.
        var other = reload.GetProperty("stages").EnumerateArray().Single(s => s.GetProperty("stageId").GetGuid() != stageId);
        Assert.Equal("06:00", other.GetProperty("sessions")[0].GetProperty("startTime").GetString());

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        Assert.Equal(CropPlan, (await db.Crops.AsNoTracking().SingleAsync(c => c.Id == Crop)).CalendarIrrigationPlan);
        Assert.Equal(0, await db.GrowthStageIrrigationSessions.CountAsync(x => x.GrowthStageId == Stage1 || x.GrowthStageId == Stage2));
    }

    [Fact]
    public async Task Owner_cannot_edit_system_profile_or_another_tenants_copy_schedule()
    {
        using var factory = new TestApplicationFactory(); await factory.SeedAsync();
        using var owner = factory.CreateClient(); await LoginAsync(owner, "owner-a@example.com");
        using var ownerB = factory.CreateClient(); await LoginAsync(ownerB, "owner-b@example.com");
        var copyOfB = await CloneAsync(ownerB, "Bản của B");
        var body = new { stages = new[] { new { stageId = Stage1, sessions = new object[] { new { title = "x", startTime = "06:00", durationSeconds = 60 } } } } };

        Assert.Equal(HttpStatusCode.NotFound, (await owner.PutAsJsonAsync($"/api/v1/growth-profiles/{SystemProfile}/irrigation-schedule", body)).StatusCode);
        var bStage = await FirstStageIdAsync(ownerB, copyOfB);
        var stolen = new { stages = new[] { new { stageId = bStage, sessions = new object[] { new { title = "x", startTime = "06:00", durationSeconds = 60 } } } } };
        Assert.Equal(HttpStatusCode.NotFound, (await owner.PutAsJsonAsync($"/api/v1/growth-profiles/{copyOfB}/irrigation-schedule", stolen)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await owner.GetAsync($"/api/v1/growth-profiles/{copyOfB}/irrigation-schedule")).StatusCode);
    }

    [Fact]
    public async Task Farmer_cannot_edit_profile_schedule()
    {
        using var factory = new TestApplicationFactory(); await factory.SeedAsync();
        using var owner = factory.CreateClient(); await LoginAsync(owner, "owner-a@example.com");
        var copy = await CloneAsync(owner, "Bản A");
        var stageId = await FirstStageIdAsync(owner, copy);
        using var farmer = factory.CreateClient(); await LoginAsync(farmer, "farmer-b@example.com");

        var response = await farmer.PutAsJsonAsync($"/api/v1/growth-profiles/{copy}/irrigation-schedule", new { stages = new[] { new { stageId, sessions = Array.Empty<object>() } } });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Theory]
    [InlineData("25:00", 60, "invalid_time")]
    [InlineData("06:00", 1801, "too_long")]
    [InlineData("06:00", 0, "zero")]
    public async Task Invalid_sessions_are_rejected(string time, int seconds, string _)
    {
        using var factory = new TestApplicationFactory(); await factory.SeedAsync();
        using var owner = factory.CreateClient(); await LoginAsync(owner, "owner-a@example.com");
        var copy = await CloneAsync(owner, "Bản A");
        var stageId = await FirstStageIdAsync(owner, copy);

        var response = await owner.PutAsJsonAsync($"/api/v1/growth-profiles/{copy}/irrigation-schedule",
            new { stages = new[] { new { stageId, sessions = new object[] { new { title = "x", startTime = time, durationSeconds = seconds } } } } });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Duplicate_start_times_and_foreign_stages_are_rejected()
    {
        using var factory = new TestApplicationFactory(); await factory.SeedAsync();
        using var owner = factory.CreateClient(); await LoginAsync(owner, "owner-a@example.com");
        var copy = await CloneAsync(owner, "Bản A");
        var stageId = await FirstStageIdAsync(owner, copy);

        var dup = await owner.PutAsJsonAsync($"/api/v1/growth-profiles/{copy}/irrigation-schedule", new { stages = new[] { new { stageId, sessions = new object[] {
            new { title = "a", startTime = "06:00", durationSeconds = 60 }, new { title = "b", startTime = "06:00", durationSeconds = 60 } } } } });
        Assert.Equal(HttpStatusCode.BadRequest, dup.StatusCode);

        var foreign = await owner.PutAsJsonAsync($"/api/v1/growth-profiles/{copy}/irrigation-schedule", new { stages = new[] { new { stageId = Stage1, sessions = Array.Empty<object>() } } });
        Assert.Equal(HttpStatusCode.BadRequest, foreign.StatusCode);
    }

    // ── Đồng bộ lịch từ profile của Zone ──

    [Fact]
    public async Task Sync_requires_a_profile_on_the_zone()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        var pump = await AddPumpAsync(factory, seed.ZoneAId);
        using var owner = factory.CreateClient(); await LoginAsync(owner, "owner-a@example.com");

        var response = await owner.PostAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}/schedules/sync-from-profile", new { actuatorId = pump });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Contains("chưa gắn hồ sơ", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Sync_creates_control_schedules_from_the_profile_stage_of_the_zone_profile()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        var pump = await AddPumpAsync(factory, seed.ZoneAId);
        using var owner = factory.CreateClient(); await LoginAsync(owner, "owner-a@example.com");
        var copy = await CloneAsync(owner, "Bản có lịch riêng");
        var stageId = await FirstStageIdAsync(owner, copy);
        await owner.PutAsJsonAsync($"/api/v1/growth-profiles/{copy}/irrigation-schedule", new { stages = new[] { new { stageId, sessions = new object[] {
            new { title = "Tưới riêng", startTime = "05:45", durationSeconds = 420, enabled = true },
            new { title = "Tắt", startTime = "12:00", durationSeconds = 300, enabled = false } } } } });
        await owner.PutAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}", new { name = "Zone A", growthProfileId = copy });

        var response = await owner.PostAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}/schedules/sync-from-profile", new { actuatorId = pump, growthStageId = stageId });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
        Assert.Equal("Profile", json.GetProperty("source").GetString());
        Assert.Equal(copy, json.GetProperty("profileId").GetGuid());
        var schedule = Assert.Single(json.GetProperty("schedules").EnumerateArray());
        Assert.Equal("45 5 * * *", schedule.GetProperty("cronExpression").GetString());
        Assert.Equal(420, schedule.GetProperty("durationSeconds").GetInt32());
        using var scope = factory.Services.CreateScope();
        Assert.Equal(1, await scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>().ControlSchedules.CountAsync(x => x.ZoneId == seed.ZoneAId && x.Name.StartsWith("[AutoSync]")));
    }

    [Fact]
    public async Task Sync_falls_back_to_the_crop_sample_only_when_the_profile_stage_has_no_sessions_and_says_so()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        await SetCropPlanAsync(factory, CropPlan);
        var pump = await AddPumpAsync(factory, seed.ZoneAId);
        using var owner = factory.CreateClient(); await LoginAsync(owner, "owner-a@example.com");
        await owner.PutAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}", new { name = "Zone A", growthProfileId = SystemProfile });

        var response = await owner.PostAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}/schedules/sync-from-profile", new { actuatorId = pump });

        var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Crop", json.GetProperty("source").GetString());
        Assert.Equal(2, json.GetProperty("schedules").GetArrayLength());
    }

    [Fact]
    public async Task Sync_without_any_schedule_source_is_refused_instead_of_inventing_times()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        var pump = await AddPumpAsync(factory, seed.ZoneAId);
        using var owner = factory.CreateClient(); await LoginAsync(owner, "owner-a@example.com");
        await owner.PutAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}", new { name = "Zone A", growthProfileId = SystemProfile });

        var response = await owner.PostAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}/schedules/sync-from-profile", new { actuatorId = pump });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task Sync_rejects_an_actuator_of_another_zone_and_a_zone_without_actuator_and_other_roles()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        await SetCropPlanAsync(factory, CropPlan);
        var pumpB = await AddPumpAsync(factory, seed.ZoneBId);
        using var owner = factory.CreateClient(); await LoginAsync(owner, "owner-a@example.com");
        await owner.PutAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}", new { name = "Zone A", growthProfileId = SystemProfile });

        var foreignActuator = await owner.PostAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}/schedules/sync-from-profile", new { actuatorId = pumpB });
        Assert.Equal(HttpStatusCode.Conflict, foreignActuator.StatusCode);
        var none = await owner.PostAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}/schedules/sync-from-profile", new { actuatorId = Guid.Empty });
        Assert.Equal(HttpStatusCode.Conflict, none.StatusCode);
        Assert.Contains("chưa có thiết bị van hoặc máy bơm", await none.Content.ReadAsStringAsync());

        using var farmer = factory.CreateClient(); await LoginAsync(farmer, "farmer-b@example.com");
        Assert.Equal(HttpStatusCode.Forbidden, (await farmer.PostAsJsonAsync($"/api/v1/zones/{seed.ZoneBId}/schedules/sync-from-profile", new { actuatorId = pumpB })).StatusCode);
        using var ownerB = factory.CreateClient(); await LoginAsync(ownerB, "owner-b@example.com");
        var cross = await ownerB.PostAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}/schedules/sync-from-profile", new { actuatorId = pumpB });
        Assert.True(cross.StatusCode is HttpStatusCode.Forbidden or HttpStatusCode.NotFound, $"cross-tenant phải bị chặn, nhận {cross.StatusCode}");
    }

    // ── Hỗ trợ ──

    private static async Task<Guid> CloneAsync(HttpClient client, string name)
    {
        var response = await client.PostAsJsonAsync("/api/v1/growth-profiles", new { cropId = Crop, varietyId = Variety, name, sourceProfileId = SystemProfile, isDefault = false });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement.GetProperty("profileId").GetGuid();
    }

    private static async Task<Guid> FirstStageIdAsync(HttpClient client, Guid profileId)
    {
        var json = JsonDocument.Parse(await (await client.GetAsync($"/api/v1/growth-profiles/{profileId}/stages")).Content.ReadAsStringAsync());
        return json.RootElement[0].GetProperty("stageId").GetGuid();
    }

    private static async Task SetCropPlanAsync(TestApplicationFactory factory, string plan)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        (await db.Crops.SingleAsync(c => c.Id == Crop)).CalendarIrrigationPlan = plan;
        await db.SaveChangesAsync();
    }

    private static async Task<(Guid CropId, Guid ProfileId)> AddCropWithProfileAsync(TestApplicationFactory factory, string name)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        var crop = new Crop { Name = name, NormalizedName = name.ToUpperInvariant(), ScientificName = "Genus species", IsSystemDefined = true };
        var profile = new GrowthProfile { Crop = crop, Name = "Hồ sơ " + name, NormalizedName = ("HỒ SƠ " + name).ToUpperInvariant(), IsDefault = true, IsSystemDefined = true };
        profile.Stages.Add(new GrowthStage { Name = "GĐ 1", StageOrder = 1, DurationDays = 30 });
        db.AddRange(crop, profile);
        await db.SaveChangesAsync();
        return (crop.Id, profile.Id);
    }

    private static async Task AddInProgressSeasonAsync(TestApplicationFactory factory, Guid zoneId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        var zone = await db.Zones.SingleAsync(z => z.Id == zoneId);
        zone.CropId = Crop; zone.CropVarietyId = Variety;
        db.PlantingSeasons.Add(new PlantingSeason
        {
            ZoneId = zoneId, CropId = Crop, VarietyId = Variety, GrowthProfileId = SystemProfile, CurrentGrowthStageId = Stage1, Name = "Vụ đang chạy",
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-5)), ExpectedEndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(60)), Status = PlantingSeasonStatus.InProgress
        });
        await db.SaveChangesAsync();
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
