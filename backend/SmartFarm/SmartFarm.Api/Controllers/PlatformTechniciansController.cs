using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartFarm.Api.Extensions;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Application.Features.Technicians;
using SmartFarm.Domain.Enums;

namespace SmartFarm.Api.Controllers;

[ApiController]
[Authorize(Roles = "PlatformAdmin")]
[Route("api/v1/platform/technicians")]
public sealed class PlatformTechniciansController(ITechnicianService technicianService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<TechnicianView>>> List(CancellationToken cancellationToken)
    {
        return Ok(await technicianService.ListAsync(User.GetUserId(), cancellationToken));
    }

    [HttpPost]
    public async Task<ActionResult<TechnicianView>> Create(
        CreateTechnicianRequest request,
        CancellationToken cancellationToken)
    {
        var result = await technicianService.CreateAsync(
            User.GetUserId(),
            new CreateTechnicianCommand(request.Email, request.FullName, request.Phone, request.InitialPassword),
            cancellationToken);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    [HttpPut("{userId:guid}")]
    public async Task<ActionResult<TechnicianView>> Update(
        Guid userId,
        UpdateTechnicianRequest request,
        CancellationToken cancellationToken)
    {
        return Ok(await technicianService.UpdateAsync(
            User.GetUserId(),
            userId,
            new UpdateTechnicianCommand(request.FullName, request.Phone, request.Status),
            cancellationToken));
    }
}

public sealed class CreateTechnicianRequest
{
    [Required, EmailAddress]
    public string Email { get; init; } = string.Empty;

    [Required, StringLength(150, MinimumLength = 2)]
    public string FullName { get; init; } = string.Empty;

    [StringLength(20)]
    public string? Phone { get; init; }

    [Required, StringLength(100, MinimumLength = 8)]
    public string InitialPassword { get; init; } = string.Empty;
}

public sealed class UpdateTechnicianRequest
{
    [Required, StringLength(150, MinimumLength = 2)]
    public string FullName { get; init; } = string.Empty;

    [StringLength(20)]
    public string? Phone { get; init; }

    [Required]
    public AccountStatus Status { get; init; }
}
