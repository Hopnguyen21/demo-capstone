using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartFarm.Api.Extensions;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Application.Features.CropGrowth;
using SmartFarm.Domain.Enums;

namespace SmartFarm.Api.Controllers;

[ApiController, Authorize]
public sealed class CropGrowthController(ICropGrowthService service) : ControllerBase
{
    // API catalog #33
    [HttpGet("api/v1/crops")]
    public async Task<ActionResult<IReadOnlyList<CropView>>> Crops([FromQuery] bool? systemDefined, CancellationToken ct) => Ok(await service.ListCropsAsync(User.GetUserId(), User.GetOptionalTenantId(), systemDefined, ct));

    // API catalog #34
    [HttpPost("api/v1/crops"), Authorize(Roles = "FarmOwner")]
    public async Task<ActionResult<CropView>> CreateCrop(CreateCropRequest request, CancellationToken ct)
    { var result = await service.CreateCropAsync(User.GetUserId(), User.GetTenantId(), new(request.Name, request.ScientificName, request.Description), ct); return Created($"/api/v1/crops/{result.CropId}", result); }

    // API catalog #35
    [HttpGet("api/v1/crops/{cropId:guid}/varieties")]
    public async Task<ActionResult<IReadOnlyList<VarietyView>>> Varieties(Guid cropId, CancellationToken ct) => Ok(await service.ListVarietiesAsync(User.GetUserId(), User.GetOptionalTenantId(), cropId, ct));

    // API catalog #36
    [HttpPost("api/v1/crops/{cropId:guid}/varieties"), Authorize(Roles = "FarmOwner")]
    public async Task<ActionResult<VarietyView>> CreateVariety(Guid cropId, CreateVarietyRequest request, CancellationToken ct)
    { var result = await service.CreateVarietyAsync(User.GetUserId(), User.GetTenantId(), cropId, new(request.Name, request.Description), ct); return Created($"/api/v1/crops/{cropId}/varieties/{result.VarietyId}", result); }

    // API catalog #37
    [HttpGet("api/v1/crops/{cropId:guid}/growth-profiles")]
    public async Task<ActionResult<IReadOnlyList<GrowthProfileView>>> Profiles(Guid cropId, [FromQuery] Guid? varietyId, CancellationToken ct) => Ok(await service.ListProfilesAsync(User.GetUserId(), User.GetOptionalTenantId(), cropId, varietyId, ct));

    // API catalog #38
    [HttpPost("api/v1/growth-profiles"), Authorize(Roles = "FarmOwner")]
    public async Task<ActionResult<GrowthProfileView>> CreateProfile(CreateGrowthProfileRequest request, CancellationToken ct)
    { var result = await service.CreateProfileAsync(User.GetUserId(), User.GetTenantId(), request.ToCommand(), ct); return Created($"/api/v1/growth-profiles/{result.ProfileId}/stages", result); }

    // API catalog #39
    [HttpGet("api/v1/growth-profiles/{profileId:guid}/stages")]
    public async Task<ActionResult<IReadOnlyList<GrowthStageView>>> Stages(Guid profileId, CancellationToken ct) => Ok((await service.GetProfileAsync(User.GetUserId(), User.GetOptionalTenantId(), profileId, ct)).Stages);

    // API catalog #40
    [HttpPut("api/v1/growth-stages/{stageId:guid}/requirements"), Authorize(Roles = "FarmOwner")]
    public async Task<ActionResult<RequirementUpdateView>> Requirements(Guid stageId, UpdateRequirementsRequest request, CancellationToken ct) => Ok(await service.UpdateRequirementsAsync(User.GetUserId(), User.GetTenantId(), stageId, request.Requirements.Select(x => x.ToInput()).ToList(), ct));
}

