using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SmartFarm.Application.Features.Finance;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;
using Xunit;

namespace SmartFarm.Api.Tests;

public sealed class FinanceServiceTests
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };

    [Fact]
    public async Task Invalid_amount_is_rejected_and_report_is_revenue_minus_expense()
    {
        using var f = new TestApplicationFactory(); var s = await f.SeedAsync(); using var c = f.CreateClient(); await Login(c, "owner-a@example.com");
        var invalid = await c.PostAsJsonAsync($"/api/v1/farms/{s.FarmAId}/finance/expenses", Tx(0, "Material")); Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
        (await c.PostAsJsonAsync($"/api/v1/farms/{s.FarmAId}/finance/revenues", Tx(1000, null))).EnsureSuccessStatusCode();
        (await c.PostAsJsonAsync($"/api/v1/farms/{s.FarmAId}/finance/expenses", Tx(275, "Material"))).EnsureSuccessStatusCode();
        var report = await Read<CashFlowReportView>(await c.GetAsync($"/api/v1/farms/{s.FarmAId}/cash-flow-report")); Assert.Equal(1000, report.Revenue); Assert.Equal(275, report.Expense); Assert.Equal(725, report.NetCashFlow);
    }

    [Fact]
    public async Task Only_assigned_technician_can_process_request()
    {
        using var f = new TestApplicationFactory(); var x = await Setup(f); using var c = f.CreateClient(); var request = await CreateAndAssign(c, x, x.TechnicianId);
        await Login(c, "technician-2@example.com"); var response = await c.PostAsync($"/api/v1/service-requests/{request.Id}/accept", null); Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        await Login(c, "technician@example.com"); Assert.Equal(ServiceRequestStatus.InProgress, (await Read<ServiceRequestView>(await c.PostAsync($"/api/v1/service-requests/{request.Id}/accept", null))).Status);
    }

    [Fact]
    public async Task Replacement_device_already_in_another_zone_is_rejected()
    {
        using var f = new TestApplicationFactory(); var x = await Setup(f, replacementAssignedElsewhere: true); using var c = f.CreateClient(); var request = await CreateAndAssign(c, x, x.TechnicianId); await Login(c, "technician@example.com"); await c.PostAsync($"/api/v1/service-requests/{request.Id}/accept", null);
        (await c.PostAsJsonAsync($"/api/v1/service-requests/{request.Id}/diagnosis", new { inspectionNotes = "Inspected wiring", diagnosis = "Board failure", resolutionAction = "Replacement" })).EnsureSuccessStatusCode();
        var replace = await c.PostAsJsonAsync($"/api/v1/service-requests/{request.Id}/replacement", new { newDeviceId = x.NewDeviceId, notes = "Swap" }); Assert.Equal(HttpStatusCode.Conflict, replace.StatusCode);
    }

    [Fact]
    public async Task Request_cannot_close_until_latest_current_device_test_passes()
    {
        using var f = new TestApplicationFactory(); var x = await Setup(f); using var c = f.CreateClient(); var request = await CreateAndAssign(c, x, x.TechnicianId); await Login(c, "technician@example.com"); await c.PostAsync($"/api/v1/service-requests/{request.Id}/accept", null);
        (await c.PostAsJsonAsync($"/api/v1/service-requests/{request.Id}/diagnosis", new { inspectionNotes = "Pump inspected", diagnosis = "Loose terminal", resolutionAction = "Repair" })).EnsureSuccessStatusCode();
        (await c.PostAsJsonAsync($"/api/v1/service-requests/{request.Id}/work", new { workPerformed = "Terminal repaired" })).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.Conflict, (await c.PostAsync($"/api/v1/service-requests/{request.Id}/close", null)).StatusCode);
        (await c.PostAsJsonAsync($"/api/v1/service-requests/{request.Id}/connection-tests", new { succeeded = false, observedAtUtc = DateTime.UtcNow, errorCode = "NO_ACK" })).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.Conflict, (await c.PostAsync($"/api/v1/service-requests/{request.Id}/close", null)).StatusCode);
        (await c.PostAsJsonAsync($"/api/v1/service-requests/{request.Id}/connection-tests", new { succeeded = true, observedAtUtc = DateTime.UtcNow.AddSeconds(1), roundTripLatencyMs = 30 })).EnsureSuccessStatusCode();
        Assert.Equal(ServiceRequestStatus.Closed, (await Read<ServiceRequestView>(await c.PostAsync($"/api/v1/service-requests/{request.Id}/close", null))).Status);
    }

    [Fact]
    public async Task Owner_cannot_access_cross_tenant_finance_or_service_request()
    {
        using var f = new TestApplicationFactory(); var x = await Setup(f); using var c = f.CreateClient(); await Login(c, "owner-a@example.com"); var created = await Read<ServiceRequestView>(await c.PostAsJsonAsync($"/api/v1/farms/{x.Seed.FarmAId}/service-requests", new { zoneId = x.Seed.ZoneAId, deviceId = x.OldDeviceId, failureCode = "OFFLINE", description = "No telemetry" }));
        await Login(c, "owner-b@example.com"); Assert.Equal(HttpStatusCode.NotFound, (await c.GetAsync($"/api/v1/service-requests/{created.Id}")).StatusCode); Assert.Equal(HttpStatusCode.NotFound, (await c.GetAsync($"/api/v1/farms/{x.Seed.FarmAId}/cash-flow-report")).StatusCode);
    }

    private static object Tx(decimal amount, string? category) => new { amount, occurredAtUtc = DateTime.UtcNow, description = "Harvest accounting", expenseCategory = category };
    private static async Task<ServiceRequestView> CreateAndAssign(HttpClient c, Fixture x, Guid tech)
    { await Login(c, "owner-a@example.com"); var r = await Read<ServiceRequestView>(await c.PostAsJsonAsync($"/api/v1/farms/{x.Seed.FarmAId}/service-requests", new { zoneId = x.Seed.ZoneAId, deviceId = x.OldDeviceId, failureCode = "OFFLINE", description = "Device stopped reporting" })); await Login(c, "admin@example.com"); return await Read<ServiceRequestView>(await c.PostAsJsonAsync($"/api/v1/service-requests/{r.Id}/assign", new { technicianUserId = tech })); }
    private static async Task<Fixture> Setup(TestApplicationFactory f, bool replacementAssignedElsewhere = false)
    {
        var s = await f.SeedAsync(); using var scope = f.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>(); var tech2 = new AppUser { Email = "technician-2@example.com", NormalizedEmail = "TECHNICIAN-2@EXAMPLE.COM", FullName = "Technician 2", Role = UserRole.PlatformTechnician, Status = AccountStatus.Active }; tech2.PasswordHash = new PasswordHasher<AppUser>().HashPassword(tech2, "ValidPassword1!");
        var dep = new DeploymentRequest { TenantId = (await db.Farms.SingleAsync(x => x.Id == s.FarmAId)).TenantId, FarmId = s.FarmAId, ZoneId = s.ZoneAId, PlantingSeasonId = Guid.NewGuid(), OwnerUserId = s.OwnerAId, Status = DeploymentRequestStatus.Completed, RequiredParametersCsv = "SoilMoisture" };
        var gw = new Gateway { FarmId = s.FarmAId, DeploymentRequest = dep, MacAddress = $"AA:BB:CC:{Random.Shared.Next(10,99)}:11:22", GatewaySerial = Guid.NewGuid().ToString("N"), FrequencyBand = "AS923", FirmwareVersion = "1", MqttClientId = Guid.NewGuid().ToString("N"), ClientCertificateFingerprint = new string('A', 64) };
        var old = new Device { FarmId = s.FarmAId, Gateway = gw, DeploymentRequest = dep, ZoneId = s.ZoneAId, HardwareAddress = Guid.NewGuid().ToString("N"), DeviceType = DeviceType.SensorNode, Status = DeviceStatus.Online };
        var next = new Device { FarmId = s.FarmAId, Gateway = gw, DeploymentRequest = dep, ZoneId = replacementAssignedElsewhere ? s.ZoneBId : null, HardwareAddress = Guid.NewGuid().ToString("N"), DeviceType = DeviceType.SensorNode, Status = replacementAssignedElsewhere ? DeviceStatus.Assigned : DeviceStatus.Unassigned };
        db.AddRange(tech2, dep, gw, old, next); await db.SaveChangesAsync(); return new(s, old.Id, next.Id, s.TechnicianId, tech2.Id);
    }
    private static async Task Login(HttpClient c, string email) { var r = await c.PostAsJsonAsync("/api/v1/auth/login", new { email, password = "ValidPassword1!" }); r.EnsureSuccessStatusCode(); var p = await r.Content.ReadFromJsonAsync<LoginPayload>(); c.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", p!.AccessToken); }
    private static async Task<T> Read<T>(HttpResponseMessage r) { r.EnsureSuccessStatusCode(); return (await r.Content.ReadFromJsonAsync<T>(Json))!; }
    private sealed record LoginPayload(string AccessToken);
    private sealed record Fixture(SeedData Seed, Guid OldDeviceId, Guid NewDeviceId, Guid TechnicianId, Guid OtherTechnicianId);
}
