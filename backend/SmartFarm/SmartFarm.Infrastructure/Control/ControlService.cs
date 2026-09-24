using Microsoft.EntityFrameworkCore;
using SmartFarm.Application.Common.Exceptions;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Application.Features.Control;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;

namespace SmartFarm.Infrastructure.Control;

public sealed class ControlService(SmartFarmDbContext db, IActuatorCommandTransport transport, IRainForecastProvider rain, TimeProvider clock) : IControlService
{
    private static readonly TimeSpan FeedbackTimeout = TimeSpan.FromSeconds(30);
    private static readonly TimeSpan ConnectivityWindow = TimeSpan.FromMinutes(5);

    public async Task<IReadOnlyList<ScheduleView>> ListSchedulesAsync(Guid userId, Guid tenantId, Guid zoneId, CancellationToken ct)
    { await EnsureZoneReadAsync(userId, tenantId, zoneId, ct); return (await db.ControlSchedules.AsNoTracking().Where(x => x.ZoneId == zoneId && x.ArchivedAtUtc == null).OrderBy(x => x.NextRunAtUtc).ToListAsync(ct)).Select(ToView).ToList(); }

    public async Task<ScheduleView> CreateScheduleAsync(Guid ownerId, Guid tenantId, Guid zoneId, CreateScheduleCommand command, CancellationToken ct)
    {
        var zone = await EnsureOwnerZoneAsync(ownerId, tenantId, zoneId, ct); var actuator = await ActuatorAsync(zoneId, command.ActuatorId, ct); ValidateDuration(command.DurationSeconds, actuator); ValidateRain(command.EnableRainDelay, command.RainThresholdPercent);
        var cron = CronSpec.Parse(command.CronExpression); var next = cron.Next(clock.GetUtcNow().UtcDateTime, zone.Field.Farm.TimeZone); await EnsureScheduleDoesNotOverlapAsync(zoneId, null, cron, command.DurationSeconds, zone.Field.Farm.TimeZone, ct);
        var entity = new ControlSchedule { TenantId = tenantId, FarmId = zone.Field.FarmId, ZoneId = zoneId, ActuatorId = actuator.Id, Name = Required(command.Name, "name", 200), CronExpression = cron.Expression, DurationSeconds = command.DurationSeconds, EnableRainDelay = command.EnableRainDelay, RainThresholdPercent = command.RainThresholdPercent, NextRunAtUtc = next };
        db.ControlSchedules.Add(entity); await db.SaveChangesAsync(ct); return ToView(entity);
    }

    public async Task<ScheduleView> UpdateScheduleAsync(Guid ownerId, Guid tenantId, Guid zoneId, Guid scheduleId, UpdateScheduleCommand command, CancellationToken ct)
    {
        var zone = await EnsureOwnerZoneAsync(ownerId, tenantId, zoneId, ct); var entity = await ScheduleAsync(zoneId, scheduleId, ct); var actuator = await ActuatorAsync(zoneId, entity.ActuatorId, ct); ValidateDuration(command.DurationSeconds, actuator); ValidateRain(command.EnableRainDelay, command.RainThresholdPercent);
        var cron = CronSpec.Parse(command.CronExpression); await EnsureScheduleDoesNotOverlapAsync(zoneId, scheduleId, cron, command.DurationSeconds, zone.Field.Farm.TimeZone, ct);
        entity.Name = Required(command.Name, "name", 200); entity.CronExpression = cron.Expression; entity.DurationSeconds = command.DurationSeconds; entity.EnableRainDelay = command.EnableRainDelay; entity.RainThresholdPercent = command.RainThresholdPercent; entity.IsActive = command.IsActive; entity.NextRunAtUtc = cron.Next(clock.GetUtcNow().UtcDateTime, zone.Field.Farm.TimeZone); await db.SaveChangesAsync(ct); return ToView(entity);
    }

    public async Task ArchiveScheduleAsync(Guid ownerId, Guid tenantId, Guid zoneId, Guid scheduleId, CancellationToken ct)
    { await EnsureOwnerZoneAsync(ownerId, tenantId, zoneId, ct); var entity = await ScheduleAsync(zoneId, scheduleId, ct); entity.IsActive = false; entity.ArchivedAtUtc = clock.GetUtcNow().UtcDateTime; await db.SaveChangesAsync(ct); }

    public async Task<IReadOnlyList<AutoRuleView>> ListRulesAsync(Guid userId, Guid tenantId, Guid zoneId, CancellationToken ct)
    { await EnsureZoneReadAsync(userId, tenantId, zoneId, ct); return (await db.AutoControlRules.AsNoTracking().Where(x => x.ZoneId == zoneId && x.ArchivedAtUtc == null).OrderBy(x => x.Name).ToListAsync(ct)).Select(ToView).ToList(); }

