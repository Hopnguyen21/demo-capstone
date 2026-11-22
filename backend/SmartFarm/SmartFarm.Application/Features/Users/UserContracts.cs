using SmartFarm.Domain.Enums;

namespace SmartFarm.Application.Features.Users;

public sealed record UserDetailView(
    Guid UserId,
    string Email,
    string FullName,
    string? Phone,
    UserRole Role,
    AccountStatus Status,
    Guid? TenantId,
    Guid? FarmId,
    DateTime? LastLoginAtUtc,
    IReadOnlyList<ZonePermissionView> ZoneAccess,
    string? TenantName = null,
    DateTime? CreatedAtUtc = null);

public sealed record ZonePermissionCommand(Guid ZoneId, bool CanControl);
public sealed record ReplaceZoneAccessCommand(IReadOnlyList<ZonePermissionCommand> Access);
public sealed record ZonePermissionView(Guid ZoneId, bool CanControl);
public sealed record ZoneAccessView(Guid UserId, Guid FarmId, IReadOnlyList<ZonePermissionView> Access, DateTime UpdatedAtUtc);

public sealed record UpdateUserProfileRequest(string FullName, string? Phone);
public sealed record UpdateUserProfileCommand(string FullName, string? Phone);

public sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword, string? ConfirmPassword = null);
public sealed record ChangePasswordCommand(string CurrentPassword, string NewPassword);

public sealed record CreateUserCommand(string Email, string FullName, string? Phone, UserRole Role, string Password, Guid? TenantId = null, Guid? FarmId = null);
public sealed record UpdateUserCommand(string FullName, string? Phone, UserRole Role, AccountStatus Status, Guid? TenantId = null, Guid? FarmId = null);
public sealed record ResetUserPasswordCommand(string NewPassword);
