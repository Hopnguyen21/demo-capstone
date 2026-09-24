using SmartFarm.Application.Common.Interfaces;

namespace SmartFarm.Api.HostedServices;

public sealed class ControlAutomationWorker(IServiceScopeFactory scopes, TimeProvider clock, ILogger<ControlAutomationWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1), clock);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try { using var scope = scopes.CreateScope(); var control = scope.ServiceProvider.GetRequiredService<IControlService>(); var now = clock.GetUtcNow().UtcDateTime; await control.ExpireTimedOutAsync(now, stoppingToken); await control.DispatchPendingAiCommandsAsync(stoppingToken); await control.ProcessDueSchedulesAsync(now, stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { }
            catch (Exception exception) { logger.LogError(exception, "Control automation cycle failed."); }
        }
    }
}