    public async Task<AutoRuleView> CreateRuleAsync(Guid ownerId, Guid tenantId, Guid zoneId, CreateAutoRuleCommand command, CancellationToken ct)
    {
        var zone = await EnsureOwnerZoneAsync(ownerId, tenantId, zoneId, ct); var actuator = await ActuatorAsync(zoneId, command.ActuatorId, ct); ValidateDuration(command.DurationSeconds, actuator); ValidateRule(command.ConditionDurationMinutes, command.CooldownMinutes, command.Priority); ValidateRain(command.EnableRainDelay, command.RainThresholdPercent);
        var sensorType = command.ParameterCode.ToString(); if (!await db.DeviceSensors.AnyAsync(x => x.Device.ZoneId == zoneId && x.SensorType == sensorType, ct) && !await db.TelemetryReadings.AnyAsync(x => x.ZoneId == zoneId && x.ParameterCode == command.ParameterCode, ct)) throw new RequestValidationException("parameterCode", "Metric is not configured or observed in this Zone.");
        var entity = new AutoControlRule { TenantId = tenantId, FarmId = zone.Field.FarmId, ZoneId = zoneId, Name = Required(command.Name, "name", 200), ParameterCode = command.ParameterCode, Operator = command.Operator, Threshold = command.Threshold, ConditionDurationMinutes = command.ConditionDurationMinutes, ActuatorId = actuator.Id, Action = command.Action, DurationSeconds = command.DurationSeconds, Priority = command.Priority, CooldownMinutes = command.CooldownMinutes, EnableRainDelay = command.EnableRainDelay, RainThresholdPercent = command.RainThresholdPercent };
        db.AutoControlRules.Add(entity); await db.SaveChangesAsync(ct); return ToView(entity);
    }

    public async Task<AutoRuleView> UpdateRuleAsync(Guid ownerId, Guid tenantId, Guid zoneId, Guid ruleId, UpdateAutoRuleCommand command, CancellationToken ct)
    {
        await EnsureOwnerZoneAsync(ownerId, tenantId, zoneId, ct); var entity = await RuleAsync(zoneId, ruleId, ct); var actuator = await ActuatorAsync(zoneId, entity.ActuatorId, ct); ValidateDuration(command.DurationSeconds, actuator); ValidateRule(command.ConditionDurationMinutes, command.CooldownMinutes, command.Priority); ValidateRain(command.EnableRainDelay, command.RainThresholdPercent);
        entity.Name = Required(command.Name, "name", 200); entity.Threshold = command.Threshold; entity.ConditionDurationMinutes = command.ConditionDurationMinutes; entity.Action = command.Action; entity.DurationSeconds = command.DurationSeconds; entity.Priority = command.Priority; entity.CooldownMinutes = command.CooldownMinutes; entity.EnableRainDelay = command.EnableRainDelay; entity.RainThresholdPercent = command.RainThresholdPercent; entity.IsActive = command.IsActive; entity.ConditionTrueSinceUtc = null; await db.SaveChangesAsync(ct); return ToView(entity);
    }

    public async Task ArchiveRuleAsync(Guid ownerId, Guid tenantId, Guid zoneId, Guid ruleId, CancellationToken ct)
    {
        await EnsureOwnerZoneAsync(ownerId, tenantId, zoneId, ct); var entity = await RuleAsync(zoneId, ruleId, ct);
        if (await db.ActuatorCommands.AnyAsync(x => x.AutoRuleId == ruleId && (x.Status == ActuatorCommandStatus.Pending || x.Status == ActuatorCommandStatus.Sent || (x.Status == ActuatorCommandStatus.Acknowledged && x.ExecutionEndsAtUtc > clock.GetUtcNow().UtcDateTime)), ct)) throw new ResourceConflictException("Rule has an active actuator command.");
        entity.IsActive = false; entity.ArchivedAtUtc = clock.GetUtcNow().UtcDateTime; await db.SaveChangesAsync(ct);
    }

