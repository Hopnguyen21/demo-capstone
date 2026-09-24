using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SmartFarm.Application.Common.Exceptions;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Application.Features.TelemetryAlerts;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;
using Xunit;

namespace SmartFarm.Api.Tests;

public sealed class TelemetryAlertTests
{
    private static readonly JsonSerializerOptions ApiJson = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };
    private static readonly Guid Crop = Guid.Parse("10000000-0000-0000-0000-000000000001");
    private static readonly Guid Variety = Guid.Parse("10000000-0000-0000-0000-000000000002");
    private static readonly Guid Profile = Guid.Parse("10000000-0000-0000-0000-000000000003");
    private static readonly Guid VegetativeStage = Guid.Parse("10000000-0000-0000-0000-000000000005");

    [Fact]
    public async Task Adapter_rejects_untrusted_gateway_and_invalid_payload()
    {
        using var factory = new TestApplicationFactory(); var fixture = await PrepareAsync(factory);
        await Assert.ThrowsAsync<AuthenticationException>(() => SendAsync(factory, fixture, "bad-cert", 70, "%", "bad-auth"));
        await Assert.ThrowsAsync<RequestValidationException>(() => SendAsync(factory, fixture, fixture.Fingerprint, 101, "%", "bad-value"));
        await Assert.ThrowsAsync<RequestValidationException>(() => SendAsync(factory, fixture, fixture.Fingerprint, 70, "C", "bad-unit"));
        using var scope = factory.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>(); Assert.Empty(await db.TelemetryReadings.ToListAsync());
    }

    [Fact]
    public async Task Duplicate_message_is_idempotent_and_does_not_advance_anti_flap()
    {
        using var factory = new TestApplicationFactory(); var fixture = await PrepareAsync(factory); var captured = DateTime.UtcNow.AddMinutes(-1);
        var first = await SendAsync(factory, fixture, fixture.Fingerprint, 10, "%", "same-message", captured);
        var duplicate = await SendAsync(factory, fixture, fixture.Fingerprint, 10, "%", "same-message", captured);
        Assert.False(first.IsDuplicate); Assert.True(duplicate.IsDuplicate); Assert.Equal(0, duplicate.StoredReadings);
        using var scope = factory.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>(); Assert.Single(await db.TelemetryReadings.ToListAsync()); Assert.Empty(await db.Alerts.ToListAsync());
    }

    [Fact]
    public async Task Two_consecutive_violations_create_one_alert_and_history_is_retained()
    {
        using var factory = new TestApplicationFactory(); var fixture = await PrepareAsync(factory); var captured = DateTime.UtcNow.AddMinutes(-1);
        Assert.Equal(0, (await SendAsync(factory, fixture, fixture.Fingerprint, 10, "%", "v1", captured)).AlertsCreated);
        Assert.Equal(1, (await SendAsync(factory, fixture, fixture.Fingerprint, 10, "%", "v2", captured.AddSeconds(1))).AlertsCreated);
        Assert.Equal(0, (await SendAsync(factory, fixture, fixture.Fingerprint, 10, "%", "v3", captured.AddSeconds(2))).AlertsCreated);

        using var client = factory.CreateClient(); await Login(client, "owner-a@example.com");
        var list = await client.GetFromJsonAsync<List<AlertView>>($"/api/v1/zones/{fixture.ZoneId}/alerts", ApiJson); var alert = Assert.Single(list!);
        var acknowledged = await client.PutAsJsonAsync($"/api/v1/alerts/{alert.AlertId}/acknowledge", new { notes = "Checked greenhouse" }); acknowledged.EnsureSuccessStatusCode();
        var resolved = await client.PutAsJsonAsync($"/api/v1/alerts/{alert.AlertId}/resolve", new { actionTaken = "Adjusted irrigation", notes = "Moisture recovered" }); resolved.EnsureSuccessStatusCode();
        var detail = await client.GetFromJsonAsync<AlertView>($"/api/v1/alerts/{alert.AlertId}", ApiJson); Assert.Equal(AlertStatus.Resolved, detail!.Status); Assert.Equal(3, detail.History.Count);
    }

    [Fact]
    public async Task Stage_transition_switches_the_applied_thresholds()
    {
        using var factory = new TestApplicationFactory(); var fixture = await PrepareAsync(factory); var captured = DateTime.UtcNow.AddMinutes(-1);
        await SendAsync(factory, fixture, fixture.Fingerprint, 29, "C", "seed-1", captured, EnvironmentalParameterCode.Temperature);
        Assert.Equal(1, (await SendAsync(factory, fixture, fixture.Fingerprint, 29, "C", "seed-2", captured.AddSeconds(1), EnvironmentalParameterCode.Temperature)).AlertsCreated);
        using var client = factory.CreateClient(); await Login(client, "owner-a@example.com");
        var alerts = await client.GetFromJsonAsync<List<AlertView>>($"/api/v1/zones/{fixture.ZoneId}/alerts", ApiJson);
        (await client.PutAsJsonAsync($"/api/v1/alerts/{alerts![0].AlertId}/resolve", new { actionTaken = "Confirmed stage change" })).EnsureSuccessStatusCode();
        (await client.PutAsJsonAsync($"/api/v1/zones/{fixture.ZoneId}/planting-seasons/{fixture.SeasonId}/stage", new { growthStageId = VegetativeStage, notes = "Vegetative started" })).EnsureSuccessStatusCode();
        Assert.Equal(0, (await SendAsync(factory, fixture, fixture.Fingerprint, 29, "C", "veg-1", captured.AddSeconds(2), EnvironmentalParameterCode.Temperature)).AlertsCreated);
        Assert.Equal(0, (await SendAsync(factory, fixture, fixture.Fingerprint, 29, "C", "veg-2", captured.AddSeconds(3), EnvironmentalParameterCode.Temperature)).AlertsCreated);
        using var scope = factory.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>(); Assert.Single(await db.Alerts.ToListAsync());
    }

    [Fact]
    public async Task Assigned_farmer_can_read_and_acknowledge_but_zone_assignment_is_enforced()
    {
        using var factory = new TestApplicationFactory(); var fixture = await PrepareAsync(factory); var captured = DateTime.UtcNow.AddMinutes(-1);
        await SendAsync(factory, fixture, fixture.Fingerprint, 10, "%", "farmer-1", captured); await SendAsync(factory, fixture, fixture.Fingerprint, 10, "%", "farmer-2", captured.AddSeconds(1));
        using var client = factory.CreateClient(); await Login(client, "farmer@example.com");
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/v1/zones/{fixture.ZoneId}/telemetry/latest")).StatusCode);
        var alerts = await client.GetFromJsonAsync<List<AlertView>>($"/api/v1/zones/{fixture.ZoneId}/alerts", ApiJson);
        Assert.Equal(HttpStatusCode.OK, (await client.PutAsJsonAsync($"/api/v1/alerts/{alerts![0].AlertId}/acknowledge", new { notes = "Farmer checked" })).StatusCode);
        using (var scope = factory.Services.CreateScope()) { var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>(); db.UserZoneAccesses.Remove(await db.UserZoneAccesses.SingleAsync(x => x.AppUserId == fixture.FarmerId && x.ZoneId == fixture.ZoneId)); await db.SaveChangesAsync(); }
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync($"/api/v1/zones/{fixture.ZoneId}/telemetry/latest")).StatusCode);
    }

    [Fact]
    public async Task Cross_tenant_access_is_forbidden_and_old_reading_is_not_fresh_or_online()
    {
        using var factory = new TestApplicationFactory(); var fixture = await PrepareAsync(factory);
        await SendAsync(factory, fixture, fixture.Fingerprint, 70, "%", "old-reading", DateTime.UtcNow.AddDays(-2));
        using var client = factory.CreateClient(); await Login(client, "owner-a@example.com"); var latest = await client.GetFromJsonAsync<LatestTelemetryView>($"/api/v1/zones/{fixture.ZoneId}/telemetry/latest", ApiJson); Assert.False(latest!.HasFreshTelemetry); Assert.False(latest.Metrics[0].IsFresh);
        using (var scope = factory.Services.CreateScope()) { var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>(); Assert.Equal(DeviceStatus.Assigned, (await db.Devices.SingleAsync(x => x.Id == fixture.DeviceId)).Status); Assert.Equal(GatewayStatus.Provisioned, (await db.Gateways.SingleAsync(x => x.Id == fixture.GatewayId)).Status); }
        await Login(client, "owner-b@example.com"); Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/v1/zones/{fixture.ZoneId}/telemetry/latest")).StatusCode);
    }

    private static async Task<Fixture> PrepareAsync(TestApplicationFactory factory)
    {
        var seed = await factory.SeedAsync(); using var client = factory.CreateClient(); await Login(client, "owner-a@example.com");
        var seasonResponse = await client.PostAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}/planting-seasons", new { cropId = Crop, varietyId = Variety, growthProfileId = Profile, name = $"Telemetry-{Guid.NewGuid():N}", startDate = "2026-09-24", expectedEndDate = "2026-12-01" }); seasonResponse.EnsureSuccessStatusCode(); using var seasonJson = JsonDocument.Parse(await seasonResponse.Content.ReadAsStringAsync()); var seasonId = seasonJson.RootElement.GetProperty("seasonId").GetGuid();
        using var scope = factory.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>(); var farm = await db.Farms.SingleAsync(x => x.Id == seed.FarmAId); var owner = await db.AppUsers.SingleAsync(x => x.Id == seed.OwnerAId); var farmer = await db.AppUsers.SingleAsync(x => x.Id == seed.UnassignedFarmerId);
        farmer.TenantId = farm.TenantId; farmer.FarmId = farm.Id; db.UserZoneAccesses.Add(new UserZoneAccess { AppUserId = farmer.Id, ZoneId = seed.ZoneAId });
        var request = new DeploymentRequest { TenantId = farm.TenantId, FarmId = farm.Id, ZoneId = seed.ZoneAId, PlantingSeasonId = seasonId, OwnerUserId = owner.Id, Status = DeploymentRequestStatus.Completed, RequiredParametersCsv = "SoilMoisture,Temperature" };
        var fingerprint = new string('A', 64); var gateway = new Gateway { FarmId = farm.Id, DeploymentRequest = request, MacAddress = "94:B9:7E:AA:BB:CC", GatewaySerial = $"GW-{Guid.NewGuid():N}", FrequencyBand = "433MHz", FirmwareVersion = "v1", MqttClientId = $"mqtt-{Guid.NewGuid():N}", ClientCertificateFingerprint = fingerprint };
        var device = new Device { FarmId = farm.Id, Gateway = gateway, DeploymentRequest = request, ZoneId = seed.ZoneAId, HardwareAddress = $"NODE-{Guid.NewGuid():N}", DeviceType = DeviceType.SensorNode, Status = DeviceStatus.Assigned };
        db.AddRange(request, gateway, device); await db.SaveChangesAsync(); return new(seed.ZoneAId, seasonId, gateway.Id, device.Id, gateway.MqttClientId, fingerprint, farmer.Id);
    }

    private static async Task<TelemetryIngestionResult> SendAsync(TestApplicationFactory factory, Fixture fixture, string fingerprint, decimal value, string unit, string messageId, DateTime? captured = null, EnvironmentalParameterCode parameter = EnvironmentalParameterCode.SoilMoisture)
    {
        var payload = JsonSerializer.SerializeToUtf8Bytes(new { messageId, deviceId = fixture.DeviceId, zoneId = fixture.ZoneId, capturedAtUtc = captured ?? DateTime.UtcNow, readings = new[] { new { parameterCode = parameter.ToString(), value, unit } } });
        using var scope = factory.Services.CreateScope(); var adapter = scope.ServiceProvider.GetRequiredService<IMqttTelemetryAdapter>();
        return await adapter.ReceiveAsync(new MqttInboundMessage($"smartfarm/gateways/{fixture.GatewayId}/telemetry", new(fixture.ClientId, fingerprint), payload), CancellationToken.None);
    }

    private static async Task Login(HttpClient client, string email) { client.DefaultRequestHeaders.Authorization = null; var response = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = "ValidPassword1!" }); response.EnsureSuccessStatusCode(); using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync()); client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", json.RootElement.GetProperty("accessToken").GetString()); }
    private sealed record Fixture(Guid ZoneId, Guid SeasonId, Guid GatewayId, Guid DeviceId, string ClientId, string Fingerprint, Guid FarmerId);
}
