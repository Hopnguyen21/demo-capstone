using Microsoft.EntityFrameworkCore;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;

namespace SmartFarm.Api.HostedServices;

public sealed class GatewayLivenessWorker(
    IServiceScopeFactory scopes,
    TimeProvider clock,
    ILogger<GatewayLivenessWorker> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromSeconds(15);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
                var now = clock.GetUtcNow().UtcDateTime;
                var onlineGateways = await db.Gateways
                    .Where(x => x.Status == GatewayStatus.Online)
                    .ToListAsync(stoppingToken);
                var stale = onlineGateways
                    .Where(x => x.LastSeenAtUtc == null ||
                                x.LastSeenAtUtc < now - LivenessWindow(x))
                    .ToList();
                foreach (var gateway in stale)
                {
                    gateway.Status = GatewayStatus.Offline;
                    logger.LogInformation("Gateway {GatewayId} marked Offline after liveness timeout", gateway.Id);
                }
                if (stale.Count > 0) await db.SaveChangesAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { }
            catch (Exception ex) { logger.LogWarning(ex, "Gateway liveness check failed"); }
            await Task.Delay(Interval, stoppingToken);
        }
    }

    private static TimeSpan LivenessWindow(SmartFarm.Domain.Entities.Gateway gateway)
    {
        var intervalSeconds = Math.Max(1, gateway.TelemetryIntervalSec);
        var samplesPerInterval = Math.Max(1, gateway.SamplesPerInterval);

        // One configured cycle plus one cycle of grace while the next packet
        // is travelling through MQTT and being persisted.
        return TimeSpan.FromSeconds((intervalSeconds * samplesPerInterval) + intervalSeconds);
    }
}