    public async Task<ActuatorCommandView> CreateManualCommandAsync(Guid userId, Guid tenantId, Guid zoneId, Guid actuatorId, ManualCommandRequest request, CancellationToken ct)
    {
        await EnsureZoneControlAsync(userId, tenantId, zoneId, ct); var actuator = await ActuatorAsync(zoneId, actuatorId, ct); ValidateDuration(request.DurationSeconds, actuator); var key = Required(request.IdempotencyKey, "idempotencyKey", 100);
        var existing = await db.ActuatorCommands.Include(x => x.Events).AsNoTracking().SingleOrDefaultAsync(x => x.TenantId == tenantId && x.IdempotencyKey == key, ct); if (existing is not null) return ToView(existing);
        await EnsureReadyAsync(actuator.DeviceId, ct); await EnsureRainAsync(actuator, true, 70, request.Action, ct);
        var now = clock.GetUtcNow().UtcDateTime; var active = await ActiveCommandsAsync(actuator, now, ct);
        if (active.Any(x => x.TriggerSource == CommandTriggerSource.Manual)) throw new ResourceConflictException("A manual command is already active in this Zone.");
        if (active.Count > 0 && !request.OverrideActiveSchedules) throw new ResourceConflictException("An automated command is active; set overrideActiveSchedules to request safe preemption.");
        var command = BuildCommand(actuator, tenantId, userId, CommandTriggerSource.Manual, request.Action, request.DurationSeconds, key, request.Notes, now); db.ActuatorCommands.Add(command); await db.SaveChangesAsync(ct);
        if (active.Count > 0)
        {
            foreach (var running in active) if (!await RequestStopAsync(running, "Preempted by manual command", ct)) { Fail(command, "PREEMPTION_FAILED", "Emergency stop could not be published.", now); await db.SaveChangesAsync(ct); return ToView(command); }
            return ToView(command);
        }
        await DispatchAsync(command, ct); return ToView(command);
    }

    public async Task<ActuatorStatusView> GetStatusAsync(Guid userId, Guid tenantId, Guid zoneId, Guid actuatorId, CancellationToken ct)
    {
        await EnsureZoneReadAsync(userId, tenantId, zoneId, ct); var actuator = await ActuatorAsync(zoneId, actuatorId, ct); var command = await db.ActuatorCommands.AsNoTracking().Where(x => x.ActuatorId == actuatorId).OrderByDescending(x => x.QueuedAtUtc).FirstOrDefaultAsync(ct); var now = clock.GetUtcNow().UtcDateTime;
        if (command is null) return new(actuatorId, actuator.ActuatorType, "Unknown", null, null, null, null);
        var state = command.Status == ActuatorCommandStatus.Sent ? "PendingFeedback" : command.Status == ActuatorCommandStatus.Acknowledged && command.Action == ActuatorCommandAction.TurnOn && command.ExecutionEndsAtUtc > now ? "Running" : command.Status == ActuatorCommandStatus.Acknowledged ? "Off" : "Unknown";
        int? remaining = state == "Running" ? Math.Max(0, (int)(command.ExecutionEndsAtUtc!.Value - now).TotalSeconds) : null; return new(actuatorId, actuator.ActuatorType, state, command.Id, command.AcknowledgedAtUtc, command.ExecutionEndsAtUtc, remaining);
    }

    public async Task<ActuatorCommandView> CancelAsync(Guid userId, Guid tenantId, Guid zoneId, Guid commandId, string reason, CancellationToken ct)
    {
        await EnsureZoneControlAsync(userId, tenantId, zoneId, ct); var command = await CommandAsync(zoneId, commandId, ct); var now = clock.GetUtcNow().UtcDateTime;
        if (command.Status == ActuatorCommandStatus.Pending) { command.Status = ActuatorCommandStatus.Cancelled; command.TerminalAtUtc = now; AddEvent(command, CommandEventKind.Feedback, command.Status, now, Required(reason, "reason", 500)); await db.SaveChangesAsync(ct); return ToView(command); }
        if (command.Status == ActuatorCommandStatus.Acknowledged && command.ExecutionEndsAtUtc <= now || command.Status is ActuatorCommandStatus.Failed or ActuatorCommandStatus.TimedOut or ActuatorCommandStatus.Cancelled) throw new ResourceConflictException("Command is already terminal and cannot be cancelled.");
        if (!await RequestStopAsync(command, Required(reason, "reason", 500), ct)) throw new ResourceConflictException("Emergency stop could not be published; command state remains unchanged until device feedback."); return ToView(command);
    }

    public async Task<CommandHistoryView> HistoryAsync(Guid userId, Guid tenantId, Guid zoneId, DateTime fromUtc, DateTime toUtc, int limit, CancellationToken ct)
    {
        await EnsureZoneReadAsync(userId, tenantId, zoneId, ct); if (fromUtc.Kind != DateTimeKind.Utc || toUtc.Kind != DateTimeKind.Utc || fromUtc > toUtc || toUtc - fromUtc > TimeSpan.FromDays(90)) throw new RequestValidationException("range", "Use a UTC range no greater than 90 days."); if (limit is < 1 or > 200) throw new RequestValidationException("limit", "Limit must be between 1 and 200.");
        return new(zoneId, (await db.ActuatorCommands.AsNoTracking().Include(x => x.Events).Where(x => x.ZoneId == zoneId && x.QueuedAtUtc >= fromUtc && x.QueuedAtUtc <= toUtc).OrderByDescending(x => x.QueuedAtUtc).Take(limit).ToListAsync(ct)).Select(ToView).ToList());
    }

