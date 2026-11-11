using Microsoft.EntityFrameworkCore;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;

namespace SmartFarm.Api.HostedServices;

public sealed class DeviceLivenessWorker(
    IServiceScopeFactory scopes,
    TimeProvider clock,
    ILogger<DeviceLivenessWorker> logger) : BackgroundService
{
    private static readonly TimeSpan CheckInterval = TimeSpan.FromSeconds(15);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
                var now = clock.GetUtcNow().UtcDateTime;

                await CheckLivenessOnceAsync(db, now, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Device liveness check failed");
            }

            await Task.Delay(CheckInterval, stoppingToken);
        }
    }

    /// <summary>
    /// Executes a single sweep of liveness evaluation for all online devices.
    /// Can be called directly by background worker or unit/integration tests with simulated clock.
    /// </summary>
    public async Task<int> CheckLivenessOnceAsync(SmartFarmDbContext db, DateTime now, CancellationToken ct)
    {
        // Query only devices currently marked as Online
        var onlineDevices = await db.Devices
            .Include(x => x.Gateway)
            .Where(x => x.Status == DeviceStatus.Online)
            .ToListAsync(ct);

        // Find devices whose heartbeat / telemetry has timed out
        // Protect MaintenanceRequired, Decommissioned, and Unassigned states
        var stale = onlineDevices
            .Where(x => x.Status != DeviceStatus.MaintenanceRequired &&
                        x.Status != DeviceStatus.Decommissioned &&
                        x.Status != DeviceStatus.Unassigned &&
                        (x.LastSeenAtUtc == null || x.LastSeenAtUtc < now - DeviceLivenessWindow(x)))
            .ToList();

        foreach (var device in stale)
        {
            device.Status = DeviceStatus.Offline;
            logger.LogInformation(
                "Device {DeviceId} ({HardwareAddress}) marked Offline after heartbeat timeout (LastSeen: {LastSeen})",
                device.Id,
                device.HardwareAddress,
                device.LastSeenAtUtc);
        }

        if (stale.Count > 0)
        {
            await db.SaveChangesAsync(ct);
        }

        return stale.Count;
    }

    public static TimeSpan DeviceLivenessWindow(Device device)
    {
        // Follow device-specific interval with fallback to gateway interval (clamped 5s to 86400s)
        var rawInterval = device.HeartbeatIntervalSeconds ?? (device.Gateway != null ? device.Gateway.TelemetryIntervalSec : 60);
        var intervalSeconds = Math.Clamp(rawInterval, 5, 86400);

        var rawSamples = device.Gateway != null ? device.Gateway.SamplesPerInterval : 1;
        var samplesPerInterval = Math.Clamp(rawSamples, 1, 100);

        // Use 64-bit arithmetic to prevent any potential integer overflow when calculating TimeSpan
        long totalSeconds = ((long)intervalSeconds * samplesPerInterval) + intervalSeconds;
        // Cap maximum window at 7 days
        totalSeconds = Math.Min(totalSeconds, 7L * 86400);

        return TimeSpan.FromSeconds(totalSeconds);
    }
}
