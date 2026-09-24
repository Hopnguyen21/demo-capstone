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

public sealed class IoTDeploymentTests
{
    private static readonly Guid Crop = Guid.Parse("10000000-0000-0000-0000-000000000001");
    private static readonly Guid Variety = Guid.Parse("10000000-0000-0000-0000-000000000002");
    private static readonly Guid Profile = Guid.Parse("10000000-0000-0000-0000-000000000003");
    private static readonly Guid Model = Guid.Parse("20000000-0000-0000-0000-000000000001");

    [Fact]
    public async Task Requirements_and_recommendation_come_from_active_stage_and_zone_area()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync(); using var client = factory.CreateClient(); await Login(client, "owner-a@example.com"); await CreateSeason(client, seed.ZoneAId);
        var requirements = await client.GetAsync($"/api/v1/zones/{seed.ZoneAId}/iot-requirements"); requirements.EnsureSuccessStatusCode(); using var r = JsonDocument.Parse(await requirements.Content.ReadAsStringAsync()); Assert.Equal(4, r.RootElement.GetProperty("parameters").GetArrayLength());
        var recommendation = await client.PostAsync($"/api/v1/zones/{seed.ZoneAId}/device-recommendations", null); recommendation.EnsureSuccessStatusCode(); using var p = JsonDocument.Parse(await recommendation.Content.ReadAsStringAsync()); Assert.Equal(Model, p.RootElement[0].GetProperty("deviceModelId").GetGuid()); Assert.Equal(1, p.RootElement[0].GetProperty("quantity").GetInt32());
    }

    [Fact]
    public async Task Owner_and_technician_routes_enforce_roles()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync(); using var client = factory.CreateClient(); await Login(client, "owner-a@example.com"); await CreateSeason(client, seed.ZoneAId);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/v1/platform/deployment-requests")).StatusCode);
        await Login(client, "technician@example.com");
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}/deployment-requests", PlanBody())).StatusCode);
    }

    [Fact]
    public async Task Device_cannot_be_assigned_twice_or_to_wrong_zone()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync(); using var client = factory.CreateClient(); var setup = await PrepareInstallation(client, seed.ZoneAId, seed.FarmAId);
        var wrongZone = await client.PostAsJsonAsync($"/api/v1/zones/{seed.ZoneBId}/devices/{setup.DeviceId}/assign", new { installationNotes = "wrong tenant" }); Assert.Equal(HttpStatusCode.NotFound, wrongZone.StatusCode);
        var assigned = await client.PostAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}/devices/{setup.DeviceId}/assign", new { installationNotes = "north west", gpsLatitude = 11.95m, gpsLongitude = 108.44m }); assigned.EnsureSuccessStatusCode();
        var duplicate = await client.PostAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}/devices/{setup.DeviceId}/assign", new { installationNotes = "again" }); Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);
    }

    [Fact]
    public async Task Failed_deployment_creates_maintenance_handoff_and_marks_device()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync(); using var client = factory.CreateClient(); var setup = await PrepareInstallation(client, seed.ZoneAId, seed.FarmAId); await client.PostAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}/devices/{setup.DeviceId}/assign", new { installationNotes = "installed" });
        var test = await client.PostAsJsonAsync($"/api/v1/platform/deployment-requests/{setup.RequestId}/connection-tests", new { deviceId = setup.DeviceId, succeeded = false, observedAtUtc = DateTime.UtcNow, errorCode = "NO_ACK", errorMessage = "No LoRa acknowledgement" }); test.EnsureSuccessStatusCode();
        var failed = await client.PostAsJsonAsync($"/api/v1/platform/deployment-requests/{setup.RequestId}/fail", new { failureCode = "INSTALL_NO_ACK", description = "Device failed connectivity check", deviceId = setup.DeviceId }); failed.EnsureSuccessStatusCode();
        using var scope = factory.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>(); Assert.Equal(DeploymentRequestStatus.MaintenanceRequired, (await db.DeploymentRequests.SingleAsync(x => x.Id == setup.RequestId)).Status); Assert.Equal(DeviceStatus.MaintenanceRequired, (await db.Devices.SingleAsync(x => x.Id == setup.DeviceId)).Status); Assert.Equal(ServiceRequestStatus.Open, (await db.ServiceRequests.SingleAsync(x => x.DeploymentRequestId == setup.RequestId)).Status);
    }

    [Fact]
    public async Task Successful_installation_configuration_connection_test_and_completion_are_audited()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync(); using var client = factory.CreateClient(); var setup = await PrepareInstallation(client, seed.ZoneAId, seed.FarmAId);
        var configured = await client.PutAsJsonAsync($"/api/v1/devices/{setup.DeviceId}/sensors", new { sensors = new[] { new { sensorType = "SoilMoisture", pin = "A0", unit = "%", minValue = 0, maxValue = 100, samplingIntervalSec = 60 } } }); configured.EnsureSuccessStatusCode();
        (await client.PostAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}/devices/{setup.DeviceId}/assign", new { installationNotes = "installed" })).EnsureSuccessStatusCode();
        (await client.PostAsJsonAsync($"/api/v1/platform/deployment-requests/{setup.RequestId}/connection-tests", new { deviceId = setup.DeviceId, succeeded = true, observedAtUtc = DateTime.UtcNow, rssi = -68m, snr = 9.2m, roundTripLatencyMs = 85 })).EnsureSuccessStatusCode();
        var completed = await client.PostAsync($"/api/v1/platform/deployment-requests/{setup.RequestId}/complete", null); completed.EnsureSuccessStatusCode(); using var json = JsonDocument.Parse(await completed.Content.ReadAsStringAsync()); Assert.Equal("Completed", json.RootElement.GetProperty("status").GetString()); Assert.True(json.RootElement.GetProperty("decisionHistory").GetArrayLength() >= 8);
    }

    [Fact]
    public async Task Owner_cannot_read_another_tenants_deployment_request()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync(); using var client = factory.CreateClient(); await Login(client, "owner-a@example.com"); await CreateSeason(client, seed.ZoneAId); var create = await client.PostAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}/deployment-requests", PlanBody()); create.EnsureSuccessStatusCode(); var id = await Id(create, "requestId"); await Login(client, "owner-b@example.com"); Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/v1/deployment-requests/{id}")).StatusCode);
    }

    private static async Task<Setup> PrepareInstallation(HttpClient client, Guid zoneId, Guid farmId)
    {
        await Login(client, "owner-a@example.com"); await CreateSeason(client, zoneId); var create = await client.PostAsJsonAsync($"/api/v1/zones/{zoneId}/deployment-requests", PlanBody()); create.EnsureSuccessStatusCode(); var requestId = await Id(create, "requestId"); (await client.PostAsync($"/api/v1/deployment-requests/{requestId}/submit", null)).EnsureSuccessStatusCode(); await Login(client, "technician@example.com"); (await client.PostAsync($"/api/v1/platform/deployment-requests/{requestId}/accept", null)).EnsureSuccessStatusCode(); (await client.PostAsJsonAsync($"/api/v1/platform/deployment-requests/{requestId}/survey", new { isFeasible = true, siteConditions = "Power and mounting available", notes = "Plan is feasible" })).EnsureSuccessStatusCode(); (await client.PostAsync($"/api/v1/platform/deployment-requests/{requestId}/confirm", null)).EnsureSuccessStatusCode(); (await client.PostAsync($"/api/v1/platform/deployment-requests/{requestId}/installation/start", null)).EnsureSuccessStatusCode();
        var gateway = await client.PostAsJsonAsync("/api/v1/gateways", new { deploymentRequestId = requestId, farmId, macAddress = "94:B9:7E:11:22:33", gatewaySerial = $"GW-{requestId:N}", frequencyBand = "433MHz", firmwareVersion = "v1.0.0", mqttClientId = $"gw-{requestId:N}", clientCertificateFingerprint = $"{requestId:N}{requestId:N}" }); gateway.EnsureSuccessStatusCode(); var gatewayId = await Id(gateway, "gatewayId");
        var provision = await client.PostAsJsonAsync("/api/v1/devices/provision", new { deploymentRequestId = requestId, gatewayId, farmId, nodes = new[] { new { hardwareAddress = $"NODE-{requestId:N}", deviceType = "SensorNode", deviceModelId = Model } } }); provision.EnsureSuccessStatusCode(); using var json = JsonDocument.Parse(await provision.Content.ReadAsStringAsync()); return new(requestId, json.RootElement.GetProperty("devices")[0].GetProperty("deviceId").GetGuid());
    }
    private static object PlanBody() => new { items = new[] { new { deviceModelId = Model, quantity = 1, installationNotes = "one node" } }, notes = "Owner approved" };
    private static async Task CreateSeason(HttpClient client, Guid zoneId) { var response = await client.PostAsJsonAsync($"/api/v1/zones/{zoneId}/planting-seasons", new { cropId = Crop, varietyId = Variety, growthProfileId = Profile, name = $"IoT-{Guid.NewGuid():N}", startDate = "2026-09-24", expectedEndDate = "2026-12-01" }); response.EnsureSuccessStatusCode(); }
    private static async Task Login(HttpClient client, string email) { client.DefaultRequestHeaders.Authorization = null; var response = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = "ValidPassword1!" }); response.EnsureSuccessStatusCode(); using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync()); client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", json.RootElement.GetProperty("accessToken").GetString()); }
    private static async Task<Guid> Id(HttpResponseMessage response, string name) { using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync()); return json.RootElement.GetProperty(name).GetGuid(); }
    private sealed record Setup(Guid RequestId, Guid DeviceId);
}