    public async Task<ActuatorCommandView> ApplyFeedbackAsync(ActuatorFeedbackEnvelope feedback, CancellationToken ct)
    {
        if (feedback.OccurredAtUtc.Kind != DateTimeKind.Utc) throw new RequestValidationException("occurredAtUtc", "Feedback timestamp must be UTC."); if (feedback.Status is not (ActuatorCommandStatus.Acknowledged or ActuatorCommandStatus.Failed or ActuatorCommandStatus.Cancelled)) throw new RequestValidationException("status", "Feedback status must be Acknowledged, Failed or Cancelled.");
        var command = await db.ActuatorCommands.Include(x => x.Events).SingleOrDefaultAsync(x => x.Id == feedback.CommandId, ct) ?? throw new ResourceNotFoundException("Command was not found."); if (command.GatewayId != feedback.GatewayId || command.DeviceId != feedback.DeviceId) throw new AuthenticationException("Feedback source does not own this command.");
        if (command.Status is ActuatorCommandStatus.Failed or ActuatorCommandStatus.TimedOut or ActuatorCommandStatus.Cancelled || command.Status == ActuatorCommandStatus.Acknowledged && command.CancellationRequestedAtUtc is null)
        { AddEvent(command, CommandEventKind.LateFeedback, command.Status, feedback.OccurredAtUtc, feedback.ErrorMessage, feedback.ObservedState); await db.SaveChangesAsync(ct); return ToView(command); }
        if (command.CancellationRequestedAtUtc is not null && feedback.Status != ActuatorCommandStatus.Cancelled) throw new ResourceConflictException("A cancellation request requires Cancelled device feedback.");
        command.Status = feedback.Status; command.ObservedState = Optional(feedback.ObservedState, 50); command.ErrorCode = Optional(feedback.ErrorCode, 100); command.ErrorMessage = Optional(feedback.ErrorMessage, 1000); command.TerminalAtUtc = feedback.OccurredAtUtc;
        if (feedback.Status == ActuatorCommandStatus.Acknowledged) { command.AcknowledgedAtUtc = feedback.OccurredAtUtc; command.ExecutionEndsAtUtc = command.Action == ActuatorCommandAction.TurnOn ? feedback.OccurredAtUtc.AddSeconds(command.DurationSeconds) : feedback.OccurredAtUtc; }
        AddEvent(command, CommandEventKind.Feedback, command.Status, feedback.OccurredAtUtc, feedback.ErrorMessage, feedback.ObservedState); await db.SaveChangesAsync(ct);
        if (feedback.Status == ActuatorCommandStatus.Cancelled)
        { var pending = await db.ActuatorCommands.Include(x => x.Events).Where(x => x.ZoneId == command.ZoneId && x.Status == ActuatorCommandStatus.Pending && x.TriggerSource == CommandTriggerSource.Manual).OrderBy(x => x.QueuedAtUtc).FirstOrDefaultAsync(ct); if (pending is not null) await DispatchAsync(pending, ct); }
        return ToView(command);
    }

    public async Task<int> ExpireTimedOutAsync(DateTime nowUtc, CancellationToken ct)
    {
        var commands = await db.ActuatorCommands.Include(x => x.Events).Where(x => x.AckDeadlineAtUtc <= nowUtc && (x.Status == ActuatorCommandStatus.Sent || (x.Status == ActuatorCommandStatus.Acknowledged && x.CancellationRequestedAtUtc != null))).ToListAsync(ct); foreach (var command in commands) { command.Status = ActuatorCommandStatus.TimedOut; command.TerminalAtUtc = nowUtc; command.ErrorCode = command.CancellationRequestedAtUtc == null ? "ACK_TIMEOUT" : "CANCEL_ACK_TIMEOUT"; command.ErrorMessage = "No authenticated actuator feedback arrived before the deadline."; AddEvent(command, CommandEventKind.Timeout, command.Status, nowUtc, command.ErrorMessage); } await db.SaveChangesAsync(ct); return commands.Count;
    }

    public async Task<int> ProcessDueSchedulesAsync(DateTime nowUtc, CancellationToken ct)
    {
        var due = await db.ControlSchedules.Include(x => x.Zone).ThenInclude(x => x.Field).ThenInclude(x => x.Farm).Where(x => x.IsActive && x.ArchivedAtUtc == null && x.NextRunAtUtc <= nowUtc).ToListAsync(ct); var count = 0;
        foreach (var schedule in due)
        {
            var occurrence = schedule.NextRunAtUtc; schedule.NextRunAtUtc = CronSpec.Parse(schedule.CronExpression).Next(nowUtc, schedule.Zone.Field.Farm.TimeZone); var actuator = await ActuatorAsync(schedule.ZoneId, schedule.ActuatorId, ct);
            if (await HasActiveManualAsync(schedule.ZoneId, nowUtc, ct) || !await AutomatedGuardsPassAsync(actuator, schedule.EnableRainDelay, schedule.RainThresholdPercent, ActuatorCommandAction.TurnOn, ct)) continue;
            var key = $"schedule:{schedule.Id:N}:{occurrence.Ticks}"; if (await db.ActuatorCommands.AnyAsync(x => x.TenantId == schedule.TenantId && x.IdempotencyKey == key, ct)) continue;
            var command = BuildCommand(actuator, schedule.TenantId, null, CommandTriggerSource.Schedule, ActuatorCommandAction.TurnOn, schedule.DurationSeconds, key, null, nowUtc); command.ScheduleId = schedule.Id; db.ActuatorCommands.Add(command); await db.SaveChangesAsync(ct); await DispatchAsync(command, ct); count++;
        }
        await db.SaveChangesAsync(ct); return count;
    }

