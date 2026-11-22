using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartFarm.Api.Extensions;
using SmartFarm.Application.Common.Exceptions;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Application.Features.Users;
using SmartFarm.Domain.Enums;

namespace SmartFarm.Api.Controllers;

[ApiController]
[Route("api/v1/users")]
public sealed class UsersController(IUserService userService, IFarmInvitationService invitations) : ControllerBase
{
    // API catalog #6
    [Authorize(Roles = "FarmOwner,PlatformAdmin")]
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

    [HttpPut("me")]
    public async Task<ActionResult<UserDetailView>> UpdateMe(
        [FromBody] UpdateUserProfileRequest request,
        CancellationToken cancellationToken)
    {
        return Ok(await userService.UpdateCurrentUserProfileAsync(
            User.GetUserId(),
            new UpdateUserProfileCommand(request.FullName, request.Phone),
            cancellationToken));
    }

    [Authorize]
    [HttpPost("me/change-password")]
    [HttpPut("me/password")]
    public async Task<IActionResult> ChangePassword(
        [FromBody] ChangePasswordRequest request,
        CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(request.ConfirmPassword) && request.NewPassword != request.ConfirmPassword)
        {
            throw new RequestValidationException(nameof(request.ConfirmPassword), "Xác nhận mật khẩu mới không khớp.");
        }

        await userService.ChangePasswordAsync(
            User.GetUserId(),
            new ChangePasswordCommand(request.CurrentPassword, request.NewPassword),
            cancellationToken);

        return Ok(new { message = "Đổi mật khẩu thành công!" });
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
    public async Task<ActionResult<FarmInvitationView>> Invite(
        InviteFarmerRequest request,
        CancellationToken cancellationToken)
    {
        // Không gắn Farmer vào Farm ngay: tạo lời mời chờ Farmer chấp nhận.
        var invitation = await invitations.InviteAsync(User.GetUserId(), new InviteFarmerByEmailCommand(request.Email, request.FarmId), cancellationToken);
        return Created($"/api/v1/farm-invitations/{invitation.Id}", invitation);
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

    // PlatformAdmin: Tạo tài khoản & Phân quyền trực tiếp
    [Authorize(Roles = "PlatformAdmin")]
    [HttpPost]
    public async Task<ActionResult<UserDetailView>> Create(
        [FromBody] CreateUserRequest request,
        CancellationToken ct)
    {
        var user = await userService.CreateUserAsync(
            User.GetUserId(),
            new CreateUserCommand(request.Email, request.FullName, request.Phone, request.Role, request.Password, request.TenantId, request.FarmId),
            ct);
        return Created($"/api/v1/users/{user.UserId}", user);
    }

    // PlatformAdmin: Cập nhật thông tin & Phân quyền lại vai trò
    [Authorize(Roles = "PlatformAdmin")]
    [HttpPut("{userId:guid}")]
    public async Task<ActionResult<UserDetailView>> Update(
        Guid userId,
        [FromBody] UpdateUserRequest request,
        CancellationToken ct)
    {
        return Ok(await userService.UpdateUserAsync(
            User.GetUserId(),
            userId,
            new UpdateUserCommand(request.FullName, request.Phone, request.Role, request.Status, request.TenantId, request.FarmId),
            ct));
    }

    // PlatformAdmin: Khóa / Mở khóa nhanh tài khoản
    [Authorize(Roles = "PlatformAdmin")]
    [HttpPatch("{userId:guid}/toggle-status")]
    public async Task<ActionResult<UserDetailView>> ToggleStatus(
        Guid userId,
        CancellationToken ct)
    {
        return Ok(await userService.ToggleUserStatusAsync(User.GetUserId(), userId, ct));
    }

    // PlatformAdmin: Đặt lại mật khẩu cho tài khoản
    [Authorize(Roles = "PlatformAdmin")]
    [HttpPost("{userId:guid}/reset-password")]
    public async Task<IActionResult> ResetPassword(
        Guid userId,
        [FromBody] ResetUserPasswordRequest request,
        CancellationToken ct)
    {
        await userService.ResetUserPasswordAsync(User.GetUserId(), userId, new ResetUserPasswordCommand(request.NewPassword), ct);
        return Ok(new { message = "Đặt lại mật khẩu thành công!" });
    }

    // PlatformAdmin: Xóa tài khoản người dùng
    [Authorize(Roles = "PlatformAdmin")]
    [HttpDelete("{userId:guid}")]
    public async Task<IActionResult> Delete(
        Guid userId,
        CancellationToken ct)
    {
        await userService.DeleteUserAsync(User.GetUserId(), userId, ct);
        return NoContent();
    }
}

public sealed class CreateUserRequest
{
    [Required, EmailAddress]
    public string Email { get; init; } = string.Empty;

    [Required, StringLength(100, MinimumLength = 2)]
    public string FullName { get; init; } = string.Empty;

    [StringLength(20)]
    public string? Phone { get; init; }

    [Required]
    public UserRole Role { get; init; }

    [Required, StringLength(100, MinimumLength = 8)]
    public string Password { get; init; } = string.Empty;

    public Guid? TenantId { get; init; }
    public Guid? FarmId { get; init; }
}

public sealed class UpdateUserRequest
{
    [Required, StringLength(100, MinimumLength = 2)]
    public string FullName { get; init; } = string.Empty;

    [StringLength(20)]
    public string? Phone { get; init; }

    [Required]
    public UserRole Role { get; init; }

    [Required]
    public AccountStatus Status { get; init; }

    public Guid? TenantId { get; init; }
    public Guid? FarmId { get; init; }
}

public sealed class ResetUserPasswordRequest
{
    [Required, StringLength(100, MinimumLength = 8)]
    public string NewPassword { get; init; } = string.Empty;
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
