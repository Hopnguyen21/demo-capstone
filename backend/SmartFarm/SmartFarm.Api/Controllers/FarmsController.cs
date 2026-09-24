using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartFarm.Api.Extensions;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Application.Features.Farms;
using SmartFarm.Domain.Enums;

namespace SmartFarm.Api.Controllers;

[ApiController]
[Authorize(Roles = "FarmOwner")]
[Route("api/v1/farms")]
public sealed class FarmsController(IFarmService farmService) : ControllerBase
{
    // API catalog #16
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<FarmSummaryView>>> List(
        [FromQuery] FarmStatus? status, CancellationToken cancellationToken) =>
        Ok(await farmService.ListAsync(User.GetUserId(), User.GetTenantId(), status, cancellationToken));

    // API catalog #17
    [HttpPost]
    public async Task<ActionResult<FarmDetailView>> Create(CreateFarmRequest request, CancellationToken cancellationToken)
    {
        var result = await farmService.CreateAsync(User.GetUserId(), User.GetTenantId(), request.ToCommand(), cancellationToken);
        return CreatedAtAction(nameof(Get), new { farmId = result.FarmId }, result);
    }

    // API catalog #18
    [HttpGet("{farmId:guid}")]
    public async Task<ActionResult<FarmDetailView>> Get(Guid farmId, CancellationToken cancellationToken) =>
        Ok(await farmService.GetAsync(User.GetUserId(), User.GetTenantId(), farmId, cancellationToken));

    // API catalog #19
    [HttpPut("{farmId:guid}")]
    public async Task<ActionResult<FarmDetailView>> Update(
        Guid farmId, UpdateFarmRequest request, CancellationToken cancellationToken) =>
        Ok(await farmService.UpdateAsync(User.GetUserId(), User.GetTenantId(), farmId, request.ToCommand(), cancellationToken));

    // API catalog #20
    [HttpDelete("{farmId:guid}")]
    public async Task<ActionResult<ArchiveView>> Archive(Guid farmId, CancellationToken cancellationToken) =>
        Ok(await farmService.ArchiveAsync(User.GetUserId(), User.GetTenantId(), farmId, cancellationToken));

    // API catalog #21
    [HttpGet("{farmId:guid}/structure")]
    public async Task<ActionResult<FarmStructureView>> Structure(Guid farmId, CancellationToken cancellationToken) =>
        Ok(await farmService.GetStructureAsync(User.GetUserId(), User.GetTenantId(), farmId, cancellationToken));
}

public sealed class CreateFarmRequest
{
    [Required, StringLength(200, MinimumLength = 2)] public string Name { get; init; } = string.Empty;
    [StringLength(500)] public string? LocationText { get; init; }
    [Range(-90, 90)] public decimal? Latitude { get; init; }
    [Range(-180, 180)] public decimal? Longitude { get; init; }
    [Range(typeof(decimal), "0.01", "1000000")] public decimal TotalAreaM2 { get; init; }
    [Required, StringLength(100)] public string TimeZone { get; init; } = "Asia/Ho_Chi_Minh";

    internal CreateFarmCommand ToCommand() => new(Name, LocationText, Latitude, Longitude, TotalAreaM2, TimeZone);
}

public sealed class UpdateFarmRequest
{
    [Required, StringLength(200, MinimumLength = 2)] public string Name { get; init; } = string.Empty;
    [StringLength(500)] public string? LocationText { get; init; }
    [Range(-90, 90)] public decimal? Latitude { get; init; }
    [Range(-180, 180)] public decimal? Longitude { get; init; }
    [Range(typeof(decimal), "0.01", "1000000")] public decimal TotalAreaM2 { get; init; }
    [Required, StringLength(100)] public string TimeZone { get; init; } = "Asia/Ho_Chi_Minh";

    internal UpdateFarmCommand ToCommand() => new(Name, LocationText, Latitude, Longitude, TotalAreaM2, TimeZone);
}