    public async Task<int> EvaluateRulesAsync(Guid zoneId, CancellationToken ct)
    {
        var now = clock.GetUtcNow().UtcDateTime; var rules = await db.AutoControlRules.Where(x => x.ZoneId == zoneId && x.IsActive && x.ArchivedAtUtc == null).ToListAsync(ct); var fired = 0;
        foreach (var rule in rules)
        {
            var reading = await db.TelemetryReadings.AsNoTracking().Where(x => x.ZoneId == zoneId && x.ParameterCode == rule.ParameterCode).OrderByDescending(x => x.CapturedAtUtc).FirstOrDefaultAsync(ct); if (reading is null || reading.CapturedAtUtc < now - ConnectivityWindow) { rule.ConditionTrueSinceUtc = null; continue; }
            var violates = rule.Operator switch { AutoRuleOperator.LessThan => reading.Value < rule.Threshold, AutoRuleOperator.LessThanOrEqual => reading.Value <= rule.Threshold, AutoRuleOperator.GreaterThan => reading.Value > rule.Threshold, _ => reading.Value >= rule.Threshold };
            if (!violates) { rule.ConditionTrueSinceUtc = null; continue; } rule.ConditionTrueSinceUtc ??= reading.CapturedAtUtc; if (now - rule.ConditionTrueSinceUtc < TimeSpan.FromMinutes(rule.ConditionDurationMinutes) || rule.LastTriggeredAtUtc?.AddMinutes(rule.CooldownMinutes) > now || await HasActiveManualAsync(zoneId, now, ct)) continue;
            var actuator = await ActuatorAsync(zoneId, rule.ActuatorId, ct); if (!await AutomatedGuardsPassAsync(actuator, rule.EnableRainDelay, rule.RainThresholdPercent, rule.Action, ct)) continue; var key = $"rule:{rule.Id:N}:{reading.Id:N}"; if (await db.ActuatorCommands.AnyAsync(x => x.TenantId == rule.TenantId && x.IdempotencyKey == key, ct)) continue;
            var command = BuildCommand(actuator, rule.TenantId, null, CommandTriggerSource.AutoRule, rule.Action, rule.DurationSeconds, key, null, now); command.AutoRuleId = rule.Id; db.ActuatorCommands.Add(command); rule.LastTriggeredAtUtc = now; rule.ConditionTrueSinceUtc = null; await db.SaveChangesAsync(ct); await DispatchAsync(command, ct); fired++;
        }
        await db.SaveChangesAsync(ct); return fired;
    }

    private async Task DispatchAsync(ActuatorCommand command, CancellationToken ct)
    {
        var now = clock.GetUtcNow().UtcDateTime; var result = await transport.PublishAsync(new(command.Id, command.GatewayId, command.DeviceId, command.ActuatorId, command.Action, command.DurationSeconds, now.AddSeconds(command.DurationSeconds)), ct);
        if (!result.Published) { Fail(command, result.ErrorCode ?? "TRANSPORT_UNAVAILABLE", result.ErrorMessage ?? "MQTT downlink was not published.", now); AddEvent(command, CommandEventKind.TransportFailure, command.Status, now, command.ErrorMessage); }
        else { command.Status = ActuatorCommandStatus.Sent; command.SentAtUtc = now; command.AckDeadlineAtUtc = now + FeedbackTimeout; AddEvent(command, CommandEventKind.Published, command.Status, now, "Downlink published; awaiting authenticated device feedback."); }
        await db.SaveChangesAsync(ct);
    }

    private async Task<bool> RequestStopAsync(ActuatorCommand command, string reason, CancellationToken ct)
    {
        var now = clock.GetUtcNow().UtcDateTime; var result = await transport.PublishEmergencyStopAsync(new(command.Id, command.GatewayId, command.DeviceId, command.ActuatorId, ActuatorCommandAction.TurnOff, 1, now.AddSeconds(30)), ct);
        AddEvent(command, result.Published ? CommandEventKind.CancellationRequested : CommandEventKind.TransportFailure, command.Status, now, result.Published ? reason : result.ErrorMessage); if (result.Published) { command.CancellationRequestedAtUtc = now; command.AckDeadlineAtUtc = now + FeedbackTimeout; } await db.SaveChangesAsync(ct); return result.Published;
    }

