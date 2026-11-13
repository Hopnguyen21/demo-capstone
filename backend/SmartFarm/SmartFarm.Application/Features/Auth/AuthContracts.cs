using SmartFarm.Domain.Enums;

namespace SmartFarm.Application.Features.Auth;

public sealed record RegisterUserCommand(string Email, string FullName, string? Phone, string Password, UserRole Role);
public sealed record LoginCommand(string Email, string Password);
public sealed record LogoutCommand(string? RefreshToken, bool RevokeAllDevices);

public sealed record ForgotPasswordCommand(string Email);
public sealed record ForgotPasswordResponse(string Message, string? DemoOtp, DateTime ExpiresAtUtc);
public sealed record ResetPasswordCommand(string Email, string Otp, string NewPassword);

public sealed record UserView(
    Guid UserId,
    string Email,
    string FullName,
    UserRole Role,
    AccountStatus Status,
    Guid? TenantId,
    Guid? FarmId,
    DateTime CreatedAtUtc);

public sealed record AuthTokenView(
    string AccessToken,
    string RefreshToken,
    int ExpiresIn,
    string TokenType,
    UserView User);

public sealed record LogoutView(DateTime RevokedAtUtc, int RevokedSessions);
