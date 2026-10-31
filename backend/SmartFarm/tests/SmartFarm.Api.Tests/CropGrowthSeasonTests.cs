using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;
using Xunit;

namespace SmartFarm.Api.Tests;

public sealed class CropGrowthSeasonTests
{
    private static readonly Guid SystemCrop = Guid.Parse("10000000-0000-0000-0000-000000000001");
    private static readonly Guid SystemVariety = Guid.Parse("10000000-0000-0000-0000-000000000002");
    private static readonly Guid SystemProfile = Guid.Parse("10000000-0000-0000-0000-000000000003");
    private static readonly Guid VegetativeStage = Guid.Parse("10000000-0000-0000-0000-000000000005");

    [Fact]
    public async Task System_default_profile_is_seeded_with_stages_and_four_core_thresholds()
    {
        using var factory = new TestApplicationFactory(); await factory.SeedAsync();
        using var client = factory.CreateClient(); await AuthenticateAsync(client, "owner-a@example.com");
        var response = await client.GetAsync($"/api/v1/growth-profiles/{SystemProfile}/stages");
        response.EnsureSuccessStatusCode(); using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(2, json.RootElement.GetArrayLength());
        Assert.Equal(4, json.RootElement[0].GetProperty("requirements").GetArrayLength());
    }

