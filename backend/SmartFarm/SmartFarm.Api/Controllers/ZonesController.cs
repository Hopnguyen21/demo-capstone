using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartFarm.Api.Extensions;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Application.Features.Farms;
using SmartFarm.Application.Features.Zones;
using SmartFarm.Domain.Enums;

namespace SmartFarm.Api.Controllers;

[ApiController]
[Authorize(Roles = "FarmOwner")]
public sealed class ZonesController(IZoneService zoneService) : ControllerBase
{
    // API catalog #28
    [HttpGet("api/v1/fields/{fieldId:guid}/zones")]
    public async Task<ActionResult<IReadOnlyList<ZoneView>>> List(
        Guid fieldId, [FromQuery] ZoneStatus? status, CancellationToken cancellationToken) =>
        Ok(await zoneService.ListAsync(User.GetUserId(), User.GetTenantId(), fieldId, status, cancellationToken));

    // API catalog #29
    [HttpPost("api/v1/fields/{fieldId:guid}/zones")]
    public async Task<ActionResult<ZoneView>> Create(
        Guid fieldId, CreateZoneRequest request, CancellationToken cancellationToken)
    {
        var result = await zoneService.CreateAsync(User.GetUserId(), User.GetTenantId(), fieldId, request.ToCommand(), cancellationToken);
        return CreatedAtAction(nameof(Get), new { zoneId = result.ZoneId }, result);
    }

    // API catalog #30
    [HttpGet("api/v1/zones/{zoneId:guid}")]
    public async Task<ActionResult<ZoneView>> Get(Guid zoneId, CancellationToken cancellationToken) =>
        Ok(await zoneService.GetAsync(User.GetUserId(), User.GetTenantId(), zoneId, cancellationToken));

    // API catalog #31
    [HttpPut("api/v1/zones/{zoneId:guid}")]
    public async Task<ActionResult<ZoneView>> Update(
        Guid zoneId, UpdateZoneRequest request, CancellationToken cancellationToken) =>
        Ok(await zoneService.UpdateAsync(User.GetUserId(), User.GetTenantId(), zoneId, request.ToCommand(), cancellationToken));

    // API catalog #32
    [HttpDelete("api/v1/zones/{zoneId:guid}")]
    public async Task<ActionResult<ArchiveView>> Archive(Guid zoneId, CancellationToken cancellationToken) =>
        Ok(await zoneService.ArchiveAsync(User.GetUserId(), User.GetTenantId(), zoneId, cancellationToken));
}

public sealed class CreateZoneRequest
{
    [Required, StringLength(200, MinimumLength = 2)] public string Name { get; init; } = string.Empty;
    [Range(typeof(decimal), "0.01", "1000000")] public decimal AreaM2 { get; init; }
    [Required] public JsonElement PolygonGeoJson { get; init; }
    [Required, StringLength(50)] public string ZoneType { get; init; } = string.Empty;
    [StringLength(1000)] public string? Notes { get; init; }

    internal CreateZoneCommand ToCommand() => new(Name, AreaM2, PolygonGeoJson, ZoneType, Notes);
}

public sealed class UpdateZoneRequest
{
    [Required, StringLength(200, MinimumLength = 2)] public string Name { get; init; } = string.Empty;
    [Range(typeof(decimal), "0.01", "1000000")] public decimal? AreaM2 { get; init; }
    public JsonElement? PolygonGeoJson { get; init; }
    [StringLength(50)] public string? ZoneType { get; init; }
    [StringLength(1000)] public string? Notes { get; init; }
    public ZoneStatus? Status { get; init; }

    internal UpdateZoneCommand ToCommand() => new(Name, AreaM2, PolygonGeoJson, ZoneType, Notes, Status);
}
