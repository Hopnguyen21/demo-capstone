using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using SmartFarm.Api.HostedServices;
using SmartFarm.Application.Common.Exceptions;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Application.Features.IoTDeployment;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;
using Xunit;

namespace SmartFarm.Api.Tests;

public class DeviceHeartbeatLivenessTests
{
    private static SmartFarmDbContext CreateInMemoryDb(string dbName)
    {
        var options = new DbContextOptionsBuilder<SmartFarmDbContext>()
            .UseInMemoryDatabase(dbName)
            .Options;
        return new SmartFarmDbContext(options);
    }

    [Fact]
    public void DeviceLivenessWindow_ClampsBounds_AndPreventsOverflow()
    {
        // 1. Device with custom heartbeat interval
        var dev = new Device
        {
            HeartbeatIntervalSeconds = 120,
            Gateway = new Gateway
            {
                TelemetryIntervalSec = 60,
                SamplesPerInterval = 2
            }
        };

        var window = DeviceLivenessWorker.DeviceLivenessWindow(dev);
        // (120 * 2) + 120 = 360 seconds
        Assert.Equal(TimeSpan.FromSeconds(360), window);

        // 2. Device with null heartbeat interval falls back to Gateway
        var devFallback = new Device
        {
            HeartbeatIntervalSeconds = null,
            Gateway = new Gateway
            {
                TelemetryIntervalSec = 30,
                SamplesPerInterval = 1
            }
        };
        var windowFallback = DeviceLivenessWorker.DeviceLivenessWindow(devFallback);
        // (30 * 1) + 30 = 60 seconds
        Assert.Equal(TimeSpan.FromSeconds(60), windowFallback);

        // 3. Clamping lower bound (e.g. 1 sec clamped to 5 sec)
        var devSmall = new Device
        {
            HeartbeatIntervalSeconds = 1,
            Gateway = new Gateway { TelemetryIntervalSec = 1, SamplesPerInterval = 1 }
        };
        var windowSmall = DeviceLivenessWorker.DeviceLivenessWindow(devSmall);
        // (5 * 1) + 5 = 10 seconds
        Assert.Equal(TimeSpan.FromSeconds(10), windowSmall);

        // 4. Clamping upper bound and avoiding overflow with huge values
        var devHuge = new Device
        {
            HeartbeatIntervalSeconds = int.MaxValue,
            Gateway = new Gateway { TelemetryIntervalSec = 1000000, SamplesPerInterval = int.MaxValue }
        };
        var windowHuge = DeviceLivenessWorker.DeviceLivenessWindow(devHuge);
        // Capped at 7 days maximum window without overflow
        Assert.True(windowHuge.TotalDays <= 7.0);
        Assert.True(windowHuge.TotalSeconds > 0);
    }

