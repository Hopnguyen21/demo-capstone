using SmartFarm.Application.Common.Interfaces;

namespace SmartFarm.Api.HostedServices;

public sealed class ControlAutomationWorker(IServiceScopeFactory scopes, TimeProvider clock, ILogger<ControlAutomationWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Schedules are minute-based, but a one-minute polling interval can
        // dispatch a one-minute irrigation run almost at its end. Poll more
        // frequently so a due schedule is dispatched within a few seconds.
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(5), clock);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try { using var scope = scopes.CreateScope(); var control = scope.ServiceProvider.GetRequiredService<IControlService>(); var now = clock.GetUtcNow().UtcDateTime; await control.ExpireTimedOutAsync(now, stoppingToken); await control.DispatchPendingAiCommandsAsync(stoppingToken); await control.ProcessDueSchedulesAsync(now, stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { }
            catch (Exception exception) { logger.LogError(exception, "Control automation cycle failed."); }
        }
    }
}