    private async Task<bool> AutomatedGuardsPassAsync(DeviceActuator actuator, bool rainDelay, decimal rainThreshold, ActuatorCommandAction action, CancellationToken ct)
    { try { await EnsureReadyAsync(actuator.DeviceId, ct); await EnsureRainAsync(actuator, rainDelay, rainThreshold, action, ct); var active = await ActiveCommandsAsync(actuator, clock.GetUtcNow().UtcDateTime, ct); return active.Count == 0; } catch (ResourceConflictException) { return false; } }

    private async Task EnsureReadyAsync(Guid deviceId, CancellationToken ct)
    {
        var now = clock.GetUtcNow().UtcDateTime; var device = await db.Devices.AsNoTracking().SingleAsync(x => x.Id == deviceId, ct); if (device.Status is DeviceStatus.Offline or DeviceStatus.MaintenanceRequired or DeviceStatus.Decommissioned) throw new ResourceConflictException("Device is not available for control.");
        var connection = await db.DeviceConnectionTests.AsNoTracking().AnyAsync(x => x.DeviceId == deviceId && x.Succeeded && x.ObservedAtUtc >= now - ConnectivityWindow, ct); var telemetry = await db.TelemetryReadings.AsNoTracking().AnyAsync(x => x.DeviceId == deviceId && x.ReceivedAtUtc >= now - ConnectivityWindow && x.CapturedAtUtc >= now - ConnectivityWindow, ct); if (!connection || !telemetry) throw new ResourceConflictException("Device connectivity or telemetry is stale; control is refused.");
    }

    private async Task EnsureRainAsync(DeviceActuator actuator, bool enabled, decimal threshold, ActuatorCommandAction action, CancellationToken ct)
    { if (!enabled || action != ActuatorCommandAction.TurnOn || !IsPump(actuator)) return; var forecast = await rain.GetAsync(actuator.Device.FarmId, ct); if (!forecast.Available || !forecast.ProbabilityPercent.HasValue) throw new ResourceConflictException("Rain forecast is unavailable; irrigation is safely refused."); if (forecast.ProbabilityPercent >= threshold) throw new ResourceConflictException("Irrigation is delayed because rain probability meets the configured threshold."); }

    private async Task<List<ActuatorCommand>> ActiveCommandsAsync(DeviceActuator target, DateTime now, CancellationToken ct)
    { var commands = await db.ActuatorCommands.Include(x => x.Events).Include(x => x.Actuator).Where(x => x.ZoneId == target.Device.ZoneId && x.Action == ActuatorCommandAction.TurnOn && (x.Status == ActuatorCommandStatus.Pending || x.Status == ActuatorCommandStatus.Sent || (x.Status == ActuatorCommandStatus.Acknowledged && x.ExecutionEndsAtUtc > now))).ToListAsync(ct); return IsPump(target) ? commands.Where(x => IsPump(x.Actuator)).ToList() : commands.Where(x => x.ActuatorId == target.Id).ToList(); }
    private Task<bool> HasActiveManualAsync(Guid zoneId, DateTime now, CancellationToken ct) => db.ActuatorCommands.AnyAsync(x => x.ZoneId == zoneId && x.TriggerSource == CommandTriggerSource.Manual && (x.Status == ActuatorCommandStatus.Pending || x.Status == ActuatorCommandStatus.Sent || (x.Status == ActuatorCommandStatus.Acknowledged && x.ExecutionEndsAtUtc > now)), ct);

    private ActuatorCommand BuildCommand(DeviceActuator actuator, Guid tenantId, Guid? userId, CommandTriggerSource source, ActuatorCommandAction action, int duration, string key, string? notes, DateTime now)
    { var command = new ActuatorCommand { TenantId = tenantId, FarmId = actuator.Device.FarmId, ZoneId = actuator.Device.ZoneId!.Value, ActuatorId = actuator.Id, DeviceId = actuator.DeviceId, GatewayId = actuator.Device.GatewayId, TriggeredByUserId = userId, TriggerSource = source, Action = action, DurationSeconds = duration, IdempotencyKey = key, Notes = Optional(notes, 1000), QueuedAtUtc = now }; AddEvent(command, CommandEventKind.Created, command.Status, now, $"Created from {source}."); return command; }
    private static void Fail(ActuatorCommand command, string code, string message, DateTime now) { command.Status = ActuatorCommandStatus.Failed; command.ErrorCode = code; command.ErrorMessage = message; command.TerminalAtUtc = now; }
    private void AddEvent(ActuatorCommand command, CommandEventKind kind, ActuatorCommandStatus status, DateTime at, string? detail = null, string? observed = null)
    {
        var item = new ActuatorCommandEvent { CommandId = command.Id, EventKind = kind, Status = status, OccurredAtUtc = at, Detail = detail, ObservedState = observed };
        if (db.Entry(command).State is EntityState.Detached or EntityState.Added) command.Events.Add(item); else db.ActuatorCommandEvents.Add(item);
    }

