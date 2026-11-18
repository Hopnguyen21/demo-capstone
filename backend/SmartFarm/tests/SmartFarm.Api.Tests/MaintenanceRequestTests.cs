using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SmartFarm.Application.Features.Finance;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;
using Xunit;

namespace SmartFarm.Api.Tests;

/// Phiếu bảo trì: không đoán thiết bị, và hủy phiếu trả trạng thái thiết bị.
public sealed class MaintenanceRequestTests
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };
    private sealed record LoginPayload(string AccessToken);

    private static async Task Login(HttpClient c, string email)
    {
        var r = await c.PostAsJsonAsync("/api/v1/auth/login", new { email, password = "ValidPassword1!" });
        r.EnsureSuccessStatusCode();
        var p = await r.Content.ReadFromJsonAsync<LoginPayload>();
        c.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", p!.AccessToken);
    }

    /// Zone A đã lắp xong (đợt Completed) với `deviceCount` thiết bị.
    private static async Task<List<Guid>> InstalledZoneAsync(TestApplicationFactory f, SeedData s, int deviceCount)
    {
        using var scope = f.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        var farm = await db.Farms.SingleAsync(x => x.Id == s.FarmAId);
        var dep = new DeploymentRequest { TenantId = farm.TenantId, FarmId = s.FarmAId, ZoneId = s.ZoneAId, PlantingSeasonId = Guid.NewGuid(), OwnerUserId = s.OwnerAId, Status = DeploymentRequestStatus.Completed, RequiredParametersCsv = "SoilMoisture" };
        var gateway = new Gateway { FarmId = s.FarmAId, DeploymentRequest = dep, MacAddress = "AA:BB:CC:DD:EE:55", GatewaySerial = $"MT-{Guid.NewGuid():N}", FrequencyBand = "433MHz", FirmwareVersion = "v1", MqttClientId = $"mt-{Guid.NewGuid():N}", ClientCertificateFingerprint = new string('F', 64), Status = GatewayStatus.Online, LastSeenAtUtc = DateTime.UtcNow };
        var devices = Enumerable.Range(0, deviceCount).Select(i => new Device { FarmId = s.FarmAId, Gateway = gateway, DeploymentRequest = dep, ZoneId = s.ZoneAId, HardwareAddress = $"MT-{i}-{Guid.NewGuid():N}", DeviceType = DeviceType.SensorNode, Status = DeviceStatus.Online }).ToList();
        db.AddRange(dep, gateway); db.Devices.AddRange(devices);
        await db.SaveChangesAsync();
        return devices.Select(d => d.Id).ToList();
    }

    private static Task<HttpResponseMessage> Create(HttpClient c, Guid farm, Guid zone, Guid? device) => c.PostAsJsonAsync($"/api/v1/farms/{farm}/service-requests",
        new { zoneId = zone, deviceId = device, failureCode = "SENSOR_OFFLINE", description = "Mất tín hiệu" });

    private static async Task<DeviceStatus> StatusOfAsync(TestApplicationFactory f, Guid device)
    {
        using var scope = f.Services.CreateScope();
        return (await scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>().Devices.AsNoTracking().SingleAsync(d => d.Id == device)).Status;
    }

    [Fact]
    public async Task Maintenance_without_a_device_is_refused_when_the_zone_has_several_devices_and_uses_the_only_device_otherwise()
    {
        using var f = new TestApplicationFactory(); using var c = f.CreateClient(); var s = await f.SeedAsync();
        var devices = await InstalledZoneAsync(f, s, 2);
        await Login(c, "owner-a@example.com");
        Assert.Equal(HttpStatusCode.BadRequest, (await Create(c, s.FarmAId, s.ZoneAId, null)).StatusCode);
        // Chọn thiết bị cụ thể: phiếu ghi đúng thiết bị đó (không phải thiết bị đầu tiên của Zone).
        var chosen = devices[1];
        var ok = await Create(c, s.FarmAId, s.ZoneAId, chosen);
        ok.EnsureSuccessStatusCode();
        var view = (await ok.Content.ReadFromJsonAsync<ServiceRequestView>(Json))!;
        Assert.Equal(chosen, view.CurrentDeviceId);
        Assert.Equal(DeviceStatus.MaintenanceRequired, await StatusOfAsync(f, chosen));
        Assert.Equal(DeviceStatus.Online, await StatusOfAsync(f, devices[0]));
    }

    [Fact]
    public async Task Maintenance_without_a_device_uses_the_single_device_of_the_zone()
    {
        using var f = new TestApplicationFactory(); using var c = f.CreateClient(); var s = await f.SeedAsync();
        var devices = await InstalledZoneAsync(f, s, 1);
        await Login(c, "owner-a@example.com");
        var ok = await Create(c, s.FarmAId, s.ZoneAId, null);
        ok.EnsureSuccessStatusCode();
        Assert.Equal(devices[0], (await ok.Content.ReadFromJsonAsync<ServiceRequestView>(Json))!.CurrentDeviceId);
    }

    [Fact]
    public async Task Cancelling_a_maintenance_request_restores_the_device_unless_another_request_is_still_open()
    {
        using var f = new TestApplicationFactory(); using var c = f.CreateClient(); var s = await f.SeedAsync();
        var devices = await InstalledZoneAsync(f, s, 2);
        await Login(c, "owner-a@example.com");
        var d = devices[0];
        var first = (await (await Create(c, s.FarmAId, s.ZoneAId, d)).Content.ReadFromJsonAsync<ServiceRequestView>(Json))!;
        var second = (await (await Create(c, s.FarmAId, s.ZoneAId, d)).Content.ReadFromJsonAsync<ServiceRequestView>(Json))!;
        Assert.Equal(DeviceStatus.MaintenanceRequired, await StatusOfAsync(f, d));
        // Còn phiếu thứ hai đang mở cho cùng thiết bị: hủy phiếu đầu chưa trả trạng thái.
        (await c.PostAsJsonAsync($"/api/v1/service-requests/{first.Id}/cancel", new { reason = "Nhầm" })).EnsureSuccessStatusCode();
        Assert.Equal(DeviceStatus.MaintenanceRequired, await StatusOfAsync(f, d));
        // Hủy phiếu cuối: thiết bị về Online.
        (await c.PostAsJsonAsync($"/api/v1/service-requests/{second.Id}/cancel", new { reason = "Nhầm" })).EnsureSuccessStatusCode();
        Assert.Equal(DeviceStatus.Online, await StatusOfAsync(f, d));
    }
}
