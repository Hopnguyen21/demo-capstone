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
    private static readonly TimeSpan CommandTimeout = TimeSpan.FromMinutes(2);
    private static readonly TimeSpan ResultTimeout = TimeSpan.FromMinutes(10);
    private static readonly TimeSpan[] RetryBackoff = [TimeSpan.FromSeconds(10), TimeSpan.FromSeconds(30), TimeSpan.FromMinutes(2)];

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
            var now = DateTime.UtcNow;
            var commandCutoff = now - CommandTimeout;
            var resultCutoff = now - ResultTimeout;
            var jobs = await db.FirmwareJobs
                .Where(x => (x.Status == FirmwareJobStatus.CommandSent && (x.CommandSentAtUtc ?? x.UpdatedAtUtc ?? x.CreatedAtUtc) <= commandCutoff) ||
                            (x.Status == FirmwareJobStatus.InProgress && (x.StartedAtUtc ?? x.UpdatedAtUtc ?? x.CreatedAtUtc) <= resultCutoff) ||
                            (x.Status == FirmwareJobStatus.Failed && x.AttemptCount < RetryBackoff.Length && (x.FinishedAtUtc ?? x.UpdatedAtUtc ?? x.CreatedAtUtc) <= now - RetryBackoff[Math.Min(Math.Max(x.AttemptCount - 1, 0), RetryBackoff.Length - 1)]))
                .ToListAsync(ct);
            if (jobs.Count == 0) return;

            foreach (var job in jobs)
            {
                if (job.Status == FirmwareJobStatus.Failed && job.AttemptCount < RetryBackoff.Length)
                {
                    job.Status = FirmwareJobStatus.Scheduled;
                    job.ScheduledAtUtc = now + RetryBackoff[Math.Min(Math.Max(job.AttemptCount - 1, 0), RetryBackoff.Length - 1)];
                    job.CommandId = null;
                    job.CommandSentAtUtc = null;
                    job.StartedAtUtc = null;
                    job.FinishedAtUtc = null;
                    logger.LogInformation("Scheduled OTA retry {Attempt} for job {JobId}.", job.AttemptCount + 1, job.Id);
                    continue;
                }
                if ((job.Status == FirmwareJobStatus.CommandSent || job.Status == FirmwareJobStatus.InProgress) && job.AttemptCount < RetryBackoff.Length)
                {
                    job.Status = FirmwareJobStatus.Scheduled;
                    job.ScheduledAtUtc = now + RetryBackoff[Math.Min(Math.Max(job.AttemptCount - 1, 0), RetryBackoff.Length - 1)];
                    job.CommandId = null;
                    job.CommandSentAtUtc = null;
                    job.StartedAtUtc = null;
                    job.FinishedAtUtc = null;
                    job.ErrorCode = "OTA_RETRY_SCHEDULED";
                    job.ErrorMessage = "The Gateway did not complete the OTA exchange; a retry was scheduled.";
                    logger.LogInformation("Scheduled OTA timeout retry {Attempt} for job {JobId}.", job.AttemptCount + 1, job.Id);
                    continue;
                }
                var commandTimedOut = job.Status == FirmwareJobStatus.CommandSent;
                job.Status = FirmwareJobStatus.TimedOut;
                job.FinishedAtUtc = now;
                job.ErrorCode = commandTimedOut ? "OTA_COMMAND_TIMEOUT" : "OTA_RESULT_TIMEOUT";
                job.ErrorMessage = "Gateway did not complete the OTA exchange within the configured timeout.";
            }
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
