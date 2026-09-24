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

public sealed class FarmStructureTests
{
    [Fact]
    public async Task Owner_can_create_farm_field_zone_and_read_structure()
    {
        using var factory = new TestApplicationFactory();
        await factory.SeedAsync();
        using var client = factory.CreateClient();
        await AuthenticateAsync(client, "owner-a@example.com");

        var farmResponse = await client.PostAsJsonAsync("/api/v1/farms", new
        {
            name = "Map Farm",
            latitude = 11.95m,
            longitude = 108.44m,
            totalAreaM2 = 1200m,
            timeZone = "Asia/Ho_Chi_Minh"
        });
        Assert.Equal(HttpStatusCode.Created, farmResponse.StatusCode);
        var farmId = await ReadIdAsync(farmResponse, "farmId");

        var fieldResponse = await client.PostAsJsonAsync($"/api/v1/farms/{farmId}/fields", new
        {
            name = "North Field",
            areaM2 = 800m,
            soilType = "Basalt",
            boundaryGeoJson = Polygon(108.44m, 11.95m)
        });
        Assert.Equal(HttpStatusCode.Created, fieldResponse.StatusCode);
        var fieldId = await ReadIdAsync(fieldResponse, "fieldId");

        var zoneResponse = await client.PostAsJsonAsync($"/api/v1/fields/{fieldId}/zones", new
        {
            name = "Greenhouse A",
            areaM2 = 300m,
            zoneType = "Greenhouse",
            polygonGeoJson = Polygon(108.441m, 11.951m)
        });
        Assert.Equal(HttpStatusCode.Created, zoneResponse.StatusCode);

        var zonesResponse = await client.GetAsync($"/api/v1/fields/{fieldId}/zones");
        zonesResponse.EnsureSuccessStatusCode();

        var structure = await client.GetAsync($"/api/v1/farms/{farmId}/structure");
        structure.EnsureSuccessStatusCode();
        using var json = JsonDocument.Parse(await structure.Content.ReadAsStringAsync());
        Assert.True(json.RootElement.GetProperty("isReadyForIoT").GetBoolean());
        Assert.Single(json.RootElement.GetProperty("fields").EnumerateArray());
        Assert.Single(json.RootElement.GetProperty("fields")[0].GetProperty("zones").EnumerateArray());
        Assert.Equal(500m, json.RootElement.GetProperty("fields")[0].GetProperty("availableAreaM2").GetDecimal());
    }

    [Fact]
    public async Task Field_area_cannot_exceed_remaining_farm_area()
    {
        using var factory = new TestApplicationFactory();
        var seed = await factory.SeedAsync();
        using var client = factory.CreateClient();
        await AuthenticateAsync(client, "owner-a@example.com");

        var response = await client.PostAsJsonAsync($"/api/v1/farms/{seed.FarmAId}/fields", new
        {
            name = "Oversized Field",
            areaM2 = 600m,
            boundaryGeoJson = Polygon(108.44m, 11.95m)
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Zone_create_with_non_field_parent_returns_not_found()
    {
        using var factory = new TestApplicationFactory();
        var seed = await factory.SeedAsync();
        using var client = factory.CreateClient();
        await AuthenticateAsync(client, "owner-a@example.com");

        var response = await client.PostAsJsonAsync($"/api/v1/fields/{seed.FarmAId}/zones", new
        {
            name = "Wrong Parent Zone",
            areaM2 = 50m,
            zoneType = "OpenField",
            polygonGeoJson = Polygon(108.44m, 11.95m)
        });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Owner_cannot_access_farm_field_or_zone_from_another_tenant()
    {
        using var factory = new TestApplicationFactory();
        var seed = await factory.SeedAsync();
        using var client = factory.CreateClient();
        await AuthenticateAsync(client, "owner-a@example.com");

        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/v1/farms/{seed.FarmBId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/v1/fields/{seed.FieldBId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/v1/zones/{seed.ZoneBId}")).StatusCode);
    }

    [Fact]
    public async Task Operating_zone_rejects_area_change()
    {
        using var factory = new TestApplicationFactory();
        var seed = await factory.SeedAsync();
        using var client = factory.CreateClient();
        await AuthenticateAsync(client, "owner-a@example.com");

        var activate = await client.PutAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}", new
        {
            name = "Zone A",
            status = "Operating"
        });
        activate.EnsureSuccessStatusCode();

        var resize = await client.PutAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}", new
        {
            name = "Zone A",
            areaM2 = 90m
        });
        Assert.Equal(HttpStatusCode.Conflict, resize.StatusCode);
    }

    [Fact]
    public async Task Archiving_zone_preserves_row_and_restores_field_area()
    {
        using var factory = new TestApplicationFactory();
        var seed = await factory.SeedAsync();
        using var client = factory.CreateClient();
        await AuthenticateAsync(client, "owner-a@example.com");

        var response = await client.DeleteAsync($"/api/v1/zones/{seed.ZoneAId}");
        response.EnsureSuccessStatusCode();

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        var zone = await db.Zones.SingleAsync(x => x.Id == seed.ZoneAId);
        var field = await db.Fields.SingleAsync(x => x.Id == seed.FieldAId);
        Assert.Equal(ZoneStatus.Archived, zone.Status);
        Assert.NotNull(zone.ArchivedAtUtc);
        Assert.Equal(500m, field.AvailableAreaM2);
    }

    private static async Task AuthenticateAsync(HttpClient client, string email)
    {
        var response = await client.PostAsJsonAsync("/api/v1/auth/login", new
        {
            email,
            password = "ValidPassword1!"
        });
        response.EnsureSuccessStatusCode();
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer", json.RootElement.GetProperty("accessToken").GetString());
    }

    private static async Task<Guid> ReadIdAsync(HttpResponseMessage response, string property)
    {
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return json.RootElement.GetProperty(property).GetGuid();
    }

    private static object Polygon(decimal longitude, decimal latitude) => new
    {
        type = "Polygon",
        coordinates = new[]
        {
            new[]
            {
                new[] { longitude, latitude },
                new[] { longitude + 0.001m, latitude },
                new[] { longitude + 0.001m, latitude + 0.001m },
                new[] { longitude, latitude }
            }
        }
    };
}