    private async Task EnsureScheduleDoesNotOverlapAsync(Guid zoneId, Guid? excluding, CronSpec candidate, int duration, string timeZone, CancellationToken ct)
    { var existing = await db.ControlSchedules.AsNoTracking().Where(x => x.ZoneId == zoneId && x.IsActive && x.ArchivedAtUtc == null && x.Id != excluding).ToListAsync(ct); var from = clock.GetUtcNow().UtcDateTime; var candidateRuns = candidate.NextMany(from, timeZone, 8); foreach (var schedule in existing) { var otherRuns = CronSpec.Parse(schedule.CronExpression).NextMany(from, timeZone, 8); if (candidateRuns.Any(a => otherRuns.Any(b => a < b.AddSeconds(schedule.DurationSeconds) && b < a.AddSeconds(duration)))) throw new ResourceConflictException("Schedule overlaps another active schedule in this Zone."); } }
    private async Task<Zone> EnsureOwnerZoneAsync(Guid userId, Guid tenantId, Guid zoneId, CancellationToken ct) { var zone = await ZoneAsync(zoneId, tenantId, ct); var user = await db.AppUsers.AsNoTracking().SingleOrDefaultAsync(x => x.Id == userId, ct) ?? throw new AuthorizationException(); if (user.Role != UserRole.FarmOwner || user.TenantId != tenantId) throw new AuthorizationException(); return zone; }
    private async Task EnsureZoneReadAsync(Guid userId, Guid tenantId, Guid zoneId, CancellationToken ct) { await ZoneAsync(zoneId, tenantId, ct); var user = await db.AppUsers.AsNoTracking().SingleOrDefaultAsync(x => x.Id == userId, ct) ?? throw new AuthorizationException(); if (user.TenantId != tenantId) throw new AuthorizationException(); if (user.Role == UserRole.FarmOwner) return; if (user.Role != UserRole.Farmer || !await db.UserZoneAccesses.AnyAsync(x => x.AppUserId == userId && x.ZoneId == zoneId, ct)) throw new AuthorizationException("Farmer is not assigned to this Zone."); }
    private async Task EnsureZoneControlAsync(Guid userId, Guid tenantId, Guid zoneId, CancellationToken ct) { await EnsureZoneReadAsync(userId, tenantId, zoneId, ct); var user = await db.AppUsers.AsNoTracking().SingleAsync(x => x.Id == userId, ct); if (user.Role == UserRole.Farmer && !await db.UserZoneAccesses.AnyAsync(x => x.AppUserId == userId && x.ZoneId == zoneId && x.CanControl, ct)) throw new AuthorizationException("Farmer does not have control permission for this Zone."); }
    private async Task<Zone> ZoneAsync(Guid zoneId, Guid tenantId, CancellationToken ct) => await db.Zones.Include(x => x.Field).ThenInclude(x => x.Farm).SingleOrDefaultAsync(x => x.Id == zoneId && x.Field.Farm.TenantId == tenantId, ct) ?? throw new ResourceNotFoundException("Zone was not found.");
    private async Task<DeviceActuator> ActuatorAsync(Guid zoneId, Guid actuatorId, CancellationToken ct) => await db.DeviceActuators.Include(x => x.Device).SingleOrDefaultAsync(x => x.Id == actuatorId && x.Device.ZoneId == zoneId, ct) ?? throw new ResourceNotFoundException("Actuator was not found in this Zone.");
    private async Task<ControlSchedule> ScheduleAsync(Guid zoneId, Guid id, CancellationToken ct) => await db.ControlSchedules.SingleOrDefaultAsync(x => x.Id == id && x.ZoneId == zoneId && x.ArchivedAtUtc == null, ct) ?? throw new ResourceNotFoundException("Schedule was not found.");
    private async Task<AutoControlRule> RuleAsync(Guid zoneId, Guid id, CancellationToken ct) => await db.AutoControlRules.SingleOrDefaultAsync(x => x.Id == id && x.ZoneId == zoneId && x.ArchivedAtUtc == null, ct) ?? throw new ResourceNotFoundException("Auto Rule was not found.");
    private async Task<ActuatorCommand> CommandAsync(Guid zoneId, Guid id, CancellationToken ct) => await db.ActuatorCommands.Include(x => x.Events).SingleOrDefaultAsync(x => x.Id == id && x.ZoneId == zoneId, ct) ?? throw new ResourceNotFoundException("Command was not found.");
    private static void ValidateDuration(int seconds, DeviceActuator actuator) { var max = Math.Min(1800, actuator.MaxDurationMinutes * 60); if (seconds < 1 || seconds > max) throw new RequestValidationException("durationSeconds", $"Duration must be between 1 and {max} seconds for this actuator."); }
    private static void ValidateRain(bool enabled, decimal threshold) { if (enabled && threshold is < 0 or > 100) throw new RequestValidationException("rainThresholdPercent", "Rain threshold must be between 0 and 100."); }
    private static void ValidateRule(int condition, int cooldown, int priority) { if (condition is < 1 or > 1440) throw new RequestValidationException("conditionDurationMinutes", "Condition duration must be 1 to 1440 minutes."); if (cooldown is < 1 or > 10080) throw new RequestValidationException("cooldownMinutes", "Cooldown must be 1 to 10080 minutes."); if (priority is < 1 or > 100) throw new RequestValidationException("priority", "Priority must be 1 to 100."); }
    private static bool IsPump(DeviceActuator actuator) => actuator.ActuatorType.Contains("pump", StringComparison.OrdinalIgnoreCase) || actuator.ActuatorType.Contains("water", StringComparison.OrdinalIgnoreCase);
    private static string Required(string? value, string field, int max) { var result = value?.Trim(); if (string.IsNullOrWhiteSpace(result) || result.Length > max) throw new RequestValidationException(field, $"{field} is required and may contain at most {max} characters."); return result; }
    private static string? Optional(string? value, int max) { var result = value?.Trim(); if (string.IsNullOrEmpty(result)) return null; if (result.Length > max) throw new RequestValidationException("value", $"Value may contain at most {max} characters."); return result; }
    private static ScheduleView ToView(ControlSchedule x) => new(x.Id, x.ZoneId, x.ActuatorId, x.Name, x.CronExpression, x.DurationSeconds, x.EnableRainDelay, x.RainThresholdPercent, x.IsActive, x.NextRunAtUtc);
    private static AutoRuleView ToView(AutoControlRule x) => new(x.Id, x.ZoneId, x.Name, x.ParameterCode, x.Operator, x.Threshold, x.ConditionDurationMinutes, x.ActuatorId, x.Action, x.DurationSeconds, x.Priority, x.CooldownMinutes, x.EnableRainDelay, x.RainThresholdPercent, x.IsActive, x.LastTriggeredAtUtc);
    private static ActuatorCommandView ToView(ActuatorCommand x) => new(x.Id, x.ZoneId, x.ActuatorId, x.DeviceId, x.TriggerSource, x.TriggeredByUserId, x.Action, x.DurationSeconds, x.Status, x.QueuedAtUtc, x.SentAtUtc, x.AcknowledgedAtUtc, x.ExecutionEndsAtUtc, x.CancellationRequestedAtUtc, x.ObservedState, x.ErrorCode, x.ErrorMessage, x.Events.OrderBy(e => e.OccurredAtUtc).Select(e => new CommandEventView(e.Id, e.EventKind, e.Status, e.OccurredAtUtc, e.Detail, e.ObservedState)).ToList());

