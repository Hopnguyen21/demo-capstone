using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.AspNetCore.Mvc.Testing;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;
using Xunit;

namespace SmartFarm.Api.Tests;

/// <summary>MÔ PHỎNG Gateway khi chưa có phần cứng: chỉ môi trường bật SimulatedIot:Enabled, vẫn giữ các điều kiện của luồng thật.</summary>
public class GatewaySimulationTests
{
    private static async Task LoginAsync(HttpClient client, string email)
    {
        client.DefaultRequestHeaders.Authorization = null;
        var r = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = "ValidPassword1!" });
        r.EnsureSuccessStatusCode();
        using var j = JsonDocument.Parse(await r.Content.ReadAsStringAsync());
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", j.RootElement.GetProperty("accessToken").GetString());
    }

    private static async Task<(Guid depId, Guid farmId)> SetupAsync(TestApplicationFactory factory, SeedData seed, bool depositPaid)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        var farm = await db.Farms.SingleAsync(f => f.Id == seed.FarmAId);
        var dep = new DeploymentRequest
        {
            TenantId = farm.TenantId, FarmId = farm.Id, ZoneId = seed.ZoneAId, PlantingSeasonId = Guid.NewGuid(), OwnerUserId = seed.OwnerAId,
            TechnicianUserId = seed.TechnicianId, Status = DeploymentRequestStatus.Installing, RequiredParametersCsv = "SoilMoisture"
        };
        db.DeploymentRequests.Add(dep);
        db.ServiceRequests.Add(new ServiceRequest
        {
            TenantId = farm.TenantId, FarmId = farm.Id, ZoneId = seed.ZoneAId, DeploymentRequestId = dep.Id, Source = "Test", FailureCode = "INSTALLATION",
            Description = "Lắp đặt", Status = ServiceRequestStatus.Assigned, AssignedTechnicianId = seed.TechnicianId, IsContractSigned = depositPaid, IsDepositPaid = depositPaid
        });
        await db.SaveChangesAsync();
        return (dep.Id, farm.Id);
    }

    private static HttpClient Enabled(TestApplicationFactory factory, out WebApplicationFactory<Program> derived)
    {
        derived = factory.WithWebHostBuilder(b => b.ConfigureAppConfiguration((_, c) =>
            c.AddInMemoryCollection(new Dictionary<string, string?> { ["SimulatedIot:Enabled"] = "true" })));
        return derived.CreateClient();
    }

    [Fact]
    public async Task Disabled_by_default_returns_404_and_creates_nothing()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        var (depId, farmId) = await SetupAsync(factory, seed, depositPaid: true);
        using var client = factory.CreateClient();
        await LoginAsync(client, "technician@example.com");
        var r = await client.PostAsJsonAsync("/api/v1/gateway-enrollment/simulate", new { farmId, deploymentRequestId = depId });
        Assert.Equal(HttpStatusCode.NotFound, r.StatusCode);
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        Assert.False(await db.Gateways.AnyAsync());
        Assert.False(await db.PlatformHardwareItems.AnyAsync(x => x.Code.StartsWith("GW-SIM")));
    }

    [Fact]
    public async Task Enabled_creates_a_simulated_gateway_enrolls_and_activates_it_for_the_request()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        var (depId, farmId) = await SetupAsync(factory, seed, depositPaid: true);
        using var client = Enabled(factory, out var derived);
        using var _ = derived;
        await LoginAsync(client, "technician@example.com");

        var r = await client.PostAsJsonAsync("/api/v1/gateway-enrollment/simulate", new { farmId, deploymentRequestId = depId });
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        using var json = JsonDocument.Parse(await r.Content.ReadAsStringAsync());
        Assert.Equal("Activated", json.RootElement.GetProperty("status").GetString());
        var gatewayId = json.RootElement.GetProperty("gatewayId").GetGuid();

        await using var scope = derived.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        var gw = await db.Gateways.SingleAsync(x => x.Id == gatewayId);
        Assert.Equal(depId, gw.DeploymentRequestId);
        Assert.Equal(farmId, gw.FarmId);
        var item = await db.PlatformHardwareItems.SingleAsync(x => x.Code.StartsWith("GW-SIM"));
        Assert.Equal(seed.TechnicianId, item.AssignedTechnicianId);
        Assert.Equal(item.MacAddress, gw.MacAddress);

        // mỗi yêu cầu chỉ một Gateway
        var again = await client.PostAsJsonAsync("/api/v1/gateway-enrollment/simulate", new { farmId, deploymentRequestId = depId });
        Assert.Equal(HttpStatusCode.Conflict, again.StatusCode);
    }

    [Fact]
    public async Task Enabled_still_requires_the_deposit_the_right_technician_and_the_matching_farm()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        var (depId, farmId) = await SetupAsync(factory, seed, depositPaid: false);
        using var client = Enabled(factory, out var derived);
        using var _ = derived;
        await LoginAsync(client, "technician@example.com");
        // chưa cọc
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync("/api/v1/gateway-enrollment/simulate", new { farmId, deploymentRequestId = depId })).StatusCode);
        // farm không khớp
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync("/api/v1/gateway-enrollment/simulate", new { farmId = seed.FarmBId, deploymentRequestId = depId })).StatusCode);
        // người khác (chủ trại) không dùng được
        await LoginAsync(client, "owner-a@example.com");
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync("/api/v1/gateway-enrollment/simulate", new { farmId, deploymentRequestId = depId })).StatusCode);
    }

    [Fact]
    public async Task A_gateway_already_in_the_farm_can_be_used_by_a_new_request_but_not_one_from_another_farm()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        var (depId, farmId) = await SetupAsync(factory, seed, depositPaid: true);
        Guid ownFarmGateway, otherFarmGateway;
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            var farmA = await db.Farms.SingleAsync(f => f.Id == seed.FarmAId);
            var farmB = await db.Farms.SingleAsync(f => f.Id == seed.FarmBId);
            // Gateway của đợt lắp đặt TRƯỚC ở cùng trang trại và Gateway của trang trại khác
            Guid Old(Farm f, Guid zone, Guid owner, string tag)
            {
                var d = new DeploymentRequest { TenantId = f.TenantId, FarmId = f.Id, ZoneId = zone, PlantingSeasonId = Guid.NewGuid(), OwnerUserId = owner, Status = DeploymentRequestStatus.Completed, RequiredParametersCsv = "SoilMoisture" };
                db.DeploymentRequests.Add(d);
                var g = new Gateway { DeploymentRequestId = d.Id, FarmId = f.Id, MacAddress = $"AA:BB:CC:00:00:{tag}", GatewaySerial = $"GW-OLD-{tag}", FrequencyBand = "433MHz", FirmwareVersion = "v1", MqttClientId = $"gw-{tag}", ClientCertificateFingerprint = new string('A', 62) + tag };
                db.Gateways.Add(g);
                return g.Id;
            }
            ownFarmGateway = Old(farmA, seed.ZoneAId, seed.OwnerAId, "01");
            otherFarmGateway = Old(farmB, seed.ZoneBId, seed.OwnerBId, "02");
            await db.SaveChangesAsync();
        }
        using var client = factory.CreateClient();
        await LoginAsync(client, "technician@example.com");
        object Body(Guid gateway) => new { deploymentRequestId = depId, gatewayId = gateway, farmId, nodes = new[] { new { hardwareAddress = "NODE-REUSE-1", deviceType = "SensorNode", deviceModelId = Guid.NewGuid() } } };

        var other = await client.PostAsJsonAsync("/api/v1/devices/provision", Body(otherFarmGateway));
        Assert.Equal(HttpStatusCode.NotFound, other.StatusCode); // Gateway của trang trại khác: không dùng được

        var own = await client.PostAsJsonAsync("/api/v1/devices/provision", Body(ownFarmGateway));
        // Gateway cùng trang trại qua được bước kiểm tra Gateway (dừng ở quy tắc sau, không phải "Gateway was not found")
        Assert.NotEqual(HttpStatusCode.NotFound, own.StatusCode);
        Assert.DoesNotContain("Gateway was not found", await own.Content.ReadAsStringAsync());
    }
}
