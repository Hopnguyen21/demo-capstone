using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartFarm.Api.Extensions;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Application.Features.Auth;
using SmartFarm.Domain.Enums;
using Microsoft.AspNetCore.RateLimiting;

namespace SmartFarm.Api.Controllers;

[ApiController]
[Route("api/v1/auth")]
public sealed class AuthController(IAuthService authService) : ControllerBase
{
    [AllowAnonymous]
    [EnableRateLimiting("LoginPolicy")]
    [HttpPost("register")]
    [ProducesResponseType<UserView>(StatusCodes.Status201Created)]
    public async Task<ActionResult<UserView>> Register(RegisterRequest request, CancellationToken cancellationToken)
    {
        var result = await authService.RegisterAsync(
            new RegisterUserCommand(request.Email, request.FullName, request.Phone, request.Password, request.Role),
            cancellationToken);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    // API catalog #1
    [AllowAnonymous]
    [EnableRateLimiting("LoginPolicy")]
    [HttpPost("login")]
    public async Task<ActionResult<AuthTokenView>> Login(LoginRequest request, CancellationToken cancellationToken)
    {
        return Ok(await authService.LoginAsync(new LoginCommand(request.Email, request.Password), cancellationToken));
    }

    // API catalog #2
    [Authorize]
    [HttpPost("logout")]
    public async Task<ActionResult<LogoutView>> Logout(LogoutRequest request, CancellationToken cancellationToken)
    {
        return Ok(await authService.LogoutAsync(
            User.GetUserId(),
            User.GetTokenJti(),
            new LogoutCommand(request.RefreshToken, request.RevokeAllDevices),
            cancellationToken));
    }

    // API catalog #3
    [AllowAnonymous]
    [HttpPost("refresh")]
    public async Task<ActionResult<AuthTokenView>> Refresh(RefreshRequest request, CancellationToken cancellationToken)
    {
        return Ok(await authService.RefreshAsync(request.RefreshToken, cancellationToken));
    }

    [AllowAnonymous]
    [HttpPost("forgot-password")]
    public async Task<ActionResult<ForgotPasswordResponse>> ForgotPassword(
        [FromBody] ForgotPasswordRequest request,
        CancellationToken cancellationToken)
    {
        return Ok(await authService.ForgotPasswordAsync(new ForgotPasswordCommand(request.Email), cancellationToken));
    }

    [AllowAnonymous]
    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword(
        [FromBody] ResetPasswordRequest request,
        CancellationToken cancellationToken)
    {
        await authService.ResetPasswordAsync(new ResetPasswordCommand(request.Email, request.Otp, request.NewPassword), cancellationToken);
        return Ok(new { message = "Đặt lại mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới." });
    }
}

public sealed class RegisterRequest
{
    [Required, EmailAddress]
    public string Email { get; init; } = string.Empty;

    [Required, StringLength(150, MinimumLength = 2)]
    public string FullName { get; init; } = string.Empty;

    [StringLength(20)]
    public string? Phone { get; init; }

    [Required, StringLength(100, MinimumLength = 8)]
    public string Password { get; init; } = string.Empty;

    [Required]
    public UserRole Role { get; init; }
}

public sealed class LoginRequest
{
    [Required, EmailAddress]
    public string Email { get; init; } = string.Empty;

    [Required, StringLength(100, MinimumLength = 1)]
    public string Password { get; init; } = string.Empty;
}

public sealed class RefreshRequest
{
    [Required]
    public string RefreshToken { get; init; } = string.Empty;
}

public sealed class LogoutRequest
{
    public string? RefreshToken { get; init; }
    public bool RevokeAllDevices { get; init; }
}

public sealed class ForgotPasswordRequest
{
    [Required, EmailAddress]
    public string Email { get; init; } = string.Empty;
}

public sealed class ResetPasswordRequest
{
    [Required, EmailAddress]
    public string Email { get; init; } = string.Empty;

    [Required]
    public string Otp { get; init; } = string.Empty;

    [Required, StringLength(100, MinimumLength = 8)]
    public string NewPassword { get; init; } = string.Empty;
}
