using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartFarm.Api.Extensions;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Application.Features.Control;
using SmartFarm.Domain.Enums;

namespace SmartFarm.Api.Controllers;

[ApiController, Authorize(Roles = "FarmOwner,Farmer")]
public sealed class SchedulesController(IControlService service) : ControllerBase
{
    // API catalog #50
    [HttpGet("api/v1/zones/{zoneId:guid}/schedules")]
    public async Task<ActionResult<IReadOnlyList<ScheduleView>>> List(Guid zoneId, CancellationToken ct) => Ok(await service.ListSchedulesAsync(User.GetUserId(), User.GetTenantId(), zoneId, ct));
    // API catalog #51
    [HttpPost("api/v1/zones/{zoneId:guid}/schedules"), Authorize(Roles = "FarmOwner")]
    public async Task<ActionResult<ScheduleView>> Create(Guid zoneId, ScheduleRequest request, CancellationToken ct) { var result = await service.CreateScheduleAsync(User.GetUserId(), User.GetTenantId(), zoneId, request.ToCreate(), ct); return Created($"/api/v1/zones/{zoneId}/schedules/{result.ScheduleId}", result); }
    // API catalog #52
    [HttpPut("api/v1/zones/{zoneId:guid}/schedules/{scheduleId:guid}"), Authorize(Roles = "FarmOwner")]
    public async Task<ActionResult<ScheduleView>> Update(Guid zoneId, Guid scheduleId, ScheduleRequest request, CancellationToken ct) => Ok(await service.UpdateScheduleAsync(User.GetUserId(), User.GetTenantId(), zoneId, scheduleId, request.ToUpdate(), ct));
    // API catalog #53
    [HttpDelete("api/v1/zones/{zoneId:guid}/schedules/{scheduleId:guid}"), Authorize(Roles = "FarmOwner")]
    public async Task<IActionResult> Archive(Guid zoneId, Guid scheduleId, CancellationToken ct) { await service.ArchiveScheduleAsync(User.GetUserId(), User.GetTenantId(), zoneId, scheduleId, ct); return NoContent(); }
}

[ApiController, Authorize(Roles = "FarmOwner,Farmer")]
public sealed class AutoRulesController(IControlService service) : ControllerBase
{
    // API catalog #76
    [HttpPost("api/v1/zones/{zoneId:guid}/rules"), Authorize(Roles = "FarmOwner")]
    public async Task<ActionResult<AutoRuleView>> Create(Guid zoneId, AutoRuleRequest request, CancellationToken ct) { var result = await service.CreateRuleAsync(User.GetUserId(), User.GetTenantId(), zoneId, request.ToCreate(), ct); return Created($"/api/v1/zones/{zoneId}/rules/{result.RuleId}", result); }
    // API catalog #77
    [HttpGet("api/v1/zones/{zoneId:guid}/rules")]
    public async Task<ActionResult<IReadOnlyList<AutoRuleView>>> List(Guid zoneId, CancellationToken ct) => Ok(await service.ListRulesAsync(User.GetUserId(), User.GetTenantId(), zoneId, ct));
    // API catalog #78
    [HttpPut("api/v1/zones/{zoneId:guid}/rules/{ruleId:guid}"), Authorize(Roles = "FarmOwner")]
    public async Task<ActionResult<AutoRuleView>> Update(Guid zoneId, Guid ruleId, AutoRuleRequest request, CancellationToken ct) => Ok(await service.UpdateRuleAsync(User.GetUserId(), User.GetTenantId(), zoneId, ruleId, request.ToUpdate(), ct));
    // API catalog #79
    [HttpDelete("api/v1/zones/{zoneId:guid}/rules/{ruleId:guid}"), Authorize(Roles = "FarmOwner")]
    public async Task<IActionResult> Archive(Guid zoneId, Guid ruleId, CancellationToken ct) { await service.ArchiveRuleAsync(User.GetUserId(), User.GetTenantId(), zoneId, ruleId, ct); return NoContent(); }
}

