using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartFarm.Api.Extensions;
using SmartFarm.Application.Features.Users;

namespace SmartFarm.Api.Controllers;

/// <summary>Mời Farmer vào nhân công của Farm: Owner quản lý lời mời, Farmer chấp nhận hoặc từ chối. Không cấp quyền Zone.</summary>
[ApiController]
public sealed class FarmInvitationsController(IFarmInvitationService service) : ControllerBase
{
    [HttpGet("api/v1/farms/{farmId:guid}/invitations"), Authorize(Roles = "FarmOwner")]
    public async Task<ActionResult<IReadOnlyList<FarmInvitationView>>> ListForFarm(Guid farmId, CancellationToken ct) =>
        Ok(await service.ListForFarmAsync(User.GetUserId(), farmId, ct));

    [HttpPost("api/v1/farms/{farmId:guid}/invitations"), Authorize(Roles = "FarmOwner")]
    public async Task<ActionResult<FarmInvitationView>> Invite(Guid farmId, InviteByEmailRequest request, CancellationToken ct)
    {
        var invitation = await service.InviteAsync(User.GetUserId(), new InviteFarmerByEmailCommand(request.Email, farmId), ct);
        return Created($"/api/v1/farm-invitations/{invitation.Id}", invitation);
    }

    [HttpPost("api/v1/farm-invitations/{invitationId:guid}/resend"), Authorize(Roles = "FarmOwner")]
    public async Task<ActionResult<FarmInvitationView>> Resend(Guid invitationId, CancellationToken ct) =>
        Ok(await service.ResendAsync(User.GetUserId(), invitationId, ct));

    [HttpPost("api/v1/farm-invitations/{invitationId:guid}/cancel"), Authorize(Roles = "FarmOwner")]
    public async Task<ActionResult<FarmInvitationView>> Cancel(Guid invitationId, CancellationToken ct) =>
        Ok(await service.CancelAsync(User.GetUserId(), invitationId, ct));

    // Các API của Farmer không cần Tenant trong token: Farmer chưa vào Farm nào vẫn xem và phản hồi được lời mời gửi tới email của mình.
    [HttpGet("api/v1/farm-invitations/mine"), Authorize(Roles = "Farmer")]
    public async Task<ActionResult<IReadOnlyList<FarmInvitationView>>> Mine(CancellationToken ct) =>
        Ok(await service.ListMineAsync(User.GetUserId(), ct));

    [HttpPost("api/v1/farm-invitations/{invitationId:guid}/accept"), Authorize(Roles = "Farmer")]
    public async Task<ActionResult<FarmInvitationView>> Accept(Guid invitationId, CancellationToken ct) =>
        Ok(await service.AcceptAsync(User.GetUserId(), invitationId, ct));

    [HttpPost("api/v1/farm-invitations/{invitationId:guid}/decline"), Authorize(Roles = "Farmer")]
    public async Task<ActionResult<FarmInvitationView>> Decline(Guid invitationId, CancellationToken ct) =>
        Ok(await service.DeclineAsync(User.GetUserId(), invitationId, ct));
}

public sealed class InviteByEmailRequest
{
    [Required, EmailAddress, StringLength(320)]
    public string Email { get; init; } = string.Empty;
}
