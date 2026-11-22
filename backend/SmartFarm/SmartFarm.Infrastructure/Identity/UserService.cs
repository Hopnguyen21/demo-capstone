using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using SmartFarm.Application.Common.Exceptions;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Application.Features.Users;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;

namespace SmartFarm.Infrastructure.Identity;

internal sealed class UserService(
    SmartFarmDbContext dbContext,
    TimeProvider timeProvider,
    IPasswordHasher<AppUser> passwordHasher) : IUserService
{
    public async Task<IReadOnlyList<UserDetailView>> ListTenantUsersAsync(
        Guid ownerUserId,
        UserRole? role,
        CancellationToken cancellationToken)
    {
        var caller = await dbContext.AppUsers.SingleOrDefaultAsync(x => x.Id == ownerUserId, cancellationToken);
        var query = dbContext.AppUsers
            .AsNoTracking()
            .Include(x => x.Tenant)
            .Include(x => x.ZoneAccesses)
            .AsQueryable();

        if (caller?.Role != UserRole.PlatformAdmin)
        {
            var owner = await GetOwnerAsync(ownerUserId, cancellationToken);
            query = query.Where(x => x.TenantId == owner.TenantId);
        }
        if (role.HasValue)
        {
            query = query.Where(x => x.Role == role.Value);
        }

        var users = await query.OrderBy(x => x.FullName).ToListAsync(cancellationToken);
        return users.Select(ToDetailView).ToList();
    }

    public async Task<UserDetailView> GetTenantUserAsync(Guid ownerUserId, Guid userId, CancellationToken cancellationToken)
    {
        var owner = await GetOwnerAsync(ownerUserId, cancellationToken);
        var user = await dbContext.AppUsers
            .AsNoTracking()
            .Include(x => x.ZoneAccesses)
            .SingleOrDefaultAsync(x => x.Id == userId && x.TenantId == owner.TenantId, cancellationToken);

        return user is null
            ? throw new ResourceNotFoundException("User was not found in the current Tenant.")
            : ToDetailView(user);
    }

    public async Task<UserDetailView> GetCurrentUserAsync(Guid userId, CancellationToken cancellationToken)
    {
        var user = await dbContext.AppUsers
            .AsNoTracking()
            .Include(x => x.ZoneAccesses)
            .SingleOrDefaultAsync(x => x.Id == userId, cancellationToken);

        return user is null
            ? throw new ResourceNotFoundException("User was not found.")
            : ToDetailView(user);
    }

    public async Task<UserDetailView> UpdateCurrentUserProfileAsync(
        Guid userId,
        UpdateUserProfileCommand command,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(command.FullName))
        {
            throw new RequestValidationException(nameof(command.FullName), "Họ và tên không được để trống.");
        }

        var trimmedName = command.FullName.Trim();
        if (trimmedName.Length is < 2 or > 100)
        {
            throw new RequestValidationException(nameof(command.FullName), "Họ và tên phải từ 2 đến 100 ký tự.");
        }

        string? trimmedPhone = null;
        if (!string.IsNullOrWhiteSpace(command.Phone))
        {
            trimmedPhone = command.Phone.Trim();
            if (trimmedPhone.Length > 20)
            {
                throw new RequestValidationException(nameof(command.Phone), "Số điện thoại không được vượt quá 20 ký tự.");
            }
        }

        var user = await dbContext.AppUsers
            .Include(x => x.ZoneAccesses)
            .SingleOrDefaultAsync(x => x.Id == userId, cancellationToken)
            ?? throw new ResourceNotFoundException("Không tìm thấy thông tin tài khoản người dùng.");

        // Strictly only allow updating FullName and Phone
        user.FullName = trimmedName;
        user.Phone = trimmedPhone;

        await dbContext.SaveChangesAsync(cancellationToken);
        return ToDetailView(user);
    }

    public async Task ChangePasswordAsync(Guid userId, ChangePasswordCommand command, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(command.CurrentPassword))
        {
            throw new RequestValidationException(nameof(command.CurrentPassword), "Mật khẩu hiện tại không được để trống.");
        }

        if (string.IsNullOrWhiteSpace(command.NewPassword))
        {
            throw new RequestValidationException(nameof(command.NewPassword), "Mật khẩu mới không được để trống.");
        }

        AuthService.ValidatePassword(command.NewPassword);

        var user = await dbContext.AppUsers
            .SingleOrDefaultAsync(x => x.Id == userId, cancellationToken)
            ?? throw new ResourceNotFoundException("Tài khoản người dùng không tồn tại.");

        var verify = passwordHasher.VerifyHashedPassword(user, user.PasswordHash, command.CurrentPassword);
        if (verify == PasswordVerificationResult.Failed)
        {
            throw new RequestValidationException(nameof(command.CurrentPassword), "Mật khẩu hiện tại không chính xác.");
        }

        if (command.CurrentPassword == command.NewPassword)
        {
            throw new RequestValidationException(nameof(command.NewPassword), "Mật khẩu mới không được trùng với mật khẩu hiện tại.");
        }

        user.PasswordHash = passwordHasher.HashPassword(user, command.NewPassword);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task<ZoneAccessView> ReplaceZoneAccessAsync(
        Guid ownerUserId,
        Guid farmerUserId,
        ReplaceZoneAccessCommand command,
        CancellationToken cancellationToken)
    {
        var owner = await GetOwnerAsync(ownerUserId, cancellationToken);
        var farmer = await dbContext.AppUsers
            .Include(x => x.ZoneAccesses)
            .SingleOrDefaultAsync(
                x => x.Id == farmerUserId && x.TenantId == owner.TenantId && x.Role == UserRole.Farmer,
                cancellationToken);
        if (farmer?.FarmId is null)
        {
            throw new ResourceNotFoundException("Assigned Farmer was not found in the current Tenant.");
        }

        var duplicateZone = command.Access.GroupBy(x => x.ZoneId).FirstOrDefault(x => x.Count() > 1);
        if (duplicateZone is not null)
        {
            throw new RequestValidationException(nameof(command.Access), "Zone IDs must be unique.");
        }

        var requestedZoneIds = command.Access.Select(x => x.ZoneId).ToArray();
        var validZoneIds = await dbContext.Zones
            .Where(x => requestedZoneIds.Contains(x.Id) && x.Field.FarmId == farmer.FarmId)
            .Select(x => x.Id)
            .ToListAsync(cancellationToken);
        if (validZoneIds.Count != requestedZoneIds.Length)
        {
            throw new ResourceNotFoundException("One or more Zones are outside the Farmer's assigned Farm.");
        }

        var now = timeProvider.GetUtcNow().UtcDateTime;
        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);
        dbContext.UserZoneAccesses.RemoveRange(farmer.ZoneAccesses);
        var newAccess = command.Access.Select(x => new UserZoneAccess
        {
            AppUserId = farmer.Id,
            ZoneId = x.ZoneId,
            CanControl = x.CanControl,
            AssignedAtUtc = now
        }).ToList();
        dbContext.UserZoneAccesses.AddRange(newAccess);
        await dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return new ZoneAccessView(
            farmer.Id,
            farmer.FarmId.Value,
            newAccess.Select(x => new ZonePermissionView(x.ZoneId, x.CanControl)).ToList(),
            now);
    }

    public async Task<UserDetailView> CreateUserAsync(Guid callerUserId, CreateUserCommand command, CancellationToken cancellationToken)
    {
        var caller = await dbContext.AppUsers.SingleOrDefaultAsync(x => x.Id == callerUserId, cancellationToken)
            ?? throw new UnauthorizedAccessException("Người dùng không hợp lệ.");

        if (caller.Role != UserRole.PlatformAdmin)
        {
            throw new AuthorizationException("Chỉ Quản trị viên Nền tảng (PlatformAdmin) mới có quyền tạo tài khoản trực tiếp.");
        }

        if (string.IsNullOrWhiteSpace(command.FullName) || command.FullName.Trim().Length < 2)
            throw new RequestValidationException(nameof(command.FullName), "Họ và tên phải từ 2 ký tự trở lên.");

        if (string.IsNullOrWhiteSpace(command.Email))
            throw new RequestValidationException(nameof(command.Email), "Email không được để trống.");

        var normalizedEmail = command.Email.Trim().ToUpperInvariant();
        if (await dbContext.AppUsers.AnyAsync(x => x.NormalizedEmail == normalizedEmail, cancellationToken))
            throw new ResourceConflictException("Email này đã được sử dụng bởi một tài khoản khác.");

        AuthService.ValidatePassword(command.Password);

        var now = timeProvider.GetUtcNow().UtcDateTime;
        var user = new AppUser
        {
            Id = Guid.NewGuid(),
            Email = command.Email.Trim(),
            NormalizedEmail = normalizedEmail,
            FullName = command.FullName.Trim(),
            Phone = string.IsNullOrWhiteSpace(command.Phone) ? null : command.Phone.Trim(),
            Role = command.Role,
            Status = AccountStatus.Active,
            TenantId = command.TenantId,
            FarmId = command.FarmId,
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };
        user.PasswordHash = passwordHasher.HashPassword(user, command.Password);

        dbContext.AppUsers.Add(user);
        await dbContext.SaveChangesAsync(cancellationToken);

        if (user.TenantId.HasValue)
        {
            await dbContext.Entry(user).Reference(x => x.Tenant).LoadAsync(cancellationToken);
        }

        return ToDetailView(user);
    }

    public async Task<UserDetailView> UpdateUserAsync(Guid callerUserId, Guid targetUserId, UpdateUserCommand command, CancellationToken cancellationToken)
    {
        var caller = await dbContext.AppUsers.SingleOrDefaultAsync(x => x.Id == callerUserId, cancellationToken)
            ?? throw new UnauthorizedAccessException("Người dùng không hợp lệ.");

        if (caller.Role != UserRole.PlatformAdmin)
            throw new AuthorizationException("Chỉ Quản trị viên Nền tảng mới có quyền cập nhật phân quyền tài khoản.");

        if (string.IsNullOrWhiteSpace(command.FullName) || command.FullName.Trim().Length < 2)
            throw new RequestValidationException(nameof(command.FullName), "Họ và tên phải từ 2 ký tự trở lên.");

        var user = await dbContext.AppUsers
            .Include(x => x.Tenant)
            .Include(x => x.ZoneAccesses)
            .SingleOrDefaultAsync(x => x.Id == targetUserId, cancellationToken)
            ?? throw new ResourceNotFoundException("Tài khoản người dùng không tồn tại.");

        if (callerUserId == targetUserId && command.Role != UserRole.PlatformAdmin)
            throw new RequestValidationException(nameof(command.Role), "Bạn không thể tự hạ quyền Quản trị viên của chính mình.");

        if (callerUserId == targetUserId && command.Status is AccountStatus.Locked or AccountStatus.Disabled)
            throw new RequestValidationException(nameof(command.Status), "Bạn không thể tự khóa hoặc vô hiệu hóa tài khoản của chính mình.");

        user.FullName = command.FullName.Trim();
        user.Phone = string.IsNullOrWhiteSpace(command.Phone) ? null : command.Phone.Trim();
        user.Role = command.Role;
        user.Status = command.Status;
        if (command.TenantId.HasValue) user.TenantId = command.TenantId.Value;
        if (command.FarmId.HasValue) user.FarmId = command.FarmId.Value;
        user.UpdatedAtUtc = timeProvider.GetUtcNow().UtcDateTime;

        await dbContext.SaveChangesAsync(cancellationToken);
        return ToDetailView(user);
    }

    public async Task<UserDetailView> ToggleUserStatusAsync(Guid callerUserId, Guid targetUserId, CancellationToken cancellationToken)
    {
        var caller = await dbContext.AppUsers.SingleOrDefaultAsync(x => x.Id == callerUserId, cancellationToken)
            ?? throw new UnauthorizedAccessException("Người dùng không hợp lệ.");

        if (caller.Role != UserRole.PlatformAdmin)
            throw new AuthorizationException("Chỉ Quản trị viên Nền tảng mới có quyền khóa/mở khóa tài khoản.");

        if (callerUserId == targetUserId)
            throw new RequestValidationException("userId", "Bạn không thể tự khóa tài khoản của chính mình.");

        var user = await dbContext.AppUsers
            .Include(x => x.Tenant)
            .Include(x => x.ZoneAccesses)
            .SingleOrDefaultAsync(x => x.Id == targetUserId, cancellationToken)
            ?? throw new ResourceNotFoundException("Tài khoản người dùng không tồn tại.");

        if (user.Status == AccountStatus.Active)
        {
            user.Status = AccountStatus.Locked;
        }
        else
        {
            user.Status = AccountStatus.Active;
            user.FailedLoginAttempts = 0;
            user.LockedUntilUtc = null;
        }

        user.UpdatedAtUtc = timeProvider.GetUtcNow().UtcDateTime;
        await dbContext.SaveChangesAsync(cancellationToken);
        return ToDetailView(user);
    }

    public async Task ResetUserPasswordAsync(Guid callerUserId, Guid targetUserId, ResetUserPasswordCommand command, CancellationToken cancellationToken)
    {
        var caller = await dbContext.AppUsers.SingleOrDefaultAsync(x => x.Id == callerUserId, cancellationToken)
            ?? throw new UnauthorizedAccessException("Người dùng không hợp lệ.");

        if (caller.Role != UserRole.PlatformAdmin)
            throw new AuthorizationException("Chỉ Quản trị viên Nền tảng mới có quyền đặt lại mật khẩu cho tài khoản khác.");

        AuthService.ValidatePassword(command.NewPassword);

        var user = await dbContext.AppUsers
            .SingleOrDefaultAsync(x => x.Id == targetUserId, cancellationToken)
            ?? throw new ResourceNotFoundException("Tài khoản người dùng không tồn tại.");

        user.PasswordHash = passwordHasher.HashPassword(user, command.NewPassword);
        user.FailedLoginAttempts = 0;
        user.LockedUntilUtc = null;
        if (user.Status == AccountStatus.Locked) user.Status = AccountStatus.Active;
        user.UpdatedAtUtc = timeProvider.GetUtcNow().UtcDateTime;

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task DeleteUserAsync(Guid callerUserId, Guid targetUserId, CancellationToken cancellationToken)
    {
        var caller = await dbContext.AppUsers.SingleOrDefaultAsync(x => x.Id == callerUserId, cancellationToken)
            ?? throw new UnauthorizedAccessException("Người dùng không hợp lệ.");

        if (caller.Role != UserRole.PlatformAdmin)
            throw new AuthorizationException("Chỉ Quản trị viên Nền tảng mới có quyền xóa tài khoản.");

        if (callerUserId == targetUserId)
            throw new RequestValidationException("userId", "Bạn không thể tự xóa tài khoản của chính mình.");

        var user = await dbContext.AppUsers
            .Include(x => x.ZoneAccesses)
            .Include(x => x.RefreshTokens)
            .SingleOrDefaultAsync(x => x.Id == targetUserId, cancellationToken)
            ?? throw new ResourceNotFoundException("Tài khoản người dùng không tồn tại.");

        dbContext.UserZoneAccesses.RemoveRange(user.ZoneAccesses);
        dbContext.RefreshTokens.RemoveRange(user.RefreshTokens);
        dbContext.AppUsers.Remove(user);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task<AppUser> GetOwnerAsync(Guid userId, CancellationToken cancellationToken)
    {
        var owner = await dbContext.AppUsers.SingleOrDefaultAsync(x => x.Id == userId, cancellationToken);
        if (owner is null || owner.Role != UserRole.FarmOwner || !owner.TenantId.HasValue)
        {
            throw new AuthorizationException("A FarmOwner with a Tenant is required.");
        }

        return owner;
    }

    private static UserDetailView ToDetailView(AppUser user) => new(
        user.Id,
        user.Email,
        user.FullName,
        user.Phone,
        user.Role,
        user.Status,
        user.TenantId,
        user.FarmId,
        user.LastLoginAtUtc,
        user.ZoneAccesses.Select(x => new ZonePermissionView(x.ZoneId, x.CanControl)).ToList(),
        user.Tenant?.CompanyName,
        user.CreatedAtUtc);
}