    [Fact]
    public async Task Owner_can_create_tenant_crop_and_duplicate_name_is_rejected()
    {
        using var factory = new TestApplicationFactory(); await factory.SeedAsync();
        using var client = factory.CreateClient(); await AuthenticateAsync(client, "owner-a@example.com");
        var body = new { name = "Dragon Fruit", scientificName = "Selenicereus undatus", description = "Tenant crop" };
        var created = await client.PostAsJsonAsync("/api/v1/crops", body); Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var duplicate = await client.PostAsJsonAsync("/api/v1/crops", body); Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);
    }

    [Fact]
    public async Task Owner_edit_of_a_system_stage_changes_only_the_tenant_copy_and_not_running_seasons()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        using var client = factory.CreateClient(); await AuthenticateAsync(client, "owner-a@example.com");
        Assert.Equal(HttpStatusCode.Created, (await PostSeasonAsync(client, seed.ZoneAId, "Vụ đang chạy")).StatusCode);

        var response = await client.PutAsJsonAsync($"/api/v1/growth-stages/{VegetativeStage}/requirements", new { requirements = new[] { Requirement("Temperature", 22m, 31m, 26m, "C") } });

        response.EnsureSuccessStatusCode();
        using var scope = factory.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        Assert.Equal(21m, (await db.EnvironmentalRequirements.SingleAsync(x => x.GrowthStageId == VegetativeStage && x.ParameterCode == EnvironmentalParameterCode.Temperature)).MinValue); // profile hệ thống không đổi
        Assert.True(await db.GrowthProfiles.AnyAsync(x => x.SourceProfileId == SystemProfile && x.TenantId != null)); // bản sao của trang trại
        var applied = await db.SeasonAppliedRequirements.Where(x => x.ParameterCode == EnvironmentalParameterCode.Temperature).Select(x => x.MinValue).ToListAsync();
        Assert.DoesNotContain(22m, applied); // vụ đang chạy giữ ngưỡng đã chụp
    }

    [Fact]
    public async Task Admin_updates_system_stage_requirements_in_place()
    {
        using var factory = new TestApplicationFactory(); await factory.SeedAsync();
        using var client = factory.CreateClient(); await AuthenticateAsync(client, "admin@example.com");
        var response = await client.PutAsJsonAsync($"/api/v1/growth-stages/{VegetativeStage}/requirements", new { requirements = new[] { Requirement("Temperature", 22m, 31m, 26m, "C") } });
        response.EnsureSuccessStatusCode(); using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.False(json.RootElement.GetProperty("clonedFromSystem").GetBoolean());
        Assert.Equal(SystemProfile, json.RootElement.GetProperty("effectiveProfileId").GetGuid());
    }

    [Fact]
    public async Task Wrong_profile_stage_is_rejected_and_stage_change_replaces_applied_thresholds()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        using var client = factory.CreateClient(); await AuthenticateAsync(client, "owner-a@example.com");
        var seasonId = await CreateSeasonAsync(client, seed.ZoneAId, "Season A");
        var wrong = await client.PutAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}/planting-seasons/{seasonId}/stage", new { growthStageId = Guid.NewGuid() });
        Assert.Equal(HttpStatusCode.BadRequest, wrong.StatusCode);
        var valid = await client.PutAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}/planting-seasons/{seasonId}/stage", new { growthStageId = VegetativeStage });
        valid.EnsureSuccessStatusCode(); using var json = JsonDocument.Parse(await valid.Content.ReadAsStringAsync());
        Assert.Equal(VegetativeStage, json.RootElement.GetProperty("currentGrowthStageId").GetGuid());
        Assert.Equal(21m, json.RootElement.GetProperty("appliedRequirements").EnumerateArray().Single(x => x.GetProperty("parameterCode").GetString() == "Temperature").GetProperty("minValue").GetDecimal());
    }

    [Fact]
    public async Task Zone_cannot_have_two_in_progress_seasons()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        using var client = factory.CreateClient(); await AuthenticateAsync(client, "owner-a@example.com");
        await CreateSeasonAsync(client, seed.ZoneAId, "First");
        var second = await PostSeasonAsync(client, seed.ZoneAId, "Second"); Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
    }

    [Fact]
    public async Task Owner_cannot_read_or_create_season_in_another_tenant_zone()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        using var client = factory.CreateClient(); await AuthenticateAsync(client, "owner-a@example.com");
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/v1/zones/{seed.ZoneBId}/planting-seasons")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await PostSeasonAsync(client, seed.ZoneBId, "Intrusion")).StatusCode);
    }

    [Fact]
    public async Task Profile_validation_rejects_missing_core_requirement_and_non_contiguous_stage_order()
    {
        using var factory = new TestApplicationFactory(); await factory.SeedAsync();
        using var client = factory.CreateClient(); await AuthenticateAsync(client, "admin@example.com");
        var response = await client.PostAsJsonAsync("/api/v1/growth-profiles", new { cropId = SystemCrop, varietyId = SystemVariety, name = "Invalid", stages = new[] { new { name = "Bad", stageOrder = 2, durationDays = 10, requirements = new[] { Requirement("Temperature", 1m, 2m, 1.5m, "C") } } } });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Owner_can_only_create_a_profile_by_copying_a_system_profile()
    {
        using var factory = new TestApplicationFactory(); await factory.SeedAsync();
        using var client = factory.CreateClient(); await AuthenticateAsync(client, "owner-a@example.com");
        var stage = new { name = "Seedling", stageOrder = 1, durationDays = 15, requirements = new[] { Requirement("Temperature", 20m, 26m, 23m, "C"), Requirement("SoilMoisture", 60m, 80m, 70m, "%"), Requirement("AirHumidity", 60m, 80m, 70m, "%"), Requirement("LightIntensity", 100m, 500m, 300m, "lux") } };

        var scratch = await client.PostAsJsonAsync("/api/v1/growth-profiles", new { cropId = SystemCrop, varietyId = SystemVariety, name = "Owner Profile", stages = new[] { stage } });
        Assert.Equal(HttpStatusCode.BadRequest, scratch.StatusCode);

        var copy = await client.PostAsJsonAsync("/api/v1/growth-profiles", new { cropId = SystemCrop, varietyId = SystemVariety, name = "Bản của trang trại", sourceProfileId = SystemProfile, isDefault = false });
        Assert.Equal(HttpStatusCode.Created, copy.StatusCode);
        using var scope = factory.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        var created = await db.GrowthProfiles.SingleAsync(x => x.Name == "Bản của trang trại");
        Assert.Equal(SystemProfile, created.SourceProfileId);
        Assert.NotNull(created.TenantId);
        Assert.False(created.IsSystemDefined);
    }

    [Fact]
    public async Task Owner_can_change_stage_days_on_their_copy_only()
    {
        using var factory = new TestApplicationFactory(); await factory.SeedAsync();
        using var owner = factory.CreateClient(); await AuthenticateAsync(owner, "owner-a@example.com");
        var copy = await owner.PostAsJsonAsync("/api/v1/growth-profiles", new { cropId = SystemCrop, varietyId = SystemVariety, name = "Bản ngày", sourceProfileId = SystemProfile, isDefault = false });
        var stages = JsonDocument.Parse(await copy.Content.ReadAsStringAsync()).RootElement.GetProperty("stages");
        var copyStage = stages[0].GetProperty("stageId").GetGuid();

        Assert.Equal(HttpStatusCode.OK, (await owner.PutAsJsonAsync($"/api/v1/growth-stages/{copyStage}", new { durationDays = 20 })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await owner.PutAsJsonAsync($"/api/v1/growth-stages/{copyStage}", new { durationDays = 0 })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await owner.PutAsJsonAsync($"/api/v1/growth-stages/{VegetativeStage}", new { durationDays = 20 })).StatusCode); // profile hệ thống
        using var scope = factory.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        Assert.Equal(20, (await db.GrowthStages.SingleAsync(x => x.Id == copyStage)).DurationDays);
    }

    [Fact]
    public async Task Owner_can_edit_their_own_copy_but_not_a_system_profile_or_another_tenants_copy()
    {
        using var factory = new TestApplicationFactory(); await factory.SeedAsync();
        using var owner = factory.CreateClient(); await AuthenticateAsync(owner, "owner-a@example.com");
        var copy = await owner.PostAsJsonAsync("/api/v1/growth-profiles", new { cropId = SystemCrop, varietyId = SystemVariety, name = "Bản A", sourceProfileId = SystemProfile, isDefault = false });
        var copyId = JsonDocument.Parse(await copy.Content.ReadAsStringAsync()).RootElement.GetProperty("profileId").GetGuid();

        Assert.Equal(HttpStatusCode.OK, (await owner.PutAsJsonAsync($"/api/v1/growth-profiles/{copyId}", new { name = "Bản A đổi tên", isDefault = false })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await owner.PutAsJsonAsync($"/api/v1/growth-profiles/{SystemProfile}", new { name = "Owner rename", isDefault = false })).StatusCode);

        using var other = factory.CreateClient(); await AuthenticateAsync(other, "owner-b@example.com");
        Assert.Equal(HttpStatusCode.NotFound, (await other.PutAsJsonAsync($"/api/v1/growth-profiles/{copyId}", new { name = "Trộm", isDefault = false })).StatusCode);
    }

    [Fact]
    public async Task Admin_can_update_profile_name_description_and_default()
    {
        using var factory = new TestApplicationFactory(); await factory.SeedAsync();
        using var client = factory.CreateClient(); await AuthenticateAsync(client, "admin@example.com");
        var stage = new { name = "Seedling", stageOrder = 1, durationDays = 20, requirements = new[] { Requirement("Temperature", 18m, 26m, 22m, "C"), Requirement("SoilMoisture", 60m, 80m, 70m, "%"), Requirement("AirHumidity", 60m, 80m, 70m, "%"), Requirement("Ph", 6m, 7m, 6.5m, "pH") } };
        var created = await client.PostAsJsonAsync("/api/v1/growth-profiles", new { cropId = SystemCrop, varietyId = SystemVariety, name = "Second Profile", stages = new[] { stage } });
        created.EnsureSuccessStatusCode();
        using var createdJson = JsonDocument.Parse(await created.Content.ReadAsStringAsync());
        var secondId = createdJson.RootElement.GetProperty("profileId").GetGuid();

        var response = await client.PutAsJsonAsync($"/api/v1/growth-profiles/{secondId}", new { name = "Renamed Profile", description = "Updated description", isDefault = true });

        response.EnsureSuccessStatusCode();
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("Renamed Profile", json.RootElement.GetProperty("name").GetString());
        Assert.Equal("Updated description", json.RootElement.GetProperty("description").GetString());
        Assert.True(json.RootElement.GetProperty("isDefault").GetBoolean());
        // Chỉ một hồ sơ mặc định cho mỗi cây/giống: hồ sơ hệ thống cũ không còn mặc định.
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        Assert.False((await db.GrowthProfiles.SingleAsync(x => x.Id == SystemProfile)).IsDefault);
    }

    [Fact]
    public async Task Profile_rename_rejects_a_duplicate_name_and_non_admins()
    {
        using var factory = new TestApplicationFactory(); await factory.SeedAsync();
        using var client = factory.CreateClient(); await AuthenticateAsync(client, "admin@example.com");
        var stage = new { name = "Seedling", stageOrder = 1, durationDays = 20, requirements = new[] { Requirement("Temperature", 18m, 26m, 22m, "C"), Requirement("SoilMoisture", 60m, 80m, 70m, "%"), Requirement("AirHumidity", 60m, 80m, 70m, "%"), Requirement("Ph", 6m, 7m, 6.5m, "pH") } };
        var created = await client.PostAsJsonAsync("/api/v1/growth-profiles", new { cropId = SystemCrop, varietyId = SystemVariety, name = "Second Profile", stages = new[] { stage } });
        using var createdJson = JsonDocument.Parse(await created.Content.ReadAsStringAsync());
        var secondId = createdJson.RootElement.GetProperty("profileId").GetGuid();
        using var systemJson = JsonDocument.Parse(await (await client.GetAsync($"/api/v1/crops/{SystemCrop}/growth-profiles")).Content.ReadAsStringAsync());
        var systemName = systemJson.RootElement.EnumerateArray().Single(p => p.GetProperty("profileId").GetGuid() == SystemProfile).GetProperty("name").GetString();

        var duplicate = await client.PutAsJsonAsync($"/api/v1/growth-profiles/{secondId}", new { name = systemName, isDefault = false });
        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);

        using var ownerClient = factory.CreateClient(); await AuthenticateAsync(ownerClient, "owner-a@example.com");
        var forbidden = await ownerClient.PutAsJsonAsync($"/api/v1/growth-profiles/{SystemProfile}", new { name = "Owner rename", isDefault = false });
        Assert.Equal(HttpStatusCode.NotFound, forbidden.StatusCode); // Owner không sửa được profile hệ thống
    }

    private static object Requirement(string code, decimal min, decimal max, decimal target, string unit) => new { parameterCode = code, minValue = min, maxValue = max, targetValue = target, unit };
    private static Task<HttpResponseMessage> PostSeasonAsync(HttpClient client, Guid zoneId, string name) => client.PostAsJsonAsync($"/api/v1/zones/{zoneId}/planting-seasons", new { cropId = SystemCrop, varietyId = SystemVariety, growthProfileId = SystemProfile, name, startDate = "2026-09-24", expectedEndDate = "2026-12-01" });
    private static async Task<Guid> CreateSeasonAsync(HttpClient client, Guid zoneId, string name) { var response = await PostSeasonAsync(client, zoneId, name); response.EnsureSuccessStatusCode(); using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync()); return json.RootElement.GetProperty("seasonId").GetGuid(); }
    private static async Task AuthenticateAsync(HttpClient client, string email) { var response = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = "ValidPassword1!" }); response.EnsureSuccessStatusCode(); using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync()); client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", json.RootElement.GetProperty("accessToken").GetString()); }
}
