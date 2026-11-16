using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartFarm.Api.Extensions;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Application.Features.CropGrowth;

namespace SmartFarm.Api.Controllers;

[ApiController, Authorize]
public sealed class EnvironmentalMetricsController(ICropGrowthService service) : ControllerBase
{
    [HttpGet("api/v1/environmental-metrics")]
    public async Task<ActionResult<IReadOnlyList<EnvironmentalMetricDefinitionView>>> List(CancellationToken ct) =>
        Ok(await service.ListMetricDefinitionsAsync(User.GetUserId(), User.GetOptionalTenantId(), ct));

    [HttpPost("api/v1/environmental-metrics"), Authorize(Roles = "FarmOwner,PlatformAdmin")]
    public async Task<ActionResult<EnvironmentalMetricDefinitionView>> Create(CreateEnvironmentalMetricRequest request, CancellationToken ct)
    {
        var result = await service.CreateMetricDefinitionAsync(User.GetUserId(), User.GetOptionalTenantId(), request.ToCommand(), ct);
        return Created($"/api/v1/environmental-metrics/{result.Id}", result);
    }

    [HttpDelete("api/v1/environmental-metrics/{id:guid}"), Authorize(Roles = "FarmOwner,PlatformAdmin")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await service.DeleteMetricDefinitionAsync(User.GetUserId(), User.GetOptionalTenantId(), id, ct);
        return NoContent();
    }
}

public sealed class CreateEnvironmentalMetricRequest
{
    [Required, StringLength(50, MinimumLength = 1)]
    public string MetricCode { get; init; } = "";

    [Required, StringLength(150, MinimumLength = 1)]
    public string MetricName { get; init; } = "";

    [Required, StringLength(30, MinimumLength = 1)]
    public string Unit { get; init; } = "";

    [StringLength(500)]
    public string? Description { get; init; }

    public decimal DefaultMin { get; init; }
    public decimal DefaultTarget { get; init; }
    public decimal DefaultMax { get; init; }
    public bool HasSensorSupport { get; init; }

    internal CreateMetricDefinitionCommand ToCommand() =>
        new(MetricCode, MetricName, Unit, Description, DefaultMin, DefaultTarget, DefaultMax, HasSensorSupport);
}
