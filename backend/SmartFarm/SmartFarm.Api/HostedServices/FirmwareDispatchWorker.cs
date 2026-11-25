using SmartFarm.Application.Common.Interfaces;

namespace SmartFarm.Api.HostedServices;

public sealed class FirmwareDispatchWorker(
    IServiceScopeFactory scopeFactory,
    ILogger<FirmwareDispatchWorker> logger) : BackgroundService
{
    private static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(5);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var service = scope.ServiceProvider.GetRequiredService<IIoTDeploymentService>();
                var sent = await service.DispatchDueFirmwareJobsAsync(stoppingToken);
                if (sent > 0) logger.LogInformation("Dispatched {Count} scheduled OTA command(s) through MQTT.", sent);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { }
            catch (Exception ex) { logger.LogError(ex, "Firmware OTA dispatch failed; will retry on the next cycle."); }

            try { await Task.Delay(PollInterval, stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { }
        }
    }
}
