using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartFarm.Api.Extensions;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Application.Features.Farms;
using SmartFarm.Application.Features.Fields;

namespace SmartFarm.Api.Controllers;

[ApiController]
[Authorize(Roles = "FarmOwner")]
public sealed class FieldsController(IFieldService fieldService) : ControllerBase
{
    // API catalog #23
    [HttpGet("api/v1/farms/{farmId:guid}/fields")]
    public async Task<ActionResult<IReadOnlyList<FieldSummaryView>>> List(
        Guid farmId, CancellationToken cancellationToken) =>
        Ok(await fieldService.ListAsync(User.GetUserId(), User.GetTenantId(), farmId, cancellationToken));

    // API catalog #24
    [HttpPost("api/v1/farms/{farmId:guid}/fields")]
    public async Task<ActionResult<FieldDetailView>> Create(
        Guid farmId, CreateFieldRequest request, CancellationToken cancellationToken)
    {
        var result = await fieldService.CreateAsync(User.GetUserId(), User.GetTenantId(), farmId, request.ToCommand(), cancellationToken);
        return CreatedAtAction(nameof(Get), new { fieldId = result.FieldId }, result);
    }

    // API catalog #25
    [HttpGet("api/v1/fields/{fieldId:guid}")]
    public async Task<ActionResult<FieldDetailView>> Get(Guid fieldId, CancellationToken cancellationToken) =>
        Ok(await fieldService.GetAsync(User.GetUserId(), User.GetTenantId(), fieldId, cancellationToken));

    // API catalog #26
    [HttpPut("api/v1/fields/{fieldId:guid}")]
    public async Task<ActionResult<FieldDetailView>> Update(
        Guid fieldId, UpdateFieldRequest request, CancellationToken cancellationToken) =>
        Ok(await fieldService.UpdateAsync(User.GetUserId(), User.GetTenantId(), fieldId, request.ToCommand(), cancellationToken));

    // API catalog #27
    [HttpDelete("api/v1/fields/{fieldId:guid}")]
    public async Task<ActionResult<ArchiveView>> Archive(Guid fieldId, CancellationToken cancellationToken) =>
        Ok(await fieldService.ArchiveAsync(User.GetUserId(), User.GetTenantId(), fieldId, cancellationToken));
}

public sealed class CreateFieldRequest
{
    [Required, StringLength(200, MinimumLength = 2)] public string Name { get; init; } = string.Empty;
    [Range(typeof(decimal), "0.01", "1000000")] public decimal AreaM2 { get; init; }
    [StringLength(100)] public string? SoilType { get; init; }
    [Range(-90, 90)] public decimal? Latitude { get; init; }
    [Range(-180, 180)] public decimal? Longitude { get; init; }
    [Required] public JsonElement BoundaryGeoJson { get; init; }

    internal CreateFieldCommand ToCommand() => new(Name, AreaM2, SoilType, Latitude, Longitude, BoundaryGeoJson);
}

public sealed class UpdateFieldRequest
{
    [Required, StringLength(200, MinimumLength = 2)] public string Name { get; init; } = string.Empty;
    [StringLength(100)] public string? SoilType { get; init; }
    [Range(-90, 90)] public decimal? Latitude { get; init; }
    [Range(-180, 180)] public decimal? Longitude { get; init; }
    public JsonElement? BoundaryGeoJson { get; init; }

    internal UpdateFieldCommand ToCommand() => new(Name, SoilType, Latitude, Longitude, BoundaryGeoJson);
}
