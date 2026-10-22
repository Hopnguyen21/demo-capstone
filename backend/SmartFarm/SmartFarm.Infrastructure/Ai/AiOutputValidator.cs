using SmartFarm.Application.Features.Ai;

namespace SmartFarm.Infrastructure.Ai;

public static class AiOutputValidator
{
    /// <summary>Trả về hành động đã được kiểm chứng, hoặc null nếu không an toàn.</summary>
    public static AiProposedControlAction? ValidateAction(
        AiProviderResult result, AiZoneContext context, decimal minConfidence)
    {
        var a = result.ProposedControlAction;
        if (a is null || result.Confidence < minConfidence) return null;

        var actuator = context.Actuators.FirstOrDefault(x => x.ActuatorId == a.ActuatorId);
        if (actuator is not { IsOnline: true }) return null;
        if (a.DurationSeconds <= 0 || a.DurationSeconds > actuator.MaxDurationSeconds) return null;
        if (!context.Telemetry.Any(t => t.IsFresh)) return null;
        return a;
    }
}
