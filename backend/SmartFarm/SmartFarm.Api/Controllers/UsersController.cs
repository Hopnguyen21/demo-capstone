using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartFarm.Api.Extensions;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Application.Features.Users;
using SmartFarm.Domain.Enums;

namespace SmartFarm.Api.Controllers;

[ApiController]
[Route("api/v1/users")]
public sealed class UsersController(IUserService userService) : ControllerBase
{
    // API catalog #6
    [Authorize(Roles = "FarmOwner")]
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<UserDetailView>>> List(
        [FromQuery] UserRole? role,
        CancellationToken cancellationToken)
    {
        return Ok(await userService.ListTenantUsersAsync(User.GetUserId(), role, cancellationToken));
    }

    // API catalog #11 (must precede the {userId} route semantically)
    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<UserDetailView>> Me(CancellationToken cancellationToken)
    {
        return Ok(await userService.GetCurrentUserAsync(User.GetUserId(), cancellationToken));
    }

    // API catalog #7
    [Authorize(Roles = "FarmOwner")]
    [HttpGet("{userId:guid}")]
    public async Task<ActionResult<UserDetailView>> Get(Guid userId, CancellationToken cancellationToken)
    {
        return Ok(await userService.GetTenantUserAsync(User.GetUserId(), userId, cancellationToken));
    }

    // API catalog #10
    [Authorize(Roles = "FarmOwner")]
    [HttpPost("invite")]
    public async Task<ActionResult<FarmerAssignmentView>> Invite(
        InviteFarmerRequest request,
        CancellationToken cancellationToken)
    {
        return Ok(await userService.InviteFarmerAsync(
            User.GetUserId(),
            new InviteFarmerCommand(request.Email, request.FarmId),
            cancellationToken));
    }

    // Auth contract USER-V1-01
    [Authorize(Roles = "FarmOwner")]
    [HttpPut("{userId:guid}/zone-access")]
    public async Task<ActionResult<ZoneAccessView>> ReplaceZoneAccess(
        Guid userId,
        ReplaceZoneAccessRequest request,
        CancellationToken cancellationToken)
    {
        return Ok(await userService.ReplaceZoneAccessAsync(
            User.GetUserId(),
            userId,
            new ReplaceZoneAccessCommand(request.Access.Select(x => new ZonePermissionCommand(x.ZoneId, x.CanControl)).ToList()),
            cancellationToken));
    }
}

public sealed class InviteFarmerRequest
{
    [Required, EmailAddress]
    public string Email { get; init; } = string.Empty;

    [Required]
    public Guid FarmId { get; init; }
}

public sealed class ReplaceZoneAccessRequest
{
    [Required]
    public IReadOnlyList<ZonePermissionRequest> Access { get; init; } = [];
}

public sealed class ZonePermissionRequest
{
    [Required]
    public Guid ZoneId { get; init; }

    public bool CanControl { get; init; }
}
