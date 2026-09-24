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
    public async Task Updating_system_stage_clones_profile_instead_of_mutating_system_default()
    {
        using var factory = new TestApplicationFactory(); await factory.SeedAsync();
        using var client = factory.CreateClient(); await AuthenticateAsync(client, "owner-a@example.com");
        var response = await client.PutAsJsonAsync($"/api/v1/growth-stages/{VegetativeStage}/requirements", new { requirements = new[] { Requirement("Temperature", 22m, 31m, 26m, "C") } });
        response.EnsureSuccessStatusCode(); using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.True(json.RootElement.GetProperty("clonedFromSystem").GetBoolean());
        Assert.NotEqual(SystemProfile, json.RootElement.GetProperty("effectiveProfileId").GetGuid());
        using var scope = factory.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        Assert.Equal(21m, (await db.EnvironmentalRequirements.SingleAsync(x => x.GrowthStageId == VegetativeStage && x.ParameterCode == EnvironmentalParameterCode.Temperature)).MinValue);
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
        using var client = factory.CreateClient(); await AuthenticateAsync(client, "owner-a@example.com");
        var response = await client.PostAsJsonAsync("/api/v1/growth-profiles", new { cropId = SystemCrop, varietyId = SystemVariety, name = "Invalid", stages = new[] { new { name = "Bad", stageOrder = 2, durationDays = 10, requirements = new[] { Requirement("Temperature", 1m, 2m, 1.5m, "C") } } } });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private static object Requirement(string code, decimal min, decimal max, decimal target, string unit) => new { parameterCode = code, minValue = min, maxValue = max, targetValue = target, unit };
    private static Task<HttpResponseMessage> PostSeasonAsync(HttpClient client, Guid zoneId, string name) => client.PostAsJsonAsync($"/api/v1/zones/{zoneId}/planting-seasons", new { cropId = SystemCrop, varietyId = SystemVariety, growthProfileId = SystemProfile, name, startDate = "2026-09-24", expectedEndDate = "2026-12-01" });
    private static async Task<Guid> CreateSeasonAsync(HttpClient client, Guid zoneId, string name) { var response = await PostSeasonAsync(client, zoneId, name); response.EnsureSuccessStatusCode(); using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync()); return json.RootElement.GetProperty("seasonId").GetGuid(); }
    private static async Task AuthenticateAsync(HttpClient client, string email) { var response = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = "ValidPassword1!" }); response.EnsureSuccessStatusCode(); using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync()); client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", json.RootElement.GetProperty("accessToken").GetString()); }
}
