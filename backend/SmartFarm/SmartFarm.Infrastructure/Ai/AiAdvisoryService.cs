using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SmartFarm.Application.Common.Exceptions;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Application.Features.Ai;
using SmartFarm.Application.Features.Control;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;

namespace SmartFarm.Infrastructure.Ai;

public sealed class AiAdvisoryService(
    SmartFarmDbContext db,
    IAiAdvisoryProvider provider,
    IAiWeatherProvider weatherProvider,
    IControlService controlService,
    IOptions<AiOptions> options,
    TimeProvider clock) : IAiAdvisoryService
{
    private readonly AiOptions settings = options.Value;

    public async Task<AiZoneContext> GetContextAsync(Guid ownerId, Guid tenantId, Guid zoneId, CancellationToken cancellationToken)
    {
        var zone = await EnsureOwnerZoneAsync(ownerId, tenantId, zoneId, cancellationToken);
        return await BuildContextAsync(zone, cancellationToken);
    }

    public Task<AiRecommendationView> AskAsync(Guid ownerId, Guid tenantId, Guid zoneId, AskAiCommand command, CancellationToken cancellationToken) =>
        AskInternalAsync(ownerId, tenantId, zoneId, command, true, cancellationToken);

    public async Task<AiDecisionResult> DecideAsync(Guid ownerId, Guid tenantId, Guid zoneId, DecideRecommendationCommand command, CancellationToken cancellationToken)
    {
        await EnsureOwnerZoneAsync(ownerId, tenantId, zoneId, cancellationToken);
        var recommendation = await db.AiRecommendations
            .Include(x => x.ConsultationRequest)
            .Include(x => x.Decisions)
            .SingleOrDefaultAsync(x => x.Id == command.RecommendationId && x.ZoneId == zoneId && x.TenantId == tenantId, cancellationToken)
            ?? throw new ResourceNotFoundException("AI recommendation was not found in this Zone.");

        if (recommendation.Decisions.Count > 0)
            throw new ResourceConflictException("This recommendation already has an Owner decision.");

        var reason = Optional(command.Reason, 1000);
        var decision = new AiRecommendationDecision
        {
            RecommendationId = recommendation.Id,
            OwnerUserId = ownerId,
            DecisionType = command.Decision,
            Reason = reason
        };

        ActuatorCommandView? actuatorCommand = null;
        AiRecommendationView? followUp = null;
        switch (command.Decision)
        {
            case AiRecommendationDecisionType.Accepted:
                ValidateAcceptable(recommendation);
                await EnsureStageIsCurrentAsync(recommendation, cancellationToken);
                await using (var transaction = await db.Database.BeginTransactionAsync(cancellationToken))
                {
                    actuatorCommand = await controlService.CreateAiApprovedCommandAsync(
                        ownerId, tenantId, zoneId, recommendation.Id,
                        recommendation.ProposedActuatorId!.Value,
                        recommendation.ProposedAction!.Value,
                        recommendation.ProposedDurationSeconds!.Value,
                        cancellationToken);
                    recommendation.Status = AiRecommendationStatus.Accepted;
                    decision.ActuatorCommandId = actuatorCommand.CommandId;
                    db.AiRecommendationDecisions.Add(decision);
                    await db.SaveChangesAsync(cancellationToken);
                    await transaction.CommitAsync(cancellationToken);
                }
                actuatorCommand = await controlService.DispatchPendingCommandAsync(actuatorCommand.CommandId, cancellationToken);
                break;
            case AiRecommendationDecisionType.Rejected:
                if (string.IsNullOrWhiteSpace(reason))
                    throw new RequestValidationException("reason", "A rejection reason is required.");
                recommendation.Status = AiRecommendationStatus.Rejected;
                db.AiRecommendationDecisions.Add(decision);
                await db.SaveChangesAsync(cancellationToken);
                break;
            case AiRecommendationDecisionType.Ignored:
                recommendation.Status = AiRecommendationStatus.Ignored;
                db.AiRecommendationDecisions.Add(decision);
                await db.SaveChangesAsync(cancellationToken);
                break;
            case AiRecommendationDecisionType.MoreAnalysisRequested:
                var followUpQuestion = Required(command.FollowUpQuestion, "followUpQuestion", 2000, 3);
                await EnsureRateLimitAsync(ownerId, zoneId, cancellationToken);
                recommendation.Status = AiRecommendationStatus.Superseded;
                db.AiRecommendationDecisions.Add(decision);
                await db.SaveChangesAsync(cancellationToken);
                followUp = await AskInternalAsync(ownerId, tenantId, zoneId, new AskAiCommand(followUpQuestion, recommendation.Id), false, cancellationToken);
                decision.FollowUpConsultationId = followUp.ConsultationRequestId;
                await db.SaveChangesAsync(cancellationToken);
                break;
            default:
                throw new RequestValidationException("decision", "Unsupported recommendation decision.");
        }

        return new AiDecisionResult(ToView(recommendation), ToView(decision), actuatorCommand, followUp);
    }

    public async Task<AiHistoryView> GetHistoryAsync(Guid ownerId, Guid tenantId, Guid zoneId, CancellationToken cancellationToken)
    {
        await EnsureOwnerZoneAsync(ownerId, tenantId, zoneId, cancellationToken);
        var from = clock.GetUtcNow().UtcDateTime.AddDays(-30);
        var rows = await db.AiRecommendations.AsNoTracking()
            .Include(x => x.ConsultationRequest)
            .Where(x => x.TenantId == tenantId && x.ZoneId == zoneId && x.CreatedAtUtc >= from && x.ConsultationRequest.HiddenAtUtc == null)
            .OrderByDescending(x => x.CreatedAtUtc)
            .ToListAsync(cancellationToken);
        return new AiHistoryView(zoneId, rows.Select(ToView).ToList());
    }

    public async Task HideHistoryAsync(Guid ownerId, Guid tenantId, Guid zoneId, CancellationToken cancellationToken)
    {
        await EnsureOwnerZoneAsync(ownerId, tenantId, zoneId, cancellationToken);
        var now = clock.GetUtcNow().UtcDateTime;
        var rows = await db.AiConsultationRequests.Where(x => x.TenantId == tenantId && x.ZoneId == zoneId && x.HiddenAtUtc == null).ToListAsync(cancellationToken);
        foreach (var row in rows) row.HiddenAtUtc = now;
        await db.SaveChangesAsync(cancellationToken);
    }

    private async Task<AiRecommendationView> AskInternalAsync(Guid ownerId, Guid tenantId, Guid zoneId, AskAiCommand command, bool checkRateLimit, CancellationToken cancellationToken)
    {
        var question = Required(command.Question, "question", 2000, 3);
        RejectPromptInjection(question);
        var zone = await EnsureOwnerZoneAsync(ownerId, tenantId, zoneId, cancellationToken);
        if (checkRateLimit) await EnsureRateLimitAsync(ownerId, zoneId, cancellationToken);
        if (command.ParentRecommendationId.HasValue && !await db.AiRecommendations.AnyAsync(x => x.Id == command.ParentRecommendationId && x.ZoneId == zoneId && x.TenantId == tenantId, cancellationToken))
            throw new ResourceNotFoundException("Parent recommendation was not found in this Zone.");

        var now = clock.GetUtcNow().UtcDateTime;
        var context = await BuildContextAsync(zone, cancellationToken);
        var request = new AiConsultationRequest
        {
            TenantId = tenantId,
            FarmId = zone.Field.FarmId,
            ZoneId = zoneId,
            RequestedByUserId = ownerId,
            ParentRecommendationId = command.ParentRecommendationId,
            Question = question,
            ContextSnapshotJson = JsonSerializer.Serialize(context),
            MissingDataCsv = context.MissingData.Count == 0 ? null : string.Join(',', context.MissingData),
            Status = AiConsultationStatus.Pending
        };
        db.AiConsultationRequests.Add(request);
        await db.SaveChangesAsync(cancellationToken);

        AiRecommendation recommendation;
        if (!context.IsSufficientForAdvice)
        {
            recommendation = CreateLimited(request, context, AiRecommendationStatus.InsufficientData,
                "Insufficient data for reliable advice",
                "The system did not call the AI provider because required Farm context is incomplete.",
                context.MissingData.Select(x => $"Missing or stale: {x}"), now);
            request.Status = AiConsultationStatus.Limited;
        }
        else
        {
            try
            {
                var result = await provider.GenerateAsync(new AiProviderRequest(question, context), cancellationToken);
                recommendation = await FromProviderAsync(request, context, result, now, cancellationToken);
                request.ProviderName = Optional(result.ProviderName, 100) ?? "Unknown";
                request.Status = recommendation.Status == AiRecommendationStatus.Ready ? AiConsultationStatus.Completed : AiConsultationStatus.Limited;
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                recommendation = CreateLimited(request, context, AiRecommendationStatus.ProviderUnavailable,
                    "AI analysis is currently unavailable",
                    "No advice was generated because the configured AI provider failed.",
                    [SafeProviderFailure(ex)], now);
                request.ProviderName = "Unavailable";
                request.Status = AiConsultationStatus.Failed;
            }
        }

        request.CompletedAtUtc = now;
        db.AiRecommendations.Add(recommendation);
        await db.SaveChangesAsync(cancellationToken);
        return ToView(recommendation);
    }

    private async Task<AiRecommendation> FromProviderAsync(AiConsultationRequest request, AiZoneContext context, AiProviderResult result, DateTime now, CancellationToken cancellationToken)
    {
        var limitations = result.Limitations.Select(x => Optional(x, 500)).Where(x => x is not null).Cast<string>().ToList();
        var confidence = Math.Clamp(result.Confidence, 0, 1);
        var status = confidence < settings.MinimumConfidence ? AiRecommendationStatus.LowConfidence : AiRecommendationStatus.Ready;
        var actionable = false;
        Guid? actuatorId = null;
        ActuatorCommandAction? action = null;
        int? duration = null;

        if (result.ProposedControlAction is not null && status == AiRecommendationStatus.Ready)
        {
            var actuator = await db.DeviceActuators.AsNoTracking().Include(x => x.Device)
                .SingleOrDefaultAsync(x => x.Id == result.ProposedControlAction.ActuatorId && x.Device.ZoneId == request.ZoneId, cancellationToken);
            var maxDuration = actuator is null ? 0 : Math.Min(1800, actuator.MaxDurationMinutes * 60);
            if (actuator is null || result.ProposedControlAction.DurationSeconds < 1 || result.ProposedControlAction.DurationSeconds > maxDuration)
            {
                status = AiRecommendationStatus.InvalidProviderOutput;
                limitations.Add("The provider proposed an actuator or duration that is not valid for this Zone.");
            }
            else
            {
                actionable = true;
                actuatorId = actuator.Id;
                action = result.ProposedControlAction.Action;
                duration = result.ProposedControlAction.DurationSeconds;
            }
        }

        if (status == AiRecommendationStatus.LowConfidence)
            limitations.Add($"Provider confidence {confidence:0.00} is below the required {settings.MinimumConfidence:0.00} threshold.");

        return new AiRecommendation
        {
            ConsultationRequestId = request.Id,
            ConsultationRequest = request,
            TenantId = request.TenantId,
            FarmId = request.FarmId,
            ZoneId = request.ZoneId,
            GrowthStageId = context.GrowthStageId,
            Summary = Required(result.Summary, "provider.summary", 500, 1),
            Details = Required(result.Details, "provider.details", 4000, 1),
            Limitations = JoinLimitations(limitations),
            Confidence = confidence,
            Status = status,
            IsActionable = actionable,
            ValidUntilUtc = now.AddMinutes(settings.RecommendationValidityMinutes),
            ProposedActuatorId = actuatorId,
            ProposedAction = action,
            ProposedDurationSeconds = duration
        };
    }

    private async Task<AiZoneContext> BuildContextAsync(Zone zone, CancellationToken cancellationToken)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        var season = await db.PlantingSeasons.AsNoTracking()
            .Include(x => x.Crop).Include(x => x.Variety).Include(x => x.GrowthProfile).Include(x => x.CurrentGrowthStage).Include(x => x.AppliedRequirements)
            .SingleOrDefaultAsync(x => x.ZoneId == zone.Id && x.Status == PlantingSeasonStatus.InProgress, cancellationToken);
        var readings = await db.TelemetryReadings.AsNoTracking().Where(x => x.ZoneId == zone.Id)
            .OrderByDescending(x => x.CapturedAtUtc).ToListAsync(cancellationToken);
        var telemetry = readings.GroupBy(x => x.ParameterCode).Select(x => x.First()).Select(x =>
            new AiTelemetryContextItem(x.ParameterCode, x.Value, x.Unit, x.CapturedAtUtc, x.CapturedAtUtc >= now.AddMinutes(-settings.TelemetryFreshnessMinutes))).ToList();
        AiWeatherResult weather;
        try { weather = await weatherProvider.GetAsync(zone.Field.FarmId, zone.Id, cancellationToken); }
        catch (Exception ex) when (ex is not OperationCanceledException) { weather = new(false, null, null, null, null, SafeProviderFailure(ex)); }

        var missing = new List<string>();
        if (season is null) missing.Add("active planting season");
        if (season?.Crop is null) missing.Add("crop");
        if (season?.GrowthProfile is null) missing.Add("growth profile");
        if (season?.CurrentGrowthStage is null) missing.Add("growth stage");
        if (!telemetry.Any(x => x.IsFresh)) missing.Add("fresh telemetry");
        if (!weather.Available) missing.Add("weather");

        return new AiZoneContext(
            zone.Field.FarmId, zone.Field.Farm.Name, zone.Field.Farm.TimeZone, zone.FieldId, zone.Field.Name, zone.Id, zone.Name, zone.AreaM2,
            season?.Id, season?.Crop.Name, season?.Variety?.Name, season?.GrowthProfileId, season?.GrowthProfile.Name,
            season is null ? null : Math.Max(0, DateOnly.FromDateTime(now).DayNumber - season.StartDate.DayNumber),
            season?.CurrentGrowthStageId, season?.CurrentGrowthStage.Name,
            season?.AppliedRequirements.Select(x => new AiRequirementContextItem(x.ParameterCode, x.MinValue, x.MaxValue, x.TargetValue, x.Unit)).ToList() ?? [],
            telemetry,
            new AiWeatherContext(weather.Available, weather.Summary, weather.RainProbabilityPercent, weather.TemperatureCelsius, weather.ObservedAtUtc, weather.Limitation),
            missing,
            missing.Count == 0);
    }

    private AiRecommendation CreateLimited(AiConsultationRequest request, AiZoneContext context, AiRecommendationStatus status, string summary, string details, IEnumerable<string> limitations, DateTime now) => new()
    {
        ConsultationRequestId = request.Id, ConsultationRequest = request, TenantId = request.TenantId, FarmId = request.FarmId, ZoneId = request.ZoneId,
        GrowthStageId = context.GrowthStageId, Summary = summary, Details = details,
        Limitations = JoinLimitations(limitations), Confidence = 0, Status = status, IsActionable = false,
        ValidUntilUtc = now.AddMinutes(settings.RecommendationValidityMinutes)
    };

    private async Task EnsureRateLimitAsync(Guid ownerId, Guid zoneId, CancellationToken cancellationToken)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        var from = now.AddMinutes(-settings.RateLimitWindowMinutes);
        var recent = await db.AiConsultationRequests.AsNoTracking().Where(x => x.RequestedByUserId == ownerId && x.ZoneId == zoneId && x.CreatedAtUtc >= from).OrderBy(x => x.CreatedAtUtc).ToListAsync(cancellationToken);
        if (recent.Count < settings.MaxRequestsPerWindow) return;
        var retryAt = recent[0].CreatedAtUtc.AddMinutes(settings.RateLimitWindowMinutes);
        throw new RateLimitExceededException("AI consultation rate limit exceeded for this Zone.", Math.Max(1, (int)Math.Ceiling((retryAt - now).TotalSeconds)));
    }

    private async Task<Zone> EnsureOwnerZoneAsync(Guid ownerId, Guid tenantId, Guid zoneId, CancellationToken cancellationToken)
    {
        var owner = await db.AppUsers.AsNoTracking().SingleOrDefaultAsync(x => x.Id == ownerId, cancellationToken) ?? throw new AuthorizationException();
        if (owner.Role != UserRole.FarmOwner || owner.TenantId != tenantId) throw new AuthorizationException("Only the Farm Owner can use AI advisory decisions.");
        return await db.Zones.AsNoTracking().Include(x => x.Field).ThenInclude(x => x.Farm)
            .SingleOrDefaultAsync(x => x.Id == zoneId && x.Field.Farm.TenantId == tenantId, cancellationToken)
            ?? throw new ResourceNotFoundException("Zone was not found in the current Tenant.");
    }

    private async Task EnsureStageIsCurrentAsync(AiRecommendation recommendation, CancellationToken cancellationToken)
    {
        if (!recommendation.GrowthStageId.HasValue || !await db.PlantingSeasons.AsNoTracking().AnyAsync(x => x.ZoneId == recommendation.ZoneId && x.Status == PlantingSeasonStatus.InProgress && x.CurrentGrowthStageId == recommendation.GrowthStageId, cancellationToken))
            throw new ResourceConflictException("The planting season or growth stage changed; request a new analysis.");
    }

    private void ValidateAcceptable(AiRecommendation recommendation)
    {
        if (recommendation.Status != AiRecommendationStatus.Ready || !recommendation.IsActionable || recommendation.Confidence < settings.MinimumConfidence || !recommendation.ProposedActuatorId.HasValue || !recommendation.ProposedAction.HasValue || !recommendation.ProposedDurationSeconds.HasValue)
            throw new ResourceConflictException("Recommendation is not actionable or does not meet the confidence threshold.");
        if (recommendation.ValidUntilUtc <= clock.GetUtcNow().UtcDateTime)
            throw new ResourceConflictException("Recommendation has expired; request a new analysis.");
    }

    private static void RejectPromptInjection(string question)
    {
        var normalized = question.ToLowerInvariant();
        string[] blocked = ["ignore previous instructions", "ignore all instructions", "system prompt", "developer message", "bỏ qua hướng dẫn trước"];
        if (question.IndexOf('\0') >= 0 || blocked.Any(normalized.Contains))
            throw new RequestValidationException("question", "Question contains instruction-manipulation content and was not sent to the AI provider.");
    }

    private static string Required(string? value, string field, int max, int min)
    {
        var result = value?.Trim();
        if (string.IsNullOrWhiteSpace(result) || result.Length < min || result.Length > max)
            throw new RequestValidationException(field, $"{field} must contain between {min} and {max} characters.");
        return result;
    }

    private static string? Optional(string? value, int max)
    {
        var result = value?.Trim();
        if (string.IsNullOrEmpty(result)) return null;
        return result.Length <= max ? result : result[..max];
    }

    private static string SafeProviderFailure(Exception exception) => $"External provider unavailable ({exception.GetType().Name}); no values were fabricated.";
    private static string? JoinLimitations(IEnumerable<string> limitations)
    {
        var value = string.Join(" | ", limitations.Where(x => !string.IsNullOrWhiteSpace(x)));
        if (value.Length == 0) return null;
        return value.Length <= 2000 ? value : value[..2000];
    }
    private static IReadOnlyList<string> ParseLimitations(string? value) => string.IsNullOrWhiteSpace(value) ? [] : value.Split(" | ", StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
    private static AiRecommendationView ToView(AiRecommendation x) => new(x.Id, x.ConsultationRequestId, x.ZoneId, x.ConsultationRequest.Question, x.Summary, x.Details, ParseLimitations(x.Limitations), x.Confidence, x.Status, x.IsActionable, x.ValidUntilUtc, x.ProposedActuatorId, x.ProposedAction, x.ProposedDurationSeconds, x.CreatedAtUtc);
    private static AiDecisionView ToView(AiRecommendationDecision x) => new(x.Id, x.RecommendationId, x.DecisionType, x.Reason, x.CreatedAtUtc, x.ActuatorCommandId, x.FollowUpConsultationId);
}