    private sealed record CronSpec(int? Minute, int? Hour, string Expression)
    {
        public static CronSpec Parse(string value) { var parts = value.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries); if (parts.Length != 5 || parts.Skip(2).Any(x => x != "*")) throw new RequestValidationException("cronExpression", "Control v1 requires five fields with wildcard day, month and weekday."); return new(ParsePart(parts[0], 0, 59), ParsePart(parts[1], 0, 23), string.Join(' ', parts)); }
        private static int? ParsePart(string value, int min, int max) { if (value == "*") return null; if (!int.TryParse(value, out var number) || number < min || number > max) throw new RequestValidationException("cronExpression", "Minute or hour is outside its valid range."); return number; }
        public DateTime Next(DateTime afterUtc, string zoneId) { var tz = GetTimeZone(zoneId); var local = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(afterUtc, DateTimeKind.Utc), tz); var probe = new DateTime(local.Year, local.Month, local.Day, local.Hour, local.Minute, 0, DateTimeKind.Unspecified).AddMinutes(1); for (var i = 0; i < 60 * 24 * 370; i++, probe = probe.AddMinutes(1)) if ((!Minute.HasValue || probe.Minute == Minute) && (!Hour.HasValue || probe.Hour == Hour)) return TimeZoneInfo.ConvertTimeToUtc(probe, tz); throw new RequestValidationException("cronExpression", "No occurrence found in the next year."); }
        public List<DateTime> NextMany(DateTime afterUtc, string zoneId, int count) { var result = new List<DateTime>(); var cursor = afterUtc; for (var i = 0; i < count; i++) { cursor = Next(cursor, zoneId); result.Add(cursor); } return result; }
        private static TimeZoneInfo GetTimeZone(string id) { try { return TimeZoneInfo.FindSystemTimeZoneById(id); } catch (TimeZoneNotFoundException) { throw new RequestValidationException("timeZone", "Farm timezone is not recognized by the server."); } }
    }
}