public sealed class CreateCropRequest { [Required, StringLength(150, MinimumLength = 2)] public string Name { get; init; } = ""; [Required, StringLength(200)] public string ScientificName { get; init; } = ""; [StringLength(1000)] public string? Description { get; init; } }
public sealed class CreateVarietyRequest { [Required, StringLength(150, MinimumLength = 1)] public string Name { get; init; } = ""; [StringLength(1000)] public string? Description { get; init; } }
public sealed class RequirementRequest { [Required] public EnvironmentalParameterCode ParameterCode { get; init; } public decimal MinValue { get; init; } public decimal MaxValue { get; init; } public decimal TargetValue { get; init; } [Required, StringLength(30)] public string Unit { get; init; } = ""; internal RequirementInput ToInput() => new(ParameterCode, MinValue, MaxValue, TargetValue, Unit); }
public sealed class StageRequest { [Required, StringLength(150)] public string Name { get; init; } = ""; [Range(1, 100)] public int StageOrder { get; init; } [Range(1, 1000)] public int DurationDays { get; init; } [Required, MinLength(1)] public List<RequirementRequest> Requirements { get; init; } = []; internal StageInput ToInput() => new(Name, StageOrder, DurationDays, Requirements.Select(x => x.ToInput()).ToList()); }
public sealed class CreateGrowthProfileRequest { public Guid CropId { get; init; } public Guid? VarietyId { get; init; } [Required, StringLength(200)] public string Name { get; init; } = ""; [StringLength(1000)] public string? Description { get; init; } public bool IsDefault { get; init; } public Guid? SourceProfileId { get; init; } public List<StageRequest>? Stages { get; init; } internal CreateGrowthProfileCommand ToCommand() => new(CropId, VarietyId, Name, Description, IsDefault, SourceProfileId, Stages?.Select(x => x.ToInput()).ToList()); }
public sealed class UpdateRequirementsRequest { [Required, MinLength(1)] public List<RequirementRequest> Requirements { get; init; } = []; }

[ApiController, Authorize(Roles = "FarmOwner,Farmer")]
public sealed class PlantingSeasonsController(ICropGrowthService service) : ControllerBase
{
    // API catalog #41
    [HttpGet("api/v1/zones/{zoneId:guid}/planting-seasons")]
    public async Task<ActionResult<IReadOnlyList<PlantingSeasonView>>> List(Guid zoneId, CancellationToken ct) => Ok(await service.ListSeasonsAsync(User.GetUserId(), User.GetTenantId(), zoneId, ct));
    // API catalog #42
    [HttpPost("api/v1/zones/{zoneId:guid}/planting-seasons"), Authorize(Roles = "FarmOwner")]
    public async Task<ActionResult<PlantingSeasonView>> Create(Guid zoneId, CreateSeasonRequest request, CancellationToken ct) { var result = await service.CreateSeasonAsync(User.GetUserId(), User.GetTenantId(), zoneId, request.ToCommand(), ct); return CreatedAtAction(nameof(Get), new { zoneId, seasonId = result.SeasonId }, result); }
    // API catalog #43
    [HttpGet("api/v1/zones/{zoneId:guid}/planting-seasons/{seasonId:guid}")]
    public async Task<ActionResult<PlantingSeasonView>> Get(Guid zoneId, Guid seasonId, CancellationToken ct) => Ok(await service.GetSeasonAsync(User.GetUserId(), User.GetTenantId(), zoneId, seasonId, ct));
    // API catalog #44
    [HttpPut("api/v1/zones/{zoneId:guid}/planting-seasons/{seasonId:guid}/stage"), Authorize(Roles = "FarmOwner")]
    public async Task<ActionResult<PlantingSeasonView>> Stage(Guid zoneId, Guid seasonId, TransitionStageRequest request, CancellationToken ct) => Ok(await service.TransitionStageAsync(User.GetUserId(), User.GetTenantId(), zoneId, seasonId, new(request.GrowthStageId, request.Notes), ct));
    // API catalog #45
    [HttpPut("api/v1/zones/{zoneId:guid}/planting-seasons/{seasonId:guid}/close"), Authorize(Roles = "FarmOwner")]
    public async Task<ActionResult<PlantingSeasonView>> Close(Guid zoneId, Guid seasonId, CloseSeasonRequest request, CancellationToken ct) => Ok(await service.CloseSeasonAsync(User.GetUserId(), User.GetTenantId(), zoneId, seasonId, new(request.ActualEndDate, request.ActualYieldKg, request.Notes), ct));
}

public sealed class CreateSeasonRequest { public Guid CropId { get; init; } public Guid? VarietyId { get; init; } public Guid GrowthProfileId { get; init; } [Required, StringLength(200)] public string Name { get; init; } = ""; public DateOnly StartDate { get; init; } public DateOnly ExpectedEndDate { get; init; } internal CreatePlantingSeasonCommand ToCommand() => new(CropId, VarietyId, GrowthProfileId, Name, StartDate, ExpectedEndDate); }
public sealed class TransitionStageRequest { public Guid GrowthStageId { get; init; } [StringLength(1000)] public string? Notes { get; init; } }
public sealed class CloseSeasonRequest { public DateOnly ActualEndDate { get; init; } [Range(typeof(decimal), "0", "999999999")] public decimal? ActualYieldKg { get; init; } [StringLength(1000)] public string? Notes { get; init; } }
