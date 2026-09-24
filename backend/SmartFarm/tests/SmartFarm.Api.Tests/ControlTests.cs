using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Application.Features.Control;
using SmartFarm.Application.Features.TelemetryAlerts;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;
using Xunit;

namespace SmartFarm.Api.Tests;

public sealed class ControlTests
{
    private static readonly Guid Crop = Guid.Parse("10000000-0000-0000-0000-000000000001");
    private static readonly Guid Variety = Guid.Parse("10000000-0000-0000-0000-000000000002");
    private static readonly Guid Profile = Guid.Parse("10000000-0000-0000-0000-000000000003");
    private static readonly JsonSerializerOptions ApiJson = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };

    [Fact]
    public async Task Http_acceptance_is_sent_only_and_authenticated_ack_proves_execution()
    {
        using var factory = new TestApplicationFactory(); var f = await PrepareAsync(factory); using var client = factory.CreateClient(); await Login(client, "owner-a@example.com");
        var response = await client.PostAsJsonAsync($"/api/v1/zones/{f.ZoneId}/actuators/{f.PumpAId}/command", Manual("ack-command")); Assert.Equal(HttpStatusCode.Accepted, response.StatusCode); var command = await Read<ActuatorCommandView>(response); Assert.Equal(ActuatorCommandStatus.Sent, command.Status); Assert.Single(factory.ControlTransport.Published);
        var before = await client.GetFromJsonAsync<ActuatorStatusView>($"/api/v1/zones/{f.ZoneId}/actuators/{f.PumpAId}/status", ApiJson); Assert.Equal("PendingFeedback", before!.CurrentState);
        var acknowledged = await FeedbackAsync(factory, f, command.CommandId, ActuatorCommandStatus.Acknowledged, "RUNNING"); Assert.Equal(ActuatorCommandStatus.Acknowledged, acknowledged.Status);
        var after = await client.GetFromJsonAsync<ActuatorStatusView>($"/api/v1/zones/{f.ZoneId}/actuators/{f.PumpAId}/status", ApiJson); Assert.Equal("Running", after!.CurrentState); Assert.True(after.RemainingSeconds > 0);
    }

    [Fact]
    public async Task Sent_command_times_out_without_device_feedback()
    {
        using var factory = new TestApplicationFactory(); var f = await PrepareAsync(factory); using var client = factory.CreateClient(); await Login(client, "owner-a@example.com"); var response = await client.PostAsJsonAsync($"/api/v1/zones/{f.ZoneId}/actuators/{f.PumpAId}/command", Manual("timeout-command")); var command = await Read<ActuatorCommandView>(response);
        using var scope = factory.Services.CreateScope(); var control = scope.ServiceProvider.GetRequiredService<IControlService>(); Assert.Equal(1, await control.ExpireTimedOutAsync(DateTime.UtcNow.AddMinutes(1), CancellationToken.None));
        var history = await control.HistoryAsync(f.OwnerId, f.TenantId, f.ZoneId, DateTime.UtcNow.AddHours(-1), DateTime.UtcNow.AddHours(1), 20, CancellationToken.None); var timedOut = Assert.Single(history.Commands, x => x.CommandId == command.CommandId); Assert.Equal(ActuatorCommandStatus.TimedOut, timedOut.Status); Assert.Equal("ACK_TIMEOUT", timedOut.ErrorCode);
    }

    [Fact]
    public async Task Cancelling_running_command_waits_for_stop_feedback()
    {
        using var factory = new TestApplicationFactory(); var f = await PrepareAsync(factory); using var client = factory.CreateClient(); await Login(client, "owner-a@example.com"); var created = await client.PostAsJsonAsync($"/api/v1/zones/{f.ZoneId}/actuators/{f.PumpAId}/command", Manual("cancel-command")); var command = await Read<ActuatorCommandView>(created); await FeedbackAsync(factory, f, command.CommandId, ActuatorCommandStatus.Acknowledged, "RUNNING");
        var cancel = await client.SendAsync(new HttpRequestMessage(HttpMethod.Delete, $"/api/v1/zones/{f.ZoneId}/commands/{command.CommandId}") { Content = JsonContent.Create(new { reason = "Emergency leak stop" }) }); Assert.Equal(HttpStatusCode.Accepted, cancel.StatusCode); var requested = await Read<ActuatorCommandView>(cancel); Assert.Equal(ActuatorCommandStatus.Acknowledged, requested.Status); Assert.NotNull(requested.CancellationRequestedAtUtc); Assert.Single(factory.ControlTransport.EmergencyStops);
        var cancelled = await FeedbackAsync(factory, f, command.CommandId, ActuatorCommandStatus.Cancelled, "OFF"); Assert.Equal(ActuatorCommandStatus.Cancelled, cancelled.Status);
    }

    [Fact]
    public async Task Farmer_needs_can_control_and_cross_tenant_resource_is_hidden()
    {
        using var factory = new TestApplicationFactory(); var f = await PrepareAsync(factory); using var client = factory.CreateClient(); await Login(client, "farmer@example.com"); Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/v1/zones/{f.ZoneId}/actuators/{f.PumpAId}/status")).StatusCode); Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync($"/api/v1/zones/{f.ZoneId}/actuators/{f.PumpAId}/command", Manual("farmer-denied"))).StatusCode);
        using (var scope = factory.Services.CreateScope()) { var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>(); (await db.UserZoneAccesses.SingleAsync(x => x.AppUserId == f.FarmerId && x.ZoneId == f.ZoneId)).CanControl = true; await db.SaveChangesAsync(); }
        Assert.Equal(HttpStatusCode.Accepted, (await client.PostAsJsonAsync($"/api/v1/zones/{f.ZoneId}/actuators/{f.PumpAId}/command", Manual("farmer-allowed"))).StatusCode);
        await Login(client, "owner-b@example.com"); Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/v1/zones/{f.ZoneId}/actuators/{f.PumpAId}/status")).StatusCode);
    }

    [Fact]
    public async Task Transport_loss_is_failed_and_duplicate_key_does_not_publish_twice()
    {
        using var factory = new TestApplicationFactory(); var f = await PrepareAsync(factory); using var client = factory.CreateClient(); await Login(client, "owner-a@example.com"); factory.ControlTransport.PublishSucceeds = false;
        var failedResponse = await client.PostAsJsonAsync($"/api/v1/zones/{f.ZoneId}/actuators/{f.PumpAId}/command", Manual("offline-command")); var failed = await Read<ActuatorCommandView>(failedResponse); Assert.Equal(ActuatorCommandStatus.Failed, failed.Status); Assert.Equal("BROKER_OFFLINE", failed.ErrorCode);
        factory.ControlTransport.PublishSucceeds = true; var firstResponse = await client.PostAsJsonAsync($"/api/v1/zones/{f.ZoneId}/actuators/{f.PumpAId}/command", Manual("duplicate-command")); var first = await Read<ActuatorCommandView>(firstResponse); var publishCount = factory.ControlTransport.Published.Count; var retry = await Read<ActuatorCommandView>(await client.PostAsJsonAsync($"/api/v1/zones/{f.ZoneId}/actuators/{f.PumpAId}/command", Manual("duplicate-command"))); Assert.Equal(first.CommandId, retry.CommandId); Assert.Equal(publishCount, factory.ControlTransport.Published.Count);
    }

    [Fact]
    public async Task Interlock_and_manual_preemption_require_safe_cancellation()
    {
        using var factory = new TestApplicationFactory(); var f = await PrepareAsync(factory); using var client = factory.CreateClient(); await Login(client, "owner-a@example.com");
        var first = await Read<ActuatorCommandView>(await client.PostAsJsonAsync($"/api/v1/zones/{f.ZoneId}/actuators/{f.PumpAId}/command", Manual("pump-a"))); Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync($"/api/v1/zones/{f.ZoneId}/actuators/{f.PumpBId}/command", Manual("pump-b"))).StatusCode);
        using (var scope = factory.Services.CreateScope()) { var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>(); var command = await db.ActuatorCommands.SingleAsync(x => x.Id == first.CommandId); command.TriggerSource = CommandTriggerSource.Schedule; await db.SaveChangesAsync(); }
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync($"/api/v1/zones/{f.ZoneId}/actuators/{f.PumpBId}/command", Manual("manual-no-override"))).StatusCode);
        var preempt = await Read<ActuatorCommandView>(await client.PostAsJsonAsync($"/api/v1/zones/{f.ZoneId}/actuators/{f.PumpBId}/command", Manual("manual-override", true))); Assert.Equal(ActuatorCommandStatus.Pending, preempt.Status); Assert.Single(factory.ControlTransport.EmergencyStops);
        await FeedbackAsync(factory, f, first.CommandId, ActuatorCommandStatus.Cancelled, "OFF"); using var scope2 = factory.Services.CreateScope(); var db2 = scope2.ServiceProvider.GetRequiredService<SmartFarmDbContext>(); Assert.Equal(ActuatorCommandStatus.Sent, (await db2.ActuatorCommands.SingleAsync(x => x.Id == preempt.CommandId)).Status);
    }

    [Fact]
    public async Task Rain_delay_and_overlapping_schedule_are_enforced()
    {
        using var factory = new TestApplicationFactory(); var f = await PrepareAsync(factory); using var client = factory.CreateClient(); await Login(client, "owner-a@example.com"); factory.RainProvider.Probability = 80;
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync($"/api/v1/zones/{f.ZoneId}/actuators/{f.PumpAId}/command", Manual("rain-block"))).StatusCode); factory.RainProvider.Probability = 10;
        var schedule = new { name = "Morning irrigation", actuatorId = f.PumpAId, cronExpression = "0 6 * * *", durationSeconds = 1200, enableRainDelay = true, rainThresholdPercent = 70 };
        Assert.Equal(HttpStatusCode.Created, (await client.PostAsJsonAsync($"/api/v1/zones/{f.ZoneId}/schedules", schedule)).StatusCode); Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync($"/api/v1/zones/{f.ZoneId}/schedules", new { name = "Overlapping irrigation", actuatorId = f.PumpBId, cronExpression = "10 6 * * *", durationSeconds = 1200, enableRainDelay = true, rainThresholdPercent = 70 })).StatusCode);
    }

    [Fact]
    public async Task Schedule_and_auto_rule_create_audited_commands_with_correct_source()
    {
        using var factory = new TestApplicationFactory(); var f = await PrepareAsync(factory); using var client = factory.CreateClient(); await Login(client, "owner-a@example.com");
        var scheduleResponse = await client.PostAsJsonAsync($"/api/v1/zones/{f.ZoneId}/schedules", new { name = "Due schedule", actuatorId = f.PumpAId, cronExpression = "0 6 * * *", durationSeconds = 60, enableRainDelay = true, rainThresholdPercent = 70 }); var schedule = await Read<ScheduleView>(scheduleResponse);
        using (var scope = factory.Services.CreateScope()) { var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>(); (await db.ControlSchedules.SingleAsync(x => x.Id == schedule.ScheduleId)).NextRunAtUtc = DateTime.UtcNow.AddMinutes(-1); await db.SaveChangesAsync(); var control = scope.ServiceProvider.GetRequiredService<IControlService>(); Assert.Equal(1, await control.ProcessDueSchedulesAsync(DateTime.UtcNow, CancellationToken.None)); var command = await db.ActuatorCommands.SingleAsync(x => x.ScheduleId == schedule.ScheduleId); Assert.Equal(CommandTriggerSource.Schedule, command.TriggerSource); command.Status = ActuatorCommandStatus.Failed; command.TerminalAtUtc = DateTime.UtcNow; await db.SaveChangesAsync(); }
        var ruleResponse = await client.PostAsJsonAsync($"/api/v1/zones/{f.ZoneId}/rules", new { name = "Dry soil rule", parameterCode = "SoilMoisture", @operator = "LessThan", threshold = 45, conditionDurationMinutes = 1, actuatorId = f.PumpAId, action = "TurnOn", durationSeconds = 60, priority = 1, cooldownMinutes = 60, enableRainDelay = true, rainThresholdPercent = 70 }); ruleResponse.EnsureSuccessStatusCode(); var rule = await Read<AutoRuleView>(ruleResponse);
        using (var scope = factory.Services.CreateScope()) { var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>(); (await db.AutoControlRules.SingleAsync(x => x.Id == rule.RuleId)).ConditionTrueSinceUtc = DateTime.UtcNow.AddMinutes(-2); (await db.TelemetryReadings.SingleAsync(x => x.DeviceId == f.DeviceId && x.ParameterCode == EnvironmentalParameterCode.SoilMoisture)).Value = 20; await db.SaveChangesAsync(); var control = scope.ServiceProvider.GetRequiredService<IControlService>(); Assert.Equal(1, await control.EvaluateRulesAsync(f.ZoneId, CancellationToken.None)); Assert.Equal(CommandTriggerSource.AutoRule, (await db.ActuatorCommands.SingleAsync(x => x.AutoRuleId == rule.RuleId)).TriggerSource); }
    }

    private static object Manual(string key, bool overrideActive = false) => new { action = "TurnOn", durationSeconds = 600, overrideActiveSchedules = overrideActive, idempotencyKey = key, notes = "integration test" };
    private static async Task<T> Read<T>(HttpResponseMessage response) { response.EnsureSuccessStatusCode(); return (await response.Content.ReadFromJsonAsync<T>(ApiJson))!; }

    private static async Task<ActuatorCommandView> FeedbackAsync(TestApplicationFactory factory, Fixture f, Guid commandId, ActuatorCommandStatus status, string observed)
    {
        var payload = JsonSerializer.SerializeToUtf8Bytes(new { commandId, deviceId = f.DeviceId, status = status.ToString(), observedState = observed, occurredAtUtc = DateTime.UtcNow, errorCode = (string?)null, errorMessage = (string?)null }); using var scope = factory.Services.CreateScope(); var adapter = scope.ServiceProvider.GetRequiredService<IActuatorFeedbackAdapter>(); return await adapter.ReceiveAsync(new MqttActuatorFeedbackMessage($"smartfarm/gateways/{f.GatewayId}/actuator-feedback", new GatewayTransportIdentity(f.ClientId, f.Fingerprint), payload), CancellationToken.None);
    }

    private static async Task<Fixture> PrepareAsync(TestApplicationFactory factory)
    {
        var seed = await factory.SeedAsync(); using var client = factory.CreateClient(); await Login(client, "owner-a@example.com"); var seasonResponse = await client.PostAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}/planting-seasons", new { cropId = Crop, varietyId = Variety, growthProfileId = Profile, name = $"Control-{Guid.NewGuid():N}", startDate = "2026-09-24", expectedEndDate = "2026-12-01" }); seasonResponse.EnsureSuccessStatusCode(); using var seasonJson = JsonDocument.Parse(await seasonResponse.Content.ReadAsStringAsync()); var seasonId = seasonJson.RootElement.GetProperty("seasonId").GetGuid();
        using var scope = factory.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>(); var farm = await db.Farms.SingleAsync(x => x.Id == seed.FarmAId); var farmer = await db.AppUsers.SingleAsync(x => x.Id == seed.UnassignedFarmerId); farmer.TenantId = farm.TenantId; farmer.FarmId = farm.Id; db.UserZoneAccesses.Add(new UserZoneAccess { AppUserId = farmer.Id, ZoneId = seed.ZoneAId, CanControl = false });
        var request = new DeploymentRequest { TenantId = farm.TenantId, FarmId = farm.Id, ZoneId = seed.ZoneAId, PlantingSeasonId = seasonId, OwnerUserId = seed.OwnerAId, TechnicianUserId = seed.TechnicianId, Status = DeploymentRequestStatus.Completed, RequiredParametersCsv = "SoilMoisture" }; var fingerprint = new string('B', 64); var gateway = new Gateway { FarmId = farm.Id, DeploymentRequest = request, MacAddress = "94:B9:7E:12:34:56", GatewaySerial = $"CGW-{Guid.NewGuid():N}", FrequencyBand = "433MHz", FirmwareVersion = "v1", MqttClientId = $"control-{Guid.NewGuid():N}", ClientCertificateFingerprint = fingerprint, Status = GatewayStatus.Online, LastSeenAtUtc = DateTime.UtcNow };
        var device = new Device { FarmId = farm.Id, Gateway = gateway, DeploymentRequest = request, ZoneId = seed.ZoneAId, HardwareAddress = $"CTRL-{Guid.NewGuid():N}", DeviceType = DeviceType.ActuatorNode, Status = DeviceStatus.Online }; var pumpA = new DeviceActuator { Device = device, ActuatorType = "WaterPump", RelayChannel = 1, MaxDurationMinutes = 30 }; var pumpB = new DeviceActuator { Device = device, ActuatorType = "WaterPump", RelayChannel = 2, MaxDurationMinutes = 30 }; var sensor = new DeviceSensor { Device = device, SensorType = "SoilMoisture", Unit = "%", SamplingIntervalSec = 60 }; db.AddRange(request, gateway, device, pumpA, pumpB, sensor); await db.SaveChangesAsync();
        db.DeviceConnectionTests.Add(new DeviceConnectionTest { DeviceId = device.Id, DeploymentRequestId = request.Id, TechnicianUserId = seed.TechnicianId, Succeeded = true, ObservedAtUtc = DateTime.UtcNow }); db.TelemetryReadings.Add(new TelemetryReading { TenantId = farm.TenantId, FarmId = farm.Id, ZoneId = seed.ZoneAId, DeviceId = device.Id, GatewayId = gateway.Id, MessageId = $"control-{Guid.NewGuid():N}", ParameterCode = EnvironmentalParameterCode.SoilMoisture, Value = 70, Unit = "%", CapturedAtUtc = DateTime.UtcNow, ReceivedAtUtc = DateTime.UtcNow }); await db.SaveChangesAsync(); return new(seed.OwnerAId, farmer.Id, farm.TenantId, seed.ZoneAId, gateway.Id, device.Id, pumpA.Id, pumpB.Id, gateway.MqttClientId, fingerprint);
    }

    private static async Task Login(HttpClient client, string email) { client.DefaultRequestHeaders.Authorization = null; var response = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = "ValidPassword1!" }); response.EnsureSuccessStatusCode(); using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync()); client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", json.RootElement.GetProperty("accessToken").GetString()); }
    private sealed record Fixture(Guid OwnerId, Guid FarmerId, Guid TenantId, Guid ZoneId, Guid GatewayId, Guid DeviceId, Guid PumpAId, Guid PumpBId, string ClientId, string Fingerprint);
}
