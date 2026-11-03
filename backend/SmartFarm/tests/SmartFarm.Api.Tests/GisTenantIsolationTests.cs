using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SmartFarm.Infrastructure.Persistence;
using Xunit;

namespace SmartFarm.Api.Tests;

public sealed class GisTenantIsolationTests
{
    [Fact]
    public async Task Owner_cannot_read_or_move_nodes_of_another_tenants_zone()
    {
        using var factory = new TestApplicationFactory();
        var seed = await factory.SeedAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, "owner-a@example.com");

        var read = await client.GetAsync($"/api/v1/zones/{seed.ZoneBId}/devices/map-locations");
        var write = await client.PutAsJsonAsync($"/api/v1/zones/{seed.ZoneBId}/devices/bulk-locations", new
        {
            nodes = new[] { new { deviceId = Guid.NewGuid(), latitude = 10.5m, longitude = 106.5m, hardwareAddress = "INTRUDER-NODE-01", deviceType = "SensorNode" } }
        });

        Assert.Equal(HttpStatusCode.NotFound, read.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, write.StatusCode);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        Assert.False(await db.Devices.AnyAsync(d => d.HardwareAddress == "INTRUDER-NODE-01"));
    }

    [Fact]
    public async Task Owner_can_read_the_map_of_their_own_zone()
    {
        using var factory = new TestApplicationFactory();
        var seed = await factory.SeedAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, "owner-a@example.com");

        var read = await client.GetAsync($"/api/v1/zones/{seed.ZoneAId}/devices/map-locations");

        Assert.Equal(HttpStatusCode.OK, read.StatusCode);
    }

    [Fact]
    public async Task Service_request_cannot_be_created_on_another_tenants_zone()
    {
        using var factory = new TestApplicationFactory();
        var seed = await factory.SeedAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, "owner-a@example.com");

        var response = await client.PostAsJsonAsync($"/api/v1/farms/{seed.FarmAId}/service-requests", new
        {
            zoneId = seed.ZoneBId, requestType = "Repair", title = "Cross tenant", description = "Should stay inside tenant A"
        });

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        Assert.False(await db.ServiceRequests.AnyAsync(r => r.ZoneId == seed.ZoneBId));
        Assert.True(response.StatusCode is HttpStatusCode.Created or HttpStatusCode.BadRequest or HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Owner_cannot_read_weather_of_another_tenants_farm()
    {
        using var factory = new TestApplicationFactory();
        var seed = await factory.SeedAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, "owner-a@example.com");

        var response = await client.GetAsync($"/api/v1/farms/{seed.FarmBId}/weather");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private static async Task LoginAsync(HttpClient client, string email)
    {
        var response = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = "ValidPassword1!" });
        response.EnsureSuccessStatusCode();
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", json.RootElement.GetProperty("accessToken").GetString());
    }
}
