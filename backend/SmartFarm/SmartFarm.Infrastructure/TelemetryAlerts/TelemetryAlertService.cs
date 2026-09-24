using System.Data;
using Microsoft.EntityFrameworkCore;
using SmartFarm.Application.Common.Exceptions;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Application.Features.TelemetryAlerts;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;

namespace SmartFarm.Infrastructure.TelemetryAlerts;

public sealed class TelemetryAlertService(SmartFarmDbContext db, TimeProvider clock, IControlService control)
    : ITelemetryIngestionService, ITelemetryAlertService
{
    private static readonly TimeSpan FreshnessWindow = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan MaximumBackfillAge = TimeSpan.FromDays(7);

    public async Task<TelemetryIngestionResult> IngestAsync(Guid authenticatedGatewayId, TelemetryEnvelope envelope, CancellationToken ct)
    {
        ValidateEnvelope(envelope);
        var now = clock.GetUtcNow().UtcDateTime;
        if (envelope.CapturedAtUtc > now.AddMinutes(5) || envelope.CapturedAtUtc < now - MaximumBackfillAge)
            throw new RequestValidationException("capturedAtUtc", "Timestamp must be UTC, no more than 5 minutes in the future and no more than 7 days old.");

        var device = await db.Devices.AsNoTracking()
            .Include(x => x.Farm)
            .SingleOrDefaultAsync(x => x.Id == envelope.DeviceId, ct)
            ?? throw new ResourceNotFoundException("Device was not found.");
        if (device.GatewayId != authenticatedGatewayId)
            throw new AuthenticationException("The gateway is not authorized to publish for this device.");
        if (device.ZoneId != envelope.ZoneId)
            throw new RequestValidationException("zoneId", "Device is not assigned to the supplied Zone.");
        if (device.Status is DeviceStatus.Unassigned or DeviceStatus.Decommissioned || device.DecommissionedAtUtc is not null)
            throw new ResourceConflictException("Device is not active in a Zone.");

        var season = await db.PlantingSeasons
            .Include(x => x.AppliedRequirements)
            .SingleOrDefaultAsync(x => x.ZoneId == envelope.ZoneId && x.Status == PlantingSeasonStatus.InProgress, ct)
            ?? throw new ResourceConflictException("Zone has no in-progress Planting Season.");
        var requirements = season.AppliedRequirements.ToDictionary(x => x.ParameterCode);
        foreach (var reading in envelope.Readings)
        {
            if (!requirements.TryGetValue(reading.ParameterCode, out var requirement))
                throw new RequestValidationException("readings", $"{reading.ParameterCode} is not required by the current Growth Stage.");
            if (!string.Equals(requirement.Unit, reading.Unit.Trim(), StringComparison.OrdinalIgnoreCase))
                throw new RequestValidationException("readings", $"Unit for {reading.ParameterCode} must be '{requirement.Unit}'.");
            ValidateRange(reading);
        }

        await using var transaction = db.Database.IsRelational()
            ? await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct)
            : null;

        var parameters = envelope.Readings.Select(x => x.ParameterCode).ToList();
        var duplicateMessage = await db.TelemetryReadings.AnyAsync(x => x.DeviceId == device.Id && x.MessageId == envelope.MessageId, ct);
        var duplicateSample = await db.TelemetryReadings.AnyAsync(x => x.DeviceId == device.Id && x.CapturedAtUtc == envelope.CapturedAtUtc && parameters.Contains(x.ParameterCode), ct);
        if (duplicateMessage || duplicateSample)
        {
            if (transaction is not null) await transaction.CommitAsync(ct);
            return new(authenticatedGatewayId, device.Id, envelope.ZoneId, envelope.MessageId, true, 0, 0);
        }

        foreach (var input in envelope.Readings)
            db.TelemetryReadings.Add(new TelemetryReading
            {
                TenantId = device.Farm.TenantId, FarmId = device.FarmId, ZoneId = envelope.ZoneId,
                DeviceId = device.Id, GatewayId = authenticatedGatewayId, MessageId = envelope.MessageId,
                ParameterCode = input.ParameterCode, Value = input.Value, Unit = input.Unit.Trim(),
                CapturedAtUtc = envelope.CapturedAtUtc, ReceivedAtUtc = now
            });

        var alertsCreated = 0;
        foreach (var input in envelope.Readings)
        {
            var requirement = requirements[input.ParameterCode];
            var rules = await db.AlertRules
                .Where(x => x.ZoneId == envelope.ZoneId && x.GrowthStageId == season.CurrentGrowthStageId &&
                            x.ParameterCode == input.ParameterCode && x.ArchivedAtUtc == null && x.IsActive)
                .ToListAsync(ct);
            if (!rules.Any(x => x.Severity == AlertSeverity.Warning))
            {
                var systemRule = new AlertRule
                {
                    ZoneId = envelope.ZoneId, GrowthStageId = season.CurrentGrowthStageId,
                    ParameterCode = input.ParameterCode, MinThreshold = requirement.MinValue,
                    MaxThreshold = requirement.MaxValue, Severity = AlertSeverity.Warning,
                    CooldownMinutes = 30, IsSystemGenerated = true
                };
                db.AlertRules.Add(systemRule);
                rules.Add(systemRule);
            }

            foreach (var rule in rules)
            {
                var state = rule.Id == Guid.Empty ? null : await db.AlertRuleEvaluationStates
                    .SingleOrDefaultAsync(x => x.AlertRuleId == rule.Id && x.DeviceId == device.Id, ct);
                if (state is null)
                {
                    state = new AlertRuleEvaluationState { AlertRule = rule, DeviceId = device.Id };
                    db.AlertRuleEvaluationStates.Add(state);
                }
                if (state.LastMessageId == envelope.MessageId) continue;
                state.LastMessageId = envelope.MessageId;

                var violates = input.Value < rule.MinThreshold || input.Value > rule.MaxThreshold;
                if (!violates)
                {
                    state.ConsecutiveViolationCount = 0;
                    state.LastViolationAtUtc = null;
                    continue;
                }

                state.ConsecutiveViolationCount++;
                state.LastViolationAtUtc = envelope.CapturedAtUtc;
                if (state.ConsecutiveViolationCount < 2) continue;

                var hasOpenAlert = await db.Alerts.AnyAsync(x => x.ZoneId == envelope.ZoneId &&
                    x.ParameterCode == input.ParameterCode && x.Severity == rule.Severity && x.Status != AlertStatus.Resolved, ct);
                var cooldownActive = state.LastAlertAtUtc.HasValue && state.LastAlertAtUtc.Value.AddMinutes(rule.CooldownMinutes) > now;
                if (hasOpenAlert || cooldownActive) continue;

                var alert = new Alert
                {
                    TenantId = device.Farm.TenantId, FarmId = device.FarmId, ZoneId = envelope.ZoneId,
                    DeviceId = device.Id, AlertRule = rule, PlantingSeasonId = season.Id,
                    GrowthStageId = season.CurrentGrowthStageId, ParameterCode = input.ParameterCode,
                    ObservedValue = input.Value, MinThreshold = rule.MinThreshold, MaxThreshold = rule.MaxThreshold,
                    Unit = input.Unit.Trim(), Severity = rule.Severity, Status = AlertStatus.Open,
                    Title = $"{input.ParameterCode} outside permitted range"
                };
                alert.History.Add(new AlertHistoryEvent { EventType = AlertEventType.Created, Notes = "Created after two consecutive violating samples." });
                db.Alerts.Add(alert);
                state.LastAlertAtUtc = now;
                state.ConsecutiveViolationCount = 0;
                alertsCreated++;
            }
        }

        await db.SaveChangesAsync(ct);
        if (transaction is not null) await transaction.CommitAsync(ct);
        await control.EvaluateRulesAsync(envelope.ZoneId, ct);
        return new(authenticatedGatewayId, device.Id, envelope.ZoneId, envelope.MessageId, false, envelope.Readings.Count, alertsCreated);
    }

    public async Task<LatestTelemetryView> LatestAsync(Guid userId, Guid tenantId, Guid zoneId, CancellationToken ct)
    {
        await EnsureZoneAccessAsync(userId, tenantId, zoneId, ct);
        var rows = await db.TelemetryReadings.AsNoTracking().Where(x => x.ZoneId == zoneId).OrderByDescending(x => x.CapturedAtUtc).ToListAsync(ct);
        var requirements = await CurrentRequirementsAsync(zoneId, ct);
        var now = clock.GetUtcNow().UtcDateTime;
        var metrics = rows.GroupBy(x => x.ParameterCode).Select(x => x.First()).Select(x =>
        {
            requirements.TryGetValue(x.ParameterCode, out var requirement);
            var status = requirement is null ? "Unknown" : x.Value < requirement.MinValue ? "Below" : x.Value > requirement.MaxValue ? "Above" : "Normal";
            var fresh = x.ReceivedAtUtc >= now - FreshnessWindow && x.CapturedAtUtc >= now - FreshnessWindow;
            return new LatestMetricView(x.ParameterCode, x.Value, x.Unit, x.CapturedAtUtc, x.ReceivedAtUtc, fresh, status);
        }).OrderBy(x => x.ParameterCode).ToList();
        return new(zoneId, rows.FirstOrDefault()?.ReceivedAtUtc, metrics.Any(x => x.IsFresh), metrics);
    }

    public async Task<TelemetryHistoryView> HistoryAsync(Guid userId, Guid tenantId, Guid zoneId, EnvironmentalParameterCode parameterCode, DateTime fromUtc, DateTime toUtc, string interval, CancellationToken ct)
    {
        await EnsureZoneAccessAsync(userId, tenantId, zoneId, ct);
        if (fromUtc.Kind != DateTimeKind.Utc || toUtc.Kind != DateTimeKind.Utc || fromUtc >= toUtc || toUtc - fromUtc > TimeSpan.FromDays(90))
            throw new RequestValidationException("range", "History requires UTC from < to and a range no greater than 90 days.");
        var bucket = interval switch { "1m" => TimeSpan.FromMinutes(1), "5m" => TimeSpan.FromMinutes(5), "15m" => TimeSpan.FromMinutes(15), "1h" => TimeSpan.FromHours(1), "1d" => TimeSpan.FromDays(1), _ => throw new RequestValidationException("interval", "Interval must be 1m, 5m, 15m, 1h or 1d.") };
        var rows = await db.TelemetryReadings.AsNoTracking().Where(x => x.ZoneId == zoneId && x.ParameterCode == parameterCode && x.CapturedAtUtc >= fromUtc && x.CapturedAtUtc <= toUtc).ToListAsync(ct);
        var data = rows.GroupBy(x => new DateTime(x.CapturedAtUtc.Ticks / bucket.Ticks * bucket.Ticks, DateTimeKind.Utc))
            .OrderBy(x => x.Key).Select(x => new TelemetryHistoryPoint(x.Key, x.Average(y => y.Value), x.Min(y => y.Value), x.Max(y => y.Value), x.Count())).ToList();
        return new(zoneId, parameterCode, interval, data);
    }

    public async Task<TelemetryStatsView> StatsAsync(Guid ownerId, Guid tenantId, Guid zoneId, int days, CancellationToken ct)
    {
        await EnsureOwnerZoneAsync(ownerId, tenantId, zoneId, ct);
        if (days is < 1 or > 90) throw new RequestValidationException("days", "Days must be between 1 and 90.");
        var from = clock.GetUtcNow().UtcDateTime.AddDays(-days);
        var rows = await db.TelemetryReadings.AsNoTracking().Where(x => x.ZoneId == zoneId && x.CapturedAtUtc >= from).OrderBy(x => x.CapturedAtUtc).ToListAsync(ct);
        var metrics = rows.GroupBy(x => x.ParameterCode).Select(g =>
        {
            var values = g.ToList(); var half = Math.Max(1, values.Count / 2);
            var oldAvg = values.Take(half).Average(x => x.Value); var newAvg = values.Skip(half).DefaultIfEmpty(values[^1]).Average(x => x.Value);
            var tolerance = Math.Max(Math.Abs(oldAvg) * 0.05m, 0.01m); var trend = newAvg > oldAvg + tolerance ? "Increasing" : newAvg < oldAvg - tolerance ? "Decreasing" : "Stable";
            return new MetricStatsView(g.Key, g.Average(x => x.Value), g.Min(x => x.Value), g.Max(x => x.Value), trend);
        }).OrderBy(x => x.ParameterCode).ToList();
        var alertCount = await db.Alerts.CountAsync(x => x.ZoneId == zoneId && x.CreatedAtUtc >= from, ct);
        return new(zoneId, days, metrics, alertCount);
    }

    public async Task<IReadOnlyList<AlertRuleView>> ListRulesAsync(Guid userId, Guid tenantId, Guid zoneId, CancellationToken ct)
    {
        await EnsureZoneAccessAsync(userId, tenantId, zoneId, ct);
        var season = await CurrentSeasonAsync(zoneId, ct);
        return (await db.AlertRules.AsNoTracking().Where(x => x.ZoneId == zoneId && x.GrowthStageId == season.CurrentGrowthStageId && x.ArchivedAtUtc == null).OrderBy(x => x.ParameterCode).ThenBy(x => x.Severity).ToListAsync(ct)).Select(ToView).ToList();
    }

    public async Task<AlertRuleView> CreateRuleAsync(Guid ownerId, Guid tenantId, Guid zoneId, CreateAlertRuleCommand command, CancellationToken ct)
    {
        await EnsureOwnerZoneAsync(ownerId, tenantId, zoneId, ct); ValidateRule(command.MinThreshold, command.MaxThreshold, command.CooldownMinutes);
        var season = await CurrentSeasonAsync(zoneId, ct);
        if (!season.AppliedRequirements.Any(x => x.ParameterCode == command.ParameterCode)) throw new RequestValidationException("parameterCode", "Parameter is not present in the current Growth Stage.");
        if (await db.AlertRules.AnyAsync(x => x.ZoneId == zoneId && x.GrowthStageId == season.CurrentGrowthStageId && x.ParameterCode == command.ParameterCode && x.Severity == command.Severity && x.ArchivedAtUtc == null, ct)) throw new ResourceConflictException("A rule for this metric and severity already exists in the current Growth Stage.");
        var rule = new AlertRule { ZoneId = zoneId, GrowthStageId = season.CurrentGrowthStageId, ParameterCode = command.ParameterCode, MinThreshold = command.MinThreshold, MaxThreshold = command.MaxThreshold, Severity = command.Severity, CooldownMinutes = command.CooldownMinutes };
        db.AlertRules.Add(rule); await db.SaveChangesAsync(ct); return ToView(rule);
    }

    public async Task<AlertRuleView> UpdateRuleAsync(Guid ownerId, Guid tenantId, Guid zoneId, Guid ruleId, UpdateAlertRuleCommand command, CancellationToken ct)
    {
        await EnsureOwnerZoneAsync(ownerId, tenantId, zoneId, ct); ValidateRule(command.MinThreshold, command.MaxThreshold, command.CooldownMinutes);
        var rule = await RuleAsync(zoneId, ruleId, ct); if (rule.IsSystemGenerated) throw new ResourceConflictException("System rules follow Growth Stage thresholds and cannot be edited directly.");
        if (rule.Severity != command.Severity && await db.AlertRules.AnyAsync(x => x.ZoneId == zoneId && x.GrowthStageId == rule.GrowthStageId && x.ParameterCode == rule.ParameterCode && x.Severity == command.Severity && x.ArchivedAtUtc == null && x.Id != ruleId, ct)) throw new ResourceConflictException("A rule for this metric and severity already exists.");
        rule.MinThreshold = command.MinThreshold; rule.MaxThreshold = command.MaxThreshold; rule.Severity = command.Severity; rule.CooldownMinutes = command.CooldownMinutes; rule.IsActive = command.IsActive;
        await db.SaveChangesAsync(ct); return ToView(rule);
    }

    public async Task ArchiveRuleAsync(Guid ownerId, Guid tenantId, Guid zoneId, Guid ruleId, CancellationToken ct)
    {
        await EnsureOwnerZoneAsync(ownerId, tenantId, zoneId, ct); var rule = await RuleAsync(zoneId, ruleId, ct);
        if (rule.IsSystemGenerated) throw new ResourceConflictException("System rules cannot be archived.");
        rule.ArchivedAtUtc = clock.GetUtcNow().UtcDateTime; rule.IsActive = false; await db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<AlertView>> ListFarmAlertsAsync(Guid userId, Guid tenantId, Guid farmId, AlertStatus? status, AlertSeverity? severity, CancellationToken ct)
    {
        var zones = await AccessibleZoneIdsAsync(userId, tenantId, farmId, ct);
        var query = db.Alerts.AsNoTracking().Include(x => x.History).Where(x => x.FarmId == farmId && zones.Contains(x.ZoneId));
        if (status.HasValue) query = query.Where(x => x.Status == status); if (severity.HasValue) query = query.Where(x => x.Severity == severity);
        return (await query.OrderByDescending(x => x.CreatedAtUtc).ToListAsync(ct)).Select(ToView).ToList();
    }

    public async Task<IReadOnlyList<AlertView>> ListZoneAlertsAsync(Guid userId, Guid tenantId, Guid zoneId, AlertStatus? status, CancellationToken ct)
    {
        await EnsureZoneAccessAsync(userId, tenantId, zoneId, ct); var query = db.Alerts.AsNoTracking().Include(x => x.History).Where(x => x.ZoneId == zoneId);
        if (status.HasValue) query = query.Where(x => x.Status == status); return (await query.OrderByDescending(x => x.CreatedAtUtc).ToListAsync(ct)).Select(ToView).ToList();
    }

    public async Task<AlertView> GetAlertAsync(Guid userId, Guid tenantId, Guid alertId, CancellationToken ct)
    {
        var alert = await AlertAsync(alertId, ct); await EnsureZoneAccessAsync(userId, tenantId, alert.ZoneId, ct); return ToView(alert);
    }

    public async Task<AlertView> AcknowledgeAsync(Guid userId, Guid tenantId, Guid alertId, string? notes, CancellationToken ct)
    {
        var alert = await AlertAsync(alertId, ct); await EnsureZoneAccessAsync(userId, tenantId, alert.ZoneId, ct);
        if (alert.Status != AlertStatus.Open) throw new ResourceConflictException("Only an open alert can be acknowledged.");
        alert.Status = AlertStatus.Acknowledged; alert.AcknowledgedAtUtc = clock.GetUtcNow().UtcDateTime;
        var history = new AlertHistoryEvent { AlertId = alert.Id, ActorUserId = userId, EventType = AlertEventType.Acknowledged, Notes = Optional(notes, 1000) };
        db.AlertHistoryEvents.Add(history);
        await db.SaveChangesAsync(ct); return ToView(alert);
    }

    public async Task<AlertView> ResolveAsync(Guid userId, Guid tenantId, Guid alertId, ResolveAlertCommand command, CancellationToken ct)
    {
        var alert = await AlertAsync(alertId, ct); await EnsureZoneAccessAsync(userId, tenantId, alert.ZoneId, ct);
        if (alert.Status == AlertStatus.Resolved) throw new ResourceConflictException("Alert is already resolved.");
        var action = command.ActionTaken?.Trim(); if (string.IsNullOrWhiteSpace(action) || action.Length > 500) throw new RequestValidationException("actionTaken", "Action taken is required and may contain at most 500 characters.");
        alert.Status = AlertStatus.Resolved; alert.ResolvedAtUtc = clock.GetUtcNow().UtcDateTime;
        var history = new AlertHistoryEvent { AlertId = alert.Id, ActorUserId = userId, EventType = AlertEventType.Resolved, ActionTaken = action, Notes = Optional(command.Notes, 1000) };
        db.AlertHistoryEvents.Add(history);
        await db.SaveChangesAsync(ct); return ToView(alert);
    }

    private async Task<AlertRule> RuleAsync(Guid zoneId, Guid ruleId, CancellationToken ct) => await db.AlertRules.SingleOrDefaultAsync(x => x.Id == ruleId && x.ZoneId == zoneId && x.ArchivedAtUtc == null, ct) ?? throw new ResourceNotFoundException("Alert Rule was not found.");
    private async Task<Alert> AlertAsync(Guid id, CancellationToken ct) => await db.Alerts.Include(x => x.History).SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw new ResourceNotFoundException("Alert was not found.");
    private async Task<PlantingSeason> CurrentSeasonAsync(Guid zoneId, CancellationToken ct) => await db.PlantingSeasons.Include(x => x.AppliedRequirements).SingleOrDefaultAsync(x => x.ZoneId == zoneId && x.Status == PlantingSeasonStatus.InProgress, ct) ?? throw new ResourceConflictException("Zone has no in-progress Planting Season.");
    private async Task<Dictionary<EnvironmentalParameterCode, SeasonAppliedRequirement>> CurrentRequirementsAsync(Guid zoneId, CancellationToken ct) => (await CurrentSeasonAsync(zoneId, ct)).AppliedRequirements.ToDictionary(x => x.ParameterCode);

    private async Task EnsureOwnerZoneAsync(Guid userId, Guid tenantId, Guid zoneId, CancellationToken ct)
    {
        var user = await db.AppUsers.AsNoTracking().SingleOrDefaultAsync(x => x.Id == userId, ct) ?? throw new AuthorizationException();
        if (!await ZoneInTenantAsync(zoneId, tenantId, ct)) throw new ResourceNotFoundException("Zone was not found.");
        if (user.Role != UserRole.FarmOwner || user.TenantId != tenantId) throw new AuthorizationException();
    }

    private async Task EnsureZoneAccessAsync(Guid userId, Guid tenantId, Guid zoneId, CancellationToken ct)
    {
        var user = await db.AppUsers.AsNoTracking().SingleOrDefaultAsync(x => x.Id == userId, ct) ?? throw new AuthorizationException();
        if (!await ZoneInTenantAsync(zoneId, tenantId, ct)) throw new ResourceNotFoundException("Zone was not found.");
        if (user.TenantId != tenantId) throw new AuthorizationException();
        if (user.Role == UserRole.FarmOwner) return;
        if (user.Role != UserRole.Farmer || !await db.UserZoneAccesses.AnyAsync(x => x.AppUserId == userId && x.ZoneId == zoneId, ct)) throw new AuthorizationException("Farmer is not assigned to this Zone.");
    }

    private async Task<List<Guid>> AccessibleZoneIdsAsync(Guid userId, Guid tenantId, Guid farmId, CancellationToken ct)
    {
        var user = await db.AppUsers.AsNoTracking().SingleOrDefaultAsync(x => x.Id == userId, ct) ?? throw new AuthorizationException();
        var farm = await db.Farms.AsNoTracking().SingleOrDefaultAsync(x => x.Id == farmId, ct) ?? throw new ResourceNotFoundException("Farm was not found.");
        if (farm.TenantId != tenantId) throw new ResourceNotFoundException("Farm was not found.");
        if (user.TenantId != tenantId || (user.Role != UserRole.FarmOwner && user.Role != UserRole.Farmer)) throw new AuthorizationException();
        var zoneQuery = db.Zones.AsNoTracking().Where(x => x.Field.FarmId == farmId);
        if (user.Role == UserRole.Farmer) zoneQuery = zoneQuery.Where(x => x.UserAccesses.Any(a => a.AppUserId == userId));
        return await zoneQuery.Select(x => x.Id).ToListAsync(ct);
    }

    private Task<bool> ZoneInTenantAsync(Guid zoneId, Guid tenantId, CancellationToken ct) => db.Zones.AsNoTracking().AnyAsync(x => x.Id == zoneId && x.Field.Farm.TenantId == tenantId, ct);
    private static void ValidateRule(decimal min, decimal max, int cooldown) { if (min >= max) throw new RequestValidationException("thresholds", "Minimum threshold must be less than maximum threshold."); if (cooldown is < 1 or > 1440) throw new RequestValidationException("cooldownMinutes", "Cooldown must be between 1 and 1440 minutes."); }
    private static void ValidateEnvelope(TelemetryEnvelope value)
    {
        if (string.IsNullOrWhiteSpace(value.MessageId) || value.MessageId.Trim().Length > 100) throw new RequestValidationException("messageId", "Message ID is required and may contain at most 100 characters.");
        if (value.DeviceId == Guid.Empty || value.ZoneId == Guid.Empty) throw new RequestValidationException("deviceId", "Device ID and Zone ID are required.");
        if (value.CapturedAtUtc.Kind != DateTimeKind.Utc) throw new RequestValidationException("capturedAtUtc", "Timestamp must include the UTC designator Z.");
        if (value.Readings.Count is < 1 or > 50 || value.Readings.GroupBy(x => x.ParameterCode).Any(x => x.Count() > 1)) throw new RequestValidationException("readings", "Provide 1 to 50 unique parameters per message.");
    }
    private static void ValidateRange(TelemetryValueInput value)
    {
        var valid = value.ParameterCode switch { EnvironmentalParameterCode.Temperature => value.Value is >= -80 and <= 100, EnvironmentalParameterCode.SoilMoisture or EnvironmentalParameterCode.AirHumidity => value.Value is >= 0 and <= 100, EnvironmentalParameterCode.Ph => value.Value is >= 0 and <= 14, EnvironmentalParameterCode.LightIntensity or EnvironmentalParameterCode.Ec => value.Value >= 0, _ => false };
        if (!valid) throw new RequestValidationException("readings", $"Value for {value.ParameterCode} is outside the accepted physical range.");
    }
    private static string? Optional(string? value, int max) { var result = value?.Trim(); if (string.IsNullOrEmpty(result)) return null; if (result.Length > max) throw new RequestValidationException("notes", $"Value may contain at most {max} characters."); return result; }
    private static AlertRuleView ToView(AlertRule x) => new(x.Id, x.ZoneId, x.GrowthStageId, x.ParameterCode, x.MinThreshold, x.MaxThreshold, x.Severity, x.CooldownMinutes, x.IsActive, x.IsSystemGenerated);
    private static AlertView ToView(Alert x) => new(x.Id, x.FarmId, x.ZoneId, x.DeviceId, x.GrowthStageId, x.ParameterCode, x.ObservedValue, x.MinThreshold, x.MaxThreshold, x.Unit, x.Severity, x.Status, x.Title, x.CreatedAtUtc, x.AcknowledgedAtUtc, x.ResolvedAtUtc, x.History.OrderBy(y => y.CreatedAtUtc).Select(y => new AlertHistoryView(y.Id, y.ActorUserId, y.EventType, y.ActionTaken, y.Notes, y.CreatedAtUtc)).ToList());
}