[ApiController, Authorize(Roles = "FarmOwner,Farmer")]
public sealed class ControlController(IControlService service) : ControllerBase
{
    // API catalog #80. HTTP 202 means queued/published, never physical success.
    [HttpPost("api/v1/zones/{zoneId:guid}/actuators/{actuatorId:guid}/command")]
    public async Task<ActionResult<ActuatorCommandView>> Command(Guid zoneId, Guid actuatorId, ManualControlRequest request, CancellationToken ct) { var result = await service.CreateManualCommandAsync(User.GetUserId(), User.GetTenantId(), zoneId, actuatorId, request.ToCommand(), ct); return Accepted($"/api/v1/zones/{zoneId}/actuators/{actuatorId}/status", result); }
    // API catalog #81
    [HttpGet("api/v1/zones/{zoneId:guid}/actuators/{actuatorId:guid}/status")]
    public async Task<ActionResult<ActuatorStatusView>> Status(Guid zoneId, Guid actuatorId, CancellationToken ct) => Ok(await service.GetStatusAsync(User.GetUserId(), User.GetTenantId(), zoneId, actuatorId, ct));
    // API catalog #82
    [HttpDelete("api/v1/zones/{zoneId:guid}/commands/{commandId:guid}")]
    public async Task<ActionResult<ActuatorCommandView>> Cancel(Guid zoneId, Guid commandId, CancelControlRequest request, CancellationToken ct) => Accepted(await service.CancelAsync(User.GetUserId(), User.GetTenantId(), zoneId, commandId, request.Reason, ct));
    // API catalog #83
    [HttpGet("api/v1/zones/{zoneId:guid}/actuators/history")]
    public async Task<ActionResult<CommandHistoryView>> History(Guid zoneId, [FromQuery] DateTime fromUtc, [FromQuery] DateTime toUtc, [FromQuery] int limit = 20, CancellationToken ct = default) => Ok(await service.HistoryAsync(User.GetUserId(), User.GetTenantId(), zoneId, fromUtc, toUtc, limit, ct));
}

public sealed class ScheduleRequest
{
    [Required, StringLength(200)] public string Name { get; init; } = "";
    public Guid ActuatorId { get; init; }
    [Required, StringLength(100)] public string CronExpression { get; init; } = "";
    [Range(1, 1800)] public int DurationSeconds { get; init; }
    public bool EnableRainDelay { get; init; } = true;
    [Range(typeof(decimal), "0", "100")] public decimal RainThresholdPercent { get; init; } = 70;
    public bool IsActive { get; init; } = true;
    internal CreateScheduleCommand ToCreate() => new(Name, ActuatorId, CronExpression, DurationSeconds, EnableRainDelay, RainThresholdPercent);
    internal UpdateScheduleCommand ToUpdate() => new(Name, CronExpression, DurationSeconds, EnableRainDelay, RainThresholdPercent, IsActive);
}
public sealed class AutoRuleRequest
{
    [Required, StringLength(200)] public string Name { get; init; } = "";
    public EnvironmentalParameterCode ParameterCode { get; init; }
    public AutoRuleOperator Operator { get; init; }
    public decimal Threshold { get; init; }
    [Range(1, 1440)] public int ConditionDurationMinutes { get; init; } = 5;
    public Guid ActuatorId { get; init; }
    public ActuatorCommandAction Action { get; init; } = ActuatorCommandAction.TurnOn;
    [Range(1, 1800)] public int DurationSeconds { get; init; }
    [Range(1, 100)] public int Priority { get; init; } = 1;
    [Range(1, 10080)] public int CooldownMinutes { get; init; } = 60;
    public bool EnableRainDelay { get; init; } = true;
    [Range(typeof(decimal), "0", "100")] public decimal RainThresholdPercent { get; init; } = 70;
    public bool IsActive { get; init; } = true;
    internal CreateAutoRuleCommand ToCreate() => new(Name, ParameterCode, Operator, Threshold, ConditionDurationMinutes, ActuatorId, Action, DurationSeconds, Priority, CooldownMinutes, EnableRainDelay, RainThresholdPercent);
    internal UpdateAutoRuleCommand ToUpdate() => new(Name, Threshold, ConditionDurationMinutes, Action, DurationSeconds, Priority, CooldownMinutes, EnableRainDelay, RainThresholdPercent, IsActive);
}
public sealed class ManualControlRequest { public ActuatorCommandAction Action { get; init; } [Range(1, 1800)] public int DurationSeconds { get; init; } public bool OverrideActiveSchedules { get; init; } [Required, StringLength(100)] public string IdempotencyKey { get; init; } = ""; [StringLength(1000)] public string? Notes { get; init; } internal ManualCommandRequest ToCommand() => new(Action, DurationSeconds, OverrideActiveSchedules, IdempotencyKey, Notes); }
public sealed class CancelControlRequest { [Required, StringLength(500)] public string Reason { get; init; } = ""; }
