using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartFarm.Api.Extensions;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Application.Features.TelemetryAlerts;
using SmartFarm.Domain.Enums;

namespace SmartFarm.Api.Controllers;

[ApiController, Authorize(Roles = "FarmOwner,Farmer")]
public sealed class TelemetryController(ITelemetryAlertService service) : ControllerBase
{
    // API catalog #69
    [HttpGet("api/v1/zones/{zoneId:guid}/telemetry/latest")]
    public async Task<ActionResult<LatestTelemetryView>> Latest(Guid zoneId, CancellationToken ct) => Ok(await service.LatestAsync(User.GetUserId(), User.GetTenantId(), zoneId, ct));

    // API catalog #70
    [HttpGet("api/v1/zones/{zoneId:guid}/telemetry/history")]
    public async Task<ActionResult<TelemetryHistoryView>> History(Guid zoneId, [FromQuery] EnvironmentalParameterCode parameterCode, [FromQuery] DateTime fromUtc, [FromQuery] DateTime toUtc, [FromQuery] string interval = "15m", CancellationToken ct = default) => Ok(await service.HistoryAsync(User.GetUserId(), User.GetTenantId(), zoneId, parameterCode, fromUtc, toUtc, interval, ct));

    // API catalog #71
    [HttpGet("api/v1/zones/{zoneId:guid}/telemetry/stats"), Authorize(Roles = "FarmOwner")]
    public async Task<ActionResult<TelemetryStatsView>> Stats(Guid zoneId, [FromQuery] int days = 7, CancellationToken ct = default) => Ok(await service.StatsAsync(User.GetUserId(), User.GetTenantId(), zoneId, days, ct));
}

[ApiController, Authorize(Roles = "FarmOwner,Farmer")]
public sealed class AlertRulesController(ITelemetryAlertService service) : ControllerBase
{
    // API catalog #46
    [HttpGet("api/v1/zones/{zoneId:guid}/alert-rules")]
    public async Task<ActionResult<IReadOnlyList<AlertRuleView>>> List(Guid zoneId, CancellationToken ct) => Ok(await service.ListRulesAsync(User.GetUserId(), User.GetTenantId(), zoneId, ct));

    // API catalog #47
    [HttpPost("api/v1/zones/{zoneId:guid}/alert-rules"), Authorize(Roles = "FarmOwner")]
    public async Task<ActionResult<AlertRuleView>> Create(Guid zoneId, AlertRuleRequest request, CancellationToken ct)
    { var result = await service.CreateRuleAsync(User.GetUserId(), User.GetTenantId(), zoneId, request.ToCreateCommand(), ct); return Created($"/api/v1/zones/{zoneId}/alert-rules/{result.RuleId}", result); }

    // API catalog #48
    [HttpPut("api/v1/zones/{zoneId:guid}/alert-rules/{ruleId:guid}"), Authorize(Roles = "FarmOwner")]
    public async Task<ActionResult<AlertRuleView>> Update(Guid zoneId, Guid ruleId, AlertRuleRequest request, CancellationToken ct) => Ok(await service.UpdateRuleAsync(User.GetUserId(), User.GetTenantId(), zoneId, ruleId, request.ToUpdateCommand(), ct));

    // API catalog #49
    [HttpDelete("api/v1/zones/{zoneId:guid}/alert-rules/{ruleId:guid}"), Authorize(Roles = "FarmOwner")]
    public async Task<IActionResult> Archive(Guid zoneId, Guid ruleId, CancellationToken ct) { await service.ArchiveRuleAsync(User.GetUserId(), User.GetTenantId(), zoneId, ruleId, ct); return NoContent(); }
}

[ApiController, Authorize(Roles = "FarmOwner,Farmer")]
public sealed class AlertsController(ITelemetryAlertService service) : ControllerBase
{
    // API catalog #72
    [HttpGet("api/v1/farms/{farmId:guid}/alerts")]
    public async Task<ActionResult<IReadOnlyList<AlertView>>> Farm(Guid farmId, [FromQuery] AlertStatus? status, [FromQuery] AlertSeverity? severity, CancellationToken ct) => Ok(await service.ListFarmAlertsAsync(User.GetUserId(), User.GetTenantId(), farmId, status, severity, ct));

    // API catalog #73
    [HttpGet("api/v1/zones/{zoneId:guid}/alerts")]
    public async Task<ActionResult<IReadOnlyList<AlertView>>> Zone(Guid zoneId, [FromQuery] AlertStatus? status, CancellationToken ct) => Ok(await service.ListZoneAlertsAsync(User.GetUserId(), User.GetTenantId(), zoneId, status, ct));

    // API catalog #74
    [HttpGet("api/v1/alerts/{alertId:guid}")]
    public async Task<ActionResult<AlertView>> Get(Guid alertId, CancellationToken ct) => Ok(await service.GetAlertAsync(User.GetUserId(), User.GetTenantId(), alertId, ct));

    // API catalog #75, normalized as acknowledge-only by TELEMETRY_ALERT_CONTRACT_V1.md
    [HttpPut("api/v1/alerts/{alertId:guid}/acknowledge")]
    public async Task<ActionResult<AlertView>> Acknowledge(Guid alertId, AcknowledgeAlertRequest request, CancellationToken ct) => Ok(await service.AcknowledgeAsync(User.GetUserId(), User.GetTenantId(), alertId, request.Notes, ct));

    // Contract extension ALERT-V1-01
    [HttpPut("api/v1/alerts/{alertId:guid}/resolve")]
    public async Task<ActionResult<AlertView>> Resolve(Guid alertId, ResolveAlertRequest request, CancellationToken ct) => Ok(await service.ResolveAsync(User.GetUserId(), User.GetTenantId(), alertId, new(request.ActionTaken, request.Notes), ct));
}

public sealed class AlertRuleRequest
{
    public EnvironmentalParameterCode ParameterCode { get; init; }
    public decimal MinThreshold { get; init; }
    public decimal MaxThreshold { get; init; }
    public AlertSeverity Severity { get; init; } = AlertSeverity.Warning;
    [Range(1, 1440)] public int CooldownMinutes { get; init; } = 30;
    public bool IsActive { get; init; } = true;
    internal CreateAlertRuleCommand ToCreateCommand() => new(ParameterCode, MinThreshold, MaxThreshold, Severity, CooldownMinutes);
    internal UpdateAlertRuleCommand ToUpdateCommand() => new(MinThreshold, MaxThreshold, Severity, CooldownMinutes, IsActive);
}
public sealed class AcknowledgeAlertRequest { [StringLength(1000)] public string? Notes { get; init; } }
public sealed class ResolveAlertRequest { [Required, StringLength(500)] public string ActionTaken { get; init; } = ""; [StringLength(1000)] public string? Notes { get; init; } }
