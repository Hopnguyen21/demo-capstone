using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SmartFarm.Domain.Enums;
using SmartFarm.Domain.Entities;
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
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync(); using var client = factory.CreateClient(); var setup = await PrepareInstallation(factory, client, seed.ZoneAId, seed.FarmAId);
        var wrongZone = await client.PostAsJsonAsync($"/api/v1/zones/{seed.ZoneBId}/devices/{setup.DeviceId}/assign", new { installationNotes = "wrong tenant" }); Assert.Equal(HttpStatusCode.NotFound, wrongZone.StatusCode);
        (await client.PostAsJsonAsync($"/api/v1/platform/deployment-requests/{setup.RequestId}/connection-tests", new { deviceId = setup.DeviceId, succeeded = true, observedAtUtc = DateTime.UtcNow, rssi = -68m, snr = 9.2m, roundTripLatencyMs = 85 })).EnsureSuccessStatusCode();
        var assigned = await client.PostAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}/devices/{setup.DeviceId}/assign", new { installationNotes = "north west", gpsLatitude = 11.95m, gpsLongitude = 108.44m }); assigned.EnsureSuccessStatusCode();
        var duplicate = await client.PostAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}/devices/{setup.DeviceId}/assign", new { installationNotes = "again" }); Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);
    }

    [Fact]
    public async Task Failed_deployment_creates_maintenance_handoff_and_marks_device()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync(); using var client = factory.CreateClient(); var setup = await PrepareInstallation(factory, client, seed.ZoneAId, seed.FarmAId);
        var test = await client.PostAsJsonAsync($"/api/v1/platform/deployment-requests/{setup.RequestId}/connection-tests", new { deviceId = setup.DeviceId, succeeded = false, observedAtUtc = DateTime.UtcNow, errorCode = "NO_ACK", errorMessage = "No LoRa acknowledgement" }); test.EnsureSuccessStatusCode();
        var failed = await client.PostAsJsonAsync($"/api/v1/platform/deployment-requests/{setup.RequestId}/fail", new { failureCode = "INSTALL_NO_ACK", description = "Device failed connectivity check", deviceId = setup.DeviceId }); failed.EnsureSuccessStatusCode();
        using var scope = factory.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>(); Assert.Equal(DeploymentRequestStatus.MaintenanceRequired, (await db.DeploymentRequests.SingleAsync(x => x.Id == setup.RequestId)).Status); Assert.Equal(DeviceStatus.MaintenanceRequired, (await db.Devices.SingleAsync(x => x.Id == setup.DeviceId)).Status); Assert.Equal(ServiceRequestStatus.Open, (await db.ServiceRequests.SingleAsync(x => x.DeploymentRequestId == setup.RequestId && x.Source == "DeploymentFailure")).Status);
    }

    [Fact]
    public async Task Successful_installation_configuration_connection_test_and_completion_are_audited()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync(); using var client = factory.CreateClient(); var setup = await PrepareInstallation(factory, client, seed.ZoneAId, seed.FarmAId);
        (await client.PostAsJsonAsync($"/api/v1/platform/deployment-requests/{setup.RequestId}/connection-tests", new { deviceId = setup.DeviceId, succeeded = true, observedAtUtc = DateTime.UtcNow, rssi = -68m, snr = 9.2m, roundTripLatencyMs = 85 })).EnsureSuccessStatusCode();
        (await client.PostAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}/devices/{setup.DeviceId}/assign", new { installationNotes = "installed" })).EnsureSuccessStatusCode();
        var completed = await client.PostAsync($"/api/v1/platform/deployment-requests/{setup.RequestId}/complete", null); completed.EnsureSuccessStatusCode(); using var json = JsonDocument.Parse(await completed.Content.ReadAsStringAsync()); Assert.Equal("Completed", json.RootElement.GetProperty("status").GetString()); Assert.True(json.RootElement.GetProperty("decisionHistory").GetArrayLength() >= 8);
    }

    [Fact]
    public async Task Owner_cannot_read_another_tenants_deployment_request()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync(); using var client = factory.CreateClient(); await Login(client, "owner-a@example.com"); await CreateSeason(client, seed.ZoneAId); var create = await client.PostAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}/deployment-requests", PlanBody()); create.EnsureSuccessStatusCode(); var id = await Id(create, "requestId"); await Login(client, "owner-b@example.com"); Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/v1/deployment-requests/{id}")).StatusCode);
    }

    [Fact]
    public async Task Gateway_ota_job_requires_device_result_before_becoming_succeeded()
    {
        using var factory = new TestApplicationFactory();
        var seed = await factory.SeedAsync();
        using var client = factory.CreateClient();
        var setup = await PrepareInstallation(factory, client, seed.ZoneAId, seed.FarmAId);

        Guid gatewayId;
        string mac;
        Guid releaseId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            var gateway = await db.Gateways.SingleAsync(x => x.DeploymentRequestId == setup.RequestId);
            gatewayId = gateway.Id;
            mac = gateway.MacAddress;
            var release = new FirmwareRelease
            {
                HardwareTarget = "ESP32_GATEWAY_RUNTIME",
                Version = "test-runtime-1.0.0",
                ProtocolVersion = "1.0",
                ArtifactUrl = "https://example.invalid/gateway.bin",
                ArtifactSha256 = new string('b', 64),
                Status = FirmwareReleaseStatus.Approved,
                PublishedAtUtc = DateTime.UtcNow
            };
            db.FirmwareReleases.Add(release);
            await db.SaveChangesAsync();
            releaseId = release.Id;
        }

        var scheduled = await client.PutAsJsonAsync($"/api/v1/gateways/{gatewayId}/firmware", new { firmwareReleaseId = releaseId, scheduledAtUtc = DateTime.UtcNow });
        scheduled.EnsureSuccessStatusCode();
        using (var update = await client.GetAsync($"/api/v1/gateway-runtime/update?macAddress={Uri.EscapeDataString(mac)}&currentVersion=1.0.0"))
        {
            Assert.Equal(HttpStatusCode.OK, update.StatusCode);
            using var json = JsonDocument.Parse(await update.Content.ReadAsStringAsync());
            Assert.True(json.RootElement.TryGetProperty("version", out var targetVersion), json.RootElement.ToString());
            Assert.Equal("test-runtime-1.0.0", targetVersion.GetString());
        }

        (await client.PostAsJsonAsync("/api/v1/gateway-runtime/ota-result", new { macAddress = mac, version = "test-runtime-1.0.0", result = "Started" })).EnsureSuccessStatusCode();
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            Assert.Equal(FirmwareJobStatus.InProgress, await db.FirmwareJobs.Where(x => x.GatewayId == gatewayId).Select(x => x.Status).SingleAsync());
        }

        (await client.PostAsJsonAsync("/api/v1/gateway-runtime/ota-result", new { macAddress = mac, version = "test-runtime-1.0.0", result = "Succeeded" })).EnsureSuccessStatusCode();
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            Assert.Equal(FirmwareJobStatus.Succeeded, await db.FirmwareJobs.Where(x => x.GatewayId == gatewayId).Select(x => x.Status).SingleAsync());
            Assert.Equal("test-runtime-1.0.0", await db.Gateways.Where(x => x.Id == gatewayId).Select(x => x.FirmwareVersion).SingleAsync());
        }
    }

    /// <summary>Admin phân công KTV cho yêu cầu (gán vào phiếu dịch vụ của yêu cầu triển khai); KTV chỉ tiếp nhận được yêu cầu đã được phân công.</summary>
    private static async Task AssignTechnician(TestApplicationFactory factory, Guid requestId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        var techId = await db.AppUsers.Where(x => x.Email == "technician@example.com").Select(x => x.Id).SingleAsync();
        foreach (var sr in await db.ServiceRequests.Where(x => x.DeploymentRequestId == requestId).ToListAsync()) sr.AssignedTechnicianId = techId;
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task Technician_cannot_accept_unassigned_deployment_request()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync(); using var client = factory.CreateClient();
        await Login(client, "owner-a@example.com"); await CreateSeason(client, seed.ZoneAId);
        var create = await client.PostAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}/deployment-requests", PlanBody()); create.EnsureSuccessStatusCode(); var requestId = await Id(create, "requestId");
        (await client.PostAsync($"/api/v1/deployment-requests/{requestId}/submit", null)).EnsureSuccessStatusCode();
        await Login(client, "technician@example.com");
        Assert.Equal(System.Net.HttpStatusCode.NotFound, (await client.PostAsync($"/api/v1/platform/deployment-requests/{requestId}/accept", null)).StatusCode);
        Assert.Equal(System.Net.HttpStatusCode.NotFound, (await client.GetAsync($"/api/v1/platform/deployment-requests/{requestId}")).StatusCode);
        await AssignTechnician(factory, requestId);
        Assert.Equal(System.Net.HttpStatusCode.OK, (await client.PostAsync($"/api/v1/platform/deployment-requests/{requestId}/accept", null)).StatusCode);
    }

    private static async Task<Setup> PrepareInstallation(TestApplicationFactory factory, HttpClient client, Guid zoneId, Guid farmId)
    {
        await Login(client, "owner-a@example.com"); await CreateSeason(client, zoneId); var create = await client.PostAsJsonAsync($"/api/v1/zones/{zoneId}/deployment-requests", PlanBody()); create.EnsureSuccessStatusCode(); var requestId = await Id(create, "requestId"); (await client.PostAsync($"/api/v1/deployment-requests/{requestId}/submit", null)).EnsureSuccessStatusCode(); await AssignTechnician(factory, requestId); await Login(client, "technician@example.com"); (await client.PostAsync($"/api/v1/platform/deployment-requests/{requestId}/accept", null)).EnsureSuccessStatusCode(); (await client.PostAsJsonAsync($"/api/v1/platform/deployment-requests/{requestId}/survey", new { isFeasible = true, siteConditions = "Power and mounting available", notes = "Plan is feasible" })).EnsureSuccessStatusCode(); (await client.PostAsync($"/api/v1/platform/deployment-requests/{requestId}/confirm", null)).EnsureSuccessStatusCode(); 
        // Bắt đầu lắp đặt chỉ được khi chủ trại đã ký hợp đồng và đóng cọc (cờ trên yêu cầu dịch vụ do bước gửi yêu cầu tạo ra).
        using (var contractScope = factory.Services.CreateScope())
        {
            var contractDb = contractScope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            foreach (var sr in await contractDb.ServiceRequests.Where(x => x.DeploymentRequestId == requestId).ToListAsync()) { sr.IsContractSigned = true; sr.IsDepositPaid = true; }
            await contractDb.SaveChangesAsync();
        }
        (await client.PostAsync($"/api/v1/platform/deployment-requests/{requestId}/installation/start", null)).EnsureSuccessStatusCode();
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            var dep = await db.DeploymentRequests.SingleAsync(x => x.Id == requestId);
            db.ServiceRequests.Add(new SmartFarm.Domain.Entities.ServiceRequest
            {
                TenantId = dep.TenantId,
                FarmId = farmId,
                ZoneId = zoneId,
                DeploymentRequestId = requestId,
                CreatedByOwnerId = dep.OwnerUserId,
                Status = ServiceRequestStatus.InProgress,
                FailureCode = "NEW_INSTALL",
                Description = "Service request for deployment deposit",
                IsDepositPaid = true
            });
            await db.SaveChangesAsync();
        }
        var macSuffix = $"{Guid.NewGuid():N}"[..6].ToUpperInvariant();
        var mac = $"94:B9:7E:{macSuffix[0..2]}:{macSuffix[2..4]}:{macSuffix[4..6]}";
        Guid hardwareItemId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            var technicianId = await db.AppUsers.Where(x => x.Email == "technician@example.com").Select(x => x.Id).SingleAsync();
            var item = new PlatformHardwareItem { Code = $"GW-{requestId:N}", Name = "Test Gateway", Category = "Gateway ESP32", QuantityInStock = 1, Status = "InTechnicianStock", AssignedTechnicianId = technicianId, MacAddress = mac, SerialNumber = $"GW-{requestId:N}" };
            db.PlatformHardwareItems.Add(item); await db.SaveChangesAsync(); hardwareItemId = item.Id;
        }
        var enrollment = await client.PostAsJsonAsync("/api/v1/gateway-enrollment/auto", new { macAddress = mac, chipId = $"CHIP-{requestId:N}", gatewaySerial = $"GW-{requestId:N}", bootstrapFirmwareVersion = "1.0.0" }); enrollment.EnsureSuccessStatusCode(); var enrollmentId = await Id(enrollment, "id");
        var activated = await client.PostAsJsonAsync($"/api/v1/gateway-enrollment/{enrollmentId}/activate", new { farmId, deploymentRequestId = requestId, frequencyBand = "433MHz" }); activated.EnsureSuccessStatusCode();
        Guid gatewayId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            gatewayId = await db.Gateways.Where(x => x.MacAddress == mac).Select(x => x.Id).SingleAsync();
        }
        Guid nodeHardwareItemId;
        Guid firmwareReleaseId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            var technicianId = await db.AppUsers.Where(x => x.Email == "technician@example.com").Select(x => x.Id).SingleAsync();
            var nodeItem = new PlatformHardwareItem { Code = $"NODE-{requestId:N}", Name = "Test Nano Node", Category = "Node Arduino Nano", QuantityInStock = 1, Status = "InTechnicianStock", AssignedTechnicianId = technicianId };
            var release = new FirmwareRelease { HardwareTarget = "ARDUINO_NANO_NODE", Version = "test-1.0.0", ProtocolVersion = "1.0", ArtifactUrl = "https://example.invalid/node.hex", ArtifactSha256 = new string('a', 64), Status = FirmwareReleaseStatus.Approved, ApprovedByUserId = technicianId, PublishedAtUtc = DateTime.UtcNow };
            db.PlatformHardwareItems.Add(nodeItem); db.FirmwareReleases.Add(release); await db.SaveChangesAsync(); nodeHardwareItemId = nodeItem.Id; firmwareReleaseId = release.Id;
        }
        var provision = await client.PostAsJsonAsync("/api/v1/devices/provision", new { deploymentRequestId = requestId, gatewayId, farmId, nodes = new[] { new { hardwareAddress = $"NODE-{requestId:N}", deviceType = "SensorNode", deviceModelId = Model, hardwareItemId = nodeHardwareItemId } } }); provision.EnsureSuccessStatusCode(); using var json = JsonDocument.Parse(await provision.Content.ReadAsStringAsync()); var deviceId = json.RootElement.GetProperty("devices")[0].GetProperty("deviceId").GetGuid();
        var prep = await client.PostAsync($"/api/v1/technician/hardware-preparations/{nodeHardwareItemId}/start", null); prep.EnsureSuccessStatusCode(); using var prepJson = JsonDocument.Parse(await prep.Content.ReadAsStringAsync()); var preparationId = prepJson.RootElement.GetProperty("id").GetGuid();
        (await client.PostAsJsonAsync($"/api/v1/technician/hardware-preparations/{preparationId}/firmware", new { firmwareReleaseId, uploadMethod = "UsbManual", result = "Succeeded", boardProfile = "Arduino Nano", notes = "test" })).EnsureSuccessStatusCode();
        (await client.PostAsJsonAsync($"/api/v1/technician/hardware-preparations/{preparationId}/status", new { status = "FirmwarePrepared" })).EnsureSuccessStatusCode();
        (await client.PostAsJsonAsync($"/api/v1/technician/hardware-preparations/{preparationId}/status", new { status = "IdentityVerified", nodeId = $"NODE-ID-{requestId:N}", loRaAddress = 1, boardProfile = "Arduino Nano" })).EnsureSuccessStatusCode();
        (await client.PostAsJsonAsync($"/api/v1/technician/hardware-preparations/{preparationId}/connectivity-check", new { passed = true, evidence = "test connectivity" })).EnsureSuccessStatusCode();
        (await client.PostAsJsonAsync($"/api/v1/technician/hardware-preparations/{preparationId}/status", new { status = "ConnectivityVerified" })).EnsureSuccessStatusCode();
        (await client.PostAsJsonAsync($"/api/v1/technician/hardware-preparations/{preparationId}/status", new { status = "ReadyForDeployment" })).EnsureSuccessStatusCode();
        (await client.PutAsJsonAsync($"/api/v1/devices/{deviceId}/sensors", new { sensors = new[] { new { sensorType = "SoilMoisture", pin = "A0", unit = "%", minValue = 0, maxValue = 100, samplingIntervalSec = 60 } } })).EnsureSuccessStatusCode();
        return new(requestId, deviceId);
    }
    private static object PlanBody() => new { items = new[] { new { deviceModelId = Model, quantity = 1, installationNotes = "one node" } }, notes = "Owner approved" };
    private static async Task CreateSeason(HttpClient client, Guid zoneId) { var response = await client.PostAsJsonAsync($"/api/v1/zones/{zoneId}/planting-seasons", new { cropId = Crop, varietyId = Variety, growthProfileId = Profile, name = $"IoT-{Guid.NewGuid():N}", startDate = "2026-09-24", expectedEndDate = "2026-12-01" }); response.EnsureSuccessStatusCode(); }
    private static async Task Login(HttpClient client, string email) { client.DefaultRequestHeaders.Authorization = null; var response = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = "ValidPassword1!" }); response.EnsureSuccessStatusCode(); using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync()); client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", json.RootElement.GetProperty("accessToken").GetString()); }
    private static async Task<Guid> Id(HttpResponseMessage response, string name) { using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync()); return json.RootElement.GetProperty(name).GetGuid(); }
    private sealed record Setup(Guid RequestId, Guid DeviceId);
}
