using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartFarm.Api.Extensions;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Application.Features.Ai;
using SmartFarm.Domain.Enums;

namespace SmartFarm.Api.Controllers;

[ApiController, Authorize(Roles = "FarmOwner")]
public sealed class AiAdvisoryController(IAiAdvisoryService service) : ControllerBase
{
    // API catalog #84
    [HttpGet("api/v1/zones/{zoneId:guid}/ai/context")]
    public async Task<ActionResult<AiZoneContext>> Context(Guid zoneId, CancellationToken cancellationToken) =>
        Ok(await service.GetContextAsync(User.GetUserId(), User.GetTenantId(), zoneId, cancellationToken));

    // API catalog #85
    [HttpPost("api/v1/zones/{zoneId:guid}/ai/ask")]
    public async Task<ActionResult<AiRecommendationView>> Ask(Guid zoneId, AskAiRequest request, CancellationToken cancellationToken)
    {
        var result = await service.AskAsync(User.GetUserId(), User.GetTenantId(), zoneId, new AskAiCommand(request.Question), cancellationToken);
        return Created($"/api/v1/zones/{zoneId}/ai/history", result);
    }

    // API catalog #86. Accepted means the Owner authorized an asynchronous control command, not that hardware ran.
    [HttpPost("api/v1/zones/{zoneId:guid}/ai/apply-recommendation")]
    public async Task<ActionResult<AiDecisionResult>> Decide(Guid zoneId, DecideAiRecommendationRequest request, CancellationToken cancellationToken)
    {
        var result = await service.DecideAsync(User.GetUserId(), User.GetTenantId(), zoneId,
            new DecideRecommendationCommand(request.RecommendationId, request.Decision, request.Reason, request.FollowUpQuestion), cancellationToken);
        return result.Command is null ? Ok(result) : Accepted($"/api/v1/zones/{zoneId}/actuators/{result.Command.ActuatorId}/status", result);
    }

    // API catalog #87
    [HttpGet("api/v1/zones/{zoneId:guid}/ai/history")]
    public async Task<ActionResult<AiHistoryView>> History(Guid zoneId, CancellationToken cancellationToken) =>
        Ok(await service.GetHistoryAsync(User.GetUserId(), User.GetTenantId(), zoneId, cancellationToken));

    // API catalog #88. This hides UI history and retains audit rows.
    [HttpDelete("api/v1/zones/{zoneId:guid}/ai/history")]
    public async Task<IActionResult> HideHistory(Guid zoneId, CancellationToken cancellationToken)
    {
        await service.HideHistoryAsync(User.GetUserId(), User.GetTenantId(), zoneId, cancellationToken);
        return NoContent();
    }
}

public sealed class AskAiRequest
{
    [Required, StringLength(2000, MinimumLength = 3)]
    public string Question { get; init; } = string.Empty;
}

public sealed class DecideAiRecommendationRequest
{
    public Guid RecommendationId { get; init; }
    public AiRecommendationDecisionType Decision { get; init; }
    [StringLength(1000)] public string? Reason { get; init; }
    [StringLength(2000, MinimumLength = 3)] public string? FollowUpQuestion { get; init; }
}
