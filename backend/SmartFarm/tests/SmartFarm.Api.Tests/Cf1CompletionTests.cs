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

public sealed class Cf1CompletionTests
{
    private static readonly Guid Crop = Guid.Parse("10000000-0000-0000-0000-000000000001");
    private static readonly Guid Variety = Guid.Parse("10000000-0000-0000-0000-000000000002");
    private static readonly Guid Profile = Guid.Parse("10000000-0000-0000-0000-000000000003");
    private static async Task Login(HttpClient client, string email)
    {
        var response = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = "ValidPassword1!" });
        response.EnsureSuccessStatusCode();
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", json.RootElement.GetProperty("accessToken").GetString());
    }

    [Theory]
    [InlineData(DeploymentRequestStatus.Submitted)]
    [InlineData(DeploymentRequestStatus.Accepted)]
    [InlineData(DeploymentRequestStatus.Installing)]
    public async Task Empty_or_premature_deployment_cannot_complete(DeploymentRequestStatus status)
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        Guid id;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            var owner = await db.AppUsers.SingleAsync(x => x.Email == "owner-a@example.com");
            var tech = await db.AppUsers.SingleAsync(x => x.Email == "technician@example.com");
            var request = new DeploymentRequest { TenantId = owner.TenantId!.Value, OwnerUserId = owner.Id, FarmId = seed.FarmAId, ZoneId = seed.ZoneAId, TechnicianUserId = tech.Id, Status = status };
            db.DeploymentRequests.Add(request); await db.SaveChangesAsync(); id = request.Id;
        }
        using var client = factory.CreateClient(); await Login(client, "technician@example.com");
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsync($"/api/v1/platform/deployment-requests/{id}/complete", null)).StatusCode);
        using var verify = factory.Services.CreateScope();
        Assert.Equal(status, (await verify.ServiceProvider.GetRequiredService<SmartFarmDbContext>().DeploymentRequests.FindAsync(id))!.Status);
    }

    [Fact]
    public async Task Installation_requires_signed_contract_and_deposit()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync(); Guid id;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            var owner = await db.AppUsers.SingleAsync(x => x.Email == "owner-a@example.com");
            var tech = await db.AppUsers.SingleAsync(x => x.Email == "technician@example.com");
            var r = new DeploymentRequest { TenantId = owner.TenantId!.Value, OwnerUserId = owner.Id, FarmId = seed.FarmAId, ZoneId = seed.ZoneAId, TechnicianUserId = tech.Id, Status = DeploymentRequestStatus.PlanConfirmed };
            db.DeploymentRequests.Add(r); await db.SaveChangesAsync(); id = r.Id;
        }
        using var client = factory.CreateClient(); await Login(client, "technician@example.com");
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsync($"/api/v1/platform/deployment-requests/{id}/installation/start", null)).StatusCode);
    }

    [Fact]
    public async Task Creating_season_copies_profile_for_zone_and_submit_creates_dispatch_request()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        using var client = factory.CreateClient(); await Login(client, "owner-a@example.com");
        var created = await client.PostAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}/planting-seasons", new {
            name = "Vụ riêng", cropId = Crop, varietyId = Variety, growthProfileId = Profile,
            startDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1)), expectedEndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(60))
        });
        created.EnsureSuccessStatusCode();
        (await client.PostAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}/deployment-requests/submit", new {})).EnsureSuccessStatusCode();
        using var scope = factory.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        var zone = await db.Zones.FindAsync(seed.ZoneAId);
        var season = await db.PlantingSeasons.SingleAsync(x => x.ZoneId == seed.ZoneAId);
        Assert.NotEqual(Profile, season.GrowthProfileId);
        Assert.Equal(zone!.GrowthProfileId, season.GrowthProfileId);
        Assert.Equal(Profile, (await db.GrowthProfiles.FindAsync(season.GrowthProfileId))!.SourceProfileId);
        var deployment = await db.DeploymentRequests.SingleAsync(x => x.ZoneId == seed.ZoneAId);
        var service = await db.ServiceRequests.SingleAsync(x => x.DeploymentRequestId == deployment.Id);
        Assert.Equal(seed.ZoneAId, service.ZoneId); Assert.Equal("INSTALLATION", service.FailureCode);
    }

    [Fact]
    public async Task Planned_season_starts_only_in_its_own_zone_and_only_once()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync(); Guid id;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            var s = new PlantingSeason { ZoneId = seed.ZoneAId, CropId = Crop, VarietyId = Variety, GrowthProfileId = Profile,
                Name = "Planned", Status = PlantingSeasonStatus.Planned, StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1)), ExpectedEndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(60)) };
            db.PlantingSeasons.Add(s); await db.SaveChangesAsync(); id = s.Id;
        }
        using var client = factory.CreateClient(); await Login(client, "owner-a@example.com");
        Assert.Equal(HttpStatusCode.NotFound, (await client.PostAsync($"/api/v1/zones/{seed.ZoneBId}/planting-seasons/{id}/start", null)).StatusCode);
        (await client.PostAsync($"/api/v1/zones/{seed.ZoneAId}/planting-seasons/{id}/start", null)).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsync($"/api/v1/zones/{seed.ZoneAId}/planting-seasons/{id}/start", null)).StatusCode);
        (await client.GetAsync($"/api/v1/zones/{seed.ZoneAId}/iot-requirements")).EnsureSuccessStatusCode();
    }
}
