using Microsoft.EntityFrameworkCore;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;

namespace SmartFarm.Api.HostedServices;

/// <summary>
/// Closes OTA jobs that never produce a terminal device result. A Gateway may
/// disappear immediately after OTA_STARTED; leaving the job InProgress would
/// block every later update forever.
/// </summary>
public sealed class FirmwareJobTimeoutWorker(
    IServiceScopeFactory scopeFactory,
    ILogger<FirmwareJobTimeoutWorker> logger) : BackgroundService
{
    private static readonly TimeSpan PollInterval = TimeSpan.FromMinutes(1);
    private static readonly TimeSpan ResultTimeout = TimeSpan.FromMinutes(10);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await ExpireAsync(stoppingToken);
        using var timer = new PeriodicTimer(PollInterval);
        while (await timer.WaitForNextTickAsync(stoppingToken))
            await ExpireAsync(stoppingToken);
    }

    private async Task ExpireAsync(CancellationToken ct)
    {
        try
        {
            using var scope = scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            var cutoff = DateTime.UtcNow - ResultTimeout;
            var jobs = await db.FirmwareJobs
                .Where(x => x.Status == FirmwareJobStatus.InProgress && (x.UpdatedAtUtc ?? x.CreatedAtUtc) <= cutoff)
                .ToListAsync(ct);
            if (jobs.Count == 0) return;

            foreach (var job in jobs)
                job.Status = FirmwareJobStatus.Failed;
            await db.SaveChangesAsync(ct);
            logger.LogWarning("Marked {Count} OTA job(s) as Failed after the device result timeout.", jobs.Count);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { }
        catch (Exception ex)
        {
            logger.LogError(ex, "Firmware OTA timeout reconciliation failed; will retry later.");
        }
    }
}