    [Fact]
    public async Task CheckLivenessOnceAsync_MarksTimedOutDeviceOffline_AndPreservesSpecialStatuses()
    {
        var dbName = Guid.NewGuid().ToString();
        await using var db = CreateInMemoryDb(dbName);

        var farmId = Guid.NewGuid();
        var zoneId = Guid.NewGuid();
        var gwId = Guid.NewGuid();

        var gateway = new Gateway
        {
            Id = gwId,
            FarmId = farmId,
            DeploymentRequestId = Guid.NewGuid(),
            MacAddress = "00:11:22:33:44:55",
            GatewaySerial = "GW-001",
            FrequencyBand = "AS923",
            FirmwareVersion = "v1.0",
            MqttClientId = "gw-client-1",
            ClientCertificateFingerprint = new string('A', 64),
            TelemetryIntervalSec = 60,
            SamplesPerInterval = 1,
            Status = GatewayStatus.Online
        };
        db.Gateways.Add(gateway);

        var now = DateTime.UtcNow;

        // 1. Online device with fresh heartbeat (LastSeen 10s ago, window 120s) -> should remain Online
        var freshDevice = new Device
        {
            Id = Guid.NewGuid(),
            FarmId = farmId,
            GatewayId = gwId,
            DeploymentRequestId = Guid.NewGuid(),
            ZoneId = zoneId,
            HardwareAddress = "DEV-FRESH",
            DeviceType = DeviceType.SensorNode,
            Status = DeviceStatus.Online,
            HeartbeatIntervalSeconds = 60,
            LastSeenAtUtc = now.AddSeconds(-10)
        };

        // 2. Online device with stale heartbeat (LastSeen 500s ago, window 120s) -> should become Offline
        var staleDevice = new Device
        {
            Id = Guid.NewGuid(),
            FarmId = farmId,
            GatewayId = gwId,
            DeploymentRequestId = Guid.NewGuid(),
            ZoneId = zoneId,
            HardwareAddress = "DEV-STALE",
            DeviceType = DeviceType.SensorNode,
            Status = DeviceStatus.Online,
            HeartbeatIntervalSeconds = 60,
            LastSeenAtUtc = now.AddSeconds(-500)
        };

        // 3. MaintenanceRequired device with stale heartbeat -> must NOT be overwritten with Offline
        var maintDevice = new Device
        {
            Id = Guid.NewGuid(),
            FarmId = farmId,
            GatewayId = gwId,
            DeploymentRequestId = Guid.NewGuid(),
            ZoneId = zoneId,
            HardwareAddress = "DEV-MAINT",
            DeviceType = DeviceType.SensorNode,
            Status = DeviceStatus.MaintenanceRequired,
            HeartbeatIntervalSeconds = 60,
            LastSeenAtUtc = now.AddSeconds(-500)
        };

        // 4. Decommissioned device -> must NOT be overwritten
        var decommDevice = new Device
        {
            Id = Guid.NewGuid(),
            FarmId = farmId,
            GatewayId = gwId,
            DeploymentRequestId = Guid.NewGuid(),
            ZoneId = zoneId,
            HardwareAddress = "DEV-DECOMM",
            DeviceType = DeviceType.SensorNode,
            Status = DeviceStatus.Decommissioned,
            HeartbeatIntervalSeconds = 60,
            LastSeenAtUtc = now.AddSeconds(-500)
        };

        // 5. Unassigned device -> must NOT be overwritten
        var unassignedDevice = new Device
        {
            Id = Guid.NewGuid(),
            FarmId = farmId,
            GatewayId = gwId,
            DeploymentRequestId = Guid.NewGuid(),
            ZoneId = null,
            HardwareAddress = "DEV-UNASSIGNED",
            DeviceType = DeviceType.SensorNode,
            Status = DeviceStatus.Unassigned,
            HeartbeatIntervalSeconds = 60,
            LastSeenAtUtc = now.AddSeconds(-500)
        };

        db.Devices.AddRange(freshDevice, staleDevice, maintDevice, decommDevice, unassignedDevice);
        await db.SaveChangesAsync();

        // Create worker instance
        var services = new ServiceCollection();
        services.AddScoped(_ => CreateInMemoryDb(dbName));
        var sp = services.BuildServiceProvider();
        var scopeFactory = sp.GetRequiredService<IServiceScopeFactory>();

        var worker = new DeviceLivenessWorker(scopeFactory, TimeProvider.System, NullLogger<DeviceLivenessWorker>.Instance);

        var staleCount = await worker.CheckLivenessOnceAsync(db, now, CancellationToken.None);

        Assert.Equal(1, staleCount);

        // Verify outcomes in DB
        var freshFromDb = await db.Devices.FindAsync(freshDevice.Id);
        Assert.NotNull(freshFromDb);
        Assert.Equal(DeviceStatus.Online, freshFromDb.Status);

        var staleFromDb = await db.Devices.FindAsync(staleDevice.Id);
        Assert.NotNull(staleFromDb);
        Assert.Equal(DeviceStatus.Offline, staleFromDb.Status);

        var maintFromDb = await db.Devices.FindAsync(maintDevice.Id);
        Assert.NotNull(maintFromDb);
        Assert.Equal(DeviceStatus.MaintenanceRequired, maintFromDb.Status);

        var decommFromDb = await db.Devices.FindAsync(decommDevice.Id);
        Assert.NotNull(decommFromDb);
        Assert.Equal(DeviceStatus.Decommissioned, decommFromDb.Status);

        var unassignedFromDb = await db.Devices.FindAsync(unassignedDevice.Id);
        Assert.NotNull(unassignedFromDb);
        Assert.Equal(DeviceStatus.Unassigned, unassignedFromDb.Status);
    }
}

