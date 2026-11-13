using System.Collections.Concurrent;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SmartFarm.Application.Common.Exceptions;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Application.Features.Auth;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;

namespace SmartFarm.Infrastructure.Identity;

internal sealed class AuthService(
    SmartFarmDbContext dbContext,
    IPasswordHasher<AppUser> passwordHasher,
    IJwtTokenGenerator tokenGenerator,
    IOptions<JwtOptions> jwtOptions,
    TimeProvider timeProvider) : IAuthService
{
    private static readonly ConcurrentDictionary<string, (string Otp, DateTime ExpiresAtUtc)> ResetOtps = new();
    private static readonly ConcurrentDictionary<string, (string Otp, DateTime ExpiresAtUtc)> ResetOtps = new();

    public async Task<UserView> RegisterAsync(RegisterUserCommand command, CancellationToken cancellationToken)
    {
        if (command.Role is not (UserRole.FarmOwner or UserRole.Farmer))
        {
            throw new RequestValidationException(nameof(command.Role), "Public registration allows only FarmOwner or Farmer.");
        }

        ValidatePassword(command.Password);
        var normalizedEmail = NormalizeEmail(command.Email);
        if (await dbContext.AppUsers.AnyAsync(x => x.NormalizedEmail == normalizedEmail, cancellationToken))
        {
            throw new ResourceConflictException("An account with this email already exists.");
        }

        var now = timeProvider.GetUtcNow().UtcDateTime;
        var user = new AppUser
        {
            Email = command.Email.Trim(),
            NormalizedEmail = normalizedEmail,
            FullName = RequireText(command.FullName, nameof(command.FullName), 150),
            Phone = NormalizeOptional(command.Phone, 20),
            Role = command.Role,
            Status = AccountStatus.Active,
            CreatedAtUtc = now
        };
        user.PasswordHash = passwordHasher.HashPassword(user, command.Password);
        dbContext.AppUsers.Add(user);
        await dbContext.SaveChangesAsync(cancellationToken);

        return ToView(user);
    }

    public async Task<AuthTokenView> LoginAsync(LoginCommand command, CancellationToken cancellationToken)
    {
        var normalizedEmail = NormalizeEmail(command.Email);
        var user = await dbContext.AppUsers.SingleOrDefaultAsync(x => x.NormalizedEmail == normalizedEmail, cancellationToken);
        if (user is null)
        {
            throw new AuthenticationException("Invalid email or password.");
        }

        var now = timeProvider.GetUtcNow().UtcDateTime;
        if (user.Status == AccountStatus.Locked && user.LockedUntilUtc <= now)
        {
            user.Status = AccountStatus.Active;
            user.LockedUntilUtc = null;
            user.FailedLoginAttempts = 0;
        }

        if (user.Status == AccountStatus.Locked || user.LockedUntilUtc > now)
        {
            throw new AuthorizationException("The account is temporarily locked.");
        }

        if (user.Status != AccountStatus.Active)
        {
            throw new AuthorizationException("The account is not active.");
        }

        var passwordResult = passwordHasher.VerifyHashedPassword(user, user.PasswordHash, command.Password);
        if (passwordResult == PasswordVerificationResult.Failed)
        {
            user.FailedLoginAttempts++;
            if (user.FailedLoginAttempts >= 5)
            {
                user.Status = AccountStatus.Locked;
                user.LockedUntilUtc = now.AddMinutes(15);
            }

            await dbContext.SaveChangesAsync(cancellationToken);
            throw new AuthenticationException("Invalid email or password.");
        }

        if (passwordResult == PasswordVerificationResult.SuccessRehashNeeded)
        {
            user.PasswordHash = passwordHasher.HashPassword(user, command.Password);
        }

        user.FailedLoginAttempts = 0;
        user.LockedUntilUtc = null;
        user.LastLoginAtUtc = now;

        var access = tokenGenerator.GenerateAccessToken(user);
        var rawRefreshToken = tokenGenerator.GenerateRefreshToken();
        var hashedRefreshToken = TokenHash.Create(rawRefreshToken);

        dbContext.RefreshTokens.Add(new RefreshToken
        {
            AppUserId = user.Id,
            TokenHash = hashedRefreshToken,
            AccessTokenJti = access.Jti,
            AccessTokenExpiresAtUtc = access.ExpiresAtUtc,
            ExpiresAtUtc = now.AddDays(jwtOptions.Value.RefreshTokenDays),
            CreatedAtUtc = now
        });

        await dbContext.SaveChangesAsync(cancellationToken);

        var expiresIn = Math.Max(0, (int)(access.ExpiresAtUtc - now).TotalSeconds);
        return new AuthTokenView(access.Token, rawRefreshToken, expiresIn, "Bearer", ToView(user));
    }

    public async Task<LogoutView> LogoutAsync(Guid userId, string accessTokenJti, LogoutCommand command, CancellationToken cancellationToken)
    {
        var now = timeProvider.GetUtcNow().UtcDateTime;
        var query = dbContext.RefreshTokens
            .Where(x => x.AppUserId == userId && !x.IsRevoked && x.ExpiresAtUtc > now);

        if (!command.RevokeAllDevices)
        {
            if (string.IsNullOrWhiteSpace(command.RefreshToken))
            {
                throw new RequestValidationException(nameof(command.RefreshToken), "RefreshToken is required when revokeAllDevices is false.");
            }

            var hashed = TokenHash.Create(command.RefreshToken);
            query = query.Where(x => x.TokenHash == hashed || x.AccessTokenJti == accessTokenJti);
        }

        var tokens = await query.ToListAsync(cancellationToken);
        foreach (var token in tokens)
        {
            token.IsRevoked = true;
            token.RevokedAtUtc = now;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return new LogoutView(now, tokens.Count);
    }

    public async Task<AuthTokenView> RefreshAsync(string refreshToken, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(refreshToken))
        {
            throw new RequestValidationException(nameof(refreshToken), "RefreshToken is required.");
        }

        var hashed = TokenHash.Create(refreshToken);
        var now = timeProvider.GetUtcNow().UtcDateTime;
        var existing = await dbContext.RefreshTokens
            .Include(x => x.AppUser)
            .SingleOrDefaultAsync(x => x.TokenHash == hashed, cancellationToken);

        if (existing is null || existing.IsRevoked || existing.ExpiresAtUtc <= now)
        {
            throw new AuthenticationException("Invalid or expired refresh token.");
        }

        var user = existing.AppUser;
        if (user.Status != AccountStatus.Active)
        {
            throw new AuthorizationException("The account is not active.");
        }

        existing.IsRevoked = true;
        existing.RevokedAtUtc = now;

    public async Task<ForgotPasswordResponse> ForgotPasswordAsync(ForgotPasswordCommand command, CancellationToken cancellationToken)
    {
        var normalizedEmail = NormalizeEmail(command.Email);
        var user = await dbContext.AppUsers.SingleOrDefaultAsync(x => x.NormalizedEmail == normalizedEmail, cancellationToken);
        var expires = DateTime.UtcNow.AddMinutes(15);

        if (user is null)
        {
            return new ForgotPasswordResponse(
                "Nếu email tồn tại trong hệ thống, mã xác nhận OTP đặt lại mật khẩu đã được tạo.",
                null,
                expires);
        }

        var otp = new Random().Next(100000, 999999).ToString();
        ResetOtps[normalizedEmail] = (otp, expires);

        return new ForgotPasswordResponse(
            "Mã xác nhận OTP đặt lại mật khẩu đã được tạo (hiệu lực trong 15 phút).",
            otp,
            expires);
    }

    public async Task ResetPasswordAsync(ResetPasswordCommand command, CancellationToken cancellationToken)
    {
        var normalizedEmail = NormalizeEmail(command.Email);
        if (string.IsNullOrWhiteSpace(command.Otp))
        {
            throw new RequestValidationException(nameof(command.Otp), "Mã OTP xác thực không được để trống.");
        }

        if (!ResetOtps.TryGetValue(normalizedEmail, out var entry) || entry.ExpiresAtUtc < DateTime.UtcNow || entry.Otp != command.Otp.Trim())
        {
            throw new RequestValidationException(nameof(command.Otp), "Mã xác thực OTP không chính xác hoặc đã hết hạn.");
        }

        ValidatePassword(command.NewPassword);

        var user = await dbContext.AppUsers
            .Include(x => x.RefreshTokens)
            .SingleOrDefaultAsync(x => x.NormalizedEmail == normalizedEmail, cancellationToken)
            ?? throw new ResourceNotFoundException("Tài khoản không tồn tại.");

        user.PasswordHash = passwordHasher.HashPassword(user, command.NewPassword);
        user.FailedLoginAttempts = 0;
        user.LockedUntilUtc = null;
        if (user.Status == AccountStatus.Locked) user.Status = AccountStatus.Active;

        var now = timeProvider.GetUtcNow().UtcDateTime;
        foreach (var rt in user.RefreshTokens.Where(t => !t.RevokedAtUtc.HasValue))
        {
            rt.RevokedAtUtc = now;
        }

        ResetOtps.TryRemove(normalizedEmail, out _);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

        var access = tokenGenerator.GenerateAccessToken(user);
        var rawRefreshToken = tokenGenerator.GenerateRefreshToken();
        existing.ReplacedByTokenHash = TokenHash.Create(rawRefreshToken);

        dbContext.RefreshTokens.Add(new RefreshToken
        {
            AppUserId = user.Id,
            TokenHash = TokenHash.Create(rawRefreshToken),
            AccessTokenJti = access.Jti,
            AccessTokenExpiresAtUtc = access.ExpiresAtUtc,
            ExpiresAtUtc = now.AddDays(jwtOptions.Value.RefreshTokenDays),
            CreatedAtUtc = now
        });

        var expiresIn = Math.Max(0, (int)(access.ExpiresAtUtc - now).TotalSeconds);
        return new AuthTokenView(access.Token, rawRefreshToken, expiresIn, "Bearer", ToView(user));
    }

    public async Task<ForgotPasswordResponse> ForgotPasswordAsync(ForgotPasswordCommand command, CancellationToken cancellationToken)
    {
        var normalizedEmail = NormalizeEmail(command.Email);
        var user = await dbContext.AppUsers.SingleOrDefaultAsync(x => x.NormalizedEmail == normalizedEmail, cancellationToken);
        var expires = DateTime.UtcNow.AddMinutes(15);

        if (user is null)
        {
            return new ForgotPasswordResponse(
                "Nếu email tồn tại trong hệ thống, mã xác nhận OTP đã được gửi.",
                null,
                expires);
        }

        var otp = new Random().Next(100000, 999999).ToString();
        ResetOtps[normalizedEmail] = (otp, expires);

        return new ForgotPasswordResponse(
            "Mã xác nhận OTP đặt lại mật khẩu đã được tạo (hiệu lực 15 phút).",
            otp,
            expires);
    }

    public async Task ResetPasswordAsync(ResetPasswordCommand command, CancellationToken cancellationToken)
    {
        var normalizedEmail = NormalizeEmail(command.Email);
        if (string.IsNullOrWhiteSpace(command.Otp))
        {
            throw new RequestValidationException(nameof(command.Otp), "Mã OTP xác thực không được để trống.");
        }

        if (!ResetOtps.TryGetValue(normalizedEmail, out var entry) || entry.ExpiresAtUtc < DateTime.UtcNow || entry.Otp != command.Otp.Trim())
        {
            throw new RequestValidationException(nameof(command.Otp), "Mã xác thực OTP không chính xác hoặc đã hết hạn.");
        }

        ValidatePassword(command.NewPassword);

        var user = await dbContext.AppUsers
            .Include(x => x.RefreshTokens)
            .SingleOrDefaultAsync(x => x.NormalizedEmail == normalizedEmail, cancellationToken)
            ?? throw new ResourceNotFoundException("Tài khoản không tồn tại.");

        user.PasswordHash = passwordHasher.HashPassword(user, command.NewPassword);
        user.FailedLoginAttempts = 0;
        user.LockedUntilUtc = null;
        if (user.Status == AccountStatus.Locked) user.Status = AccountStatus.Active;

        var now = timeProvider.GetUtcNow().UtcDateTime;
        foreach (var rt in user.RefreshTokens.Where(t => !t.IsRevoked))
        {
            rt.IsRevoked = true;
            rt.RevokedAtUtc = now;
        }

        ResetOtps.TryRemove(normalizedEmail, out _);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private static string ReadJti(string token)
    {
        return new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler().ReadJwtToken(token).Id;
    }

    private static UserView ToView(AppUser user) => new(
        user.Id,
        user.Email,
        user.FullName,
        user.Role,
        user.Status,
        user.TenantId,
        user.FarmId,
        user.CreatedAtUtc);

    internal static string NormalizeEmail(string email)
    {
        if (string.IsNullOrWhiteSpace(email) || !new System.ComponentModel.DataAnnotations.EmailAddressAttribute().IsValid(email))
        {
            throw new RequestValidationException(nameof(email), "A valid email address is required.");
        }

        return email.Trim().ToUpperInvariant();
    }

    internal static void ValidatePassword(string password)
    {
        var valid = password.Length is >= 8 and <= 100 &&
                    password.Any(char.IsUpper) &&
                    password.Any(char.IsLower) &&
                    password.Any(char.IsDigit) &&
                    password.Any(ch => !char.IsLetterOrDigit(ch));
        if (!valid)
        {
            throw new RequestValidationException(nameof(password),
                "Mật khẩu phải từ 8-100 ký tự và bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt.");
        }
    }

    internal static string RequireText(string value, string field, int maxLength)
    {
        var result = value?.Trim();
        if (string.IsNullOrWhiteSpace(result) || result.Length > maxLength)
        {
            throw new RequestValidationException(field, $"{field} is required and must not exceed {maxLength} characters.");
        }

        return result;
    }

    internal static string? NormalizeOptional(string? value, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var result = value.Trim();
        if (result.Length > maxLength)
        {
            throw new RequestValidationException(nameof(value), $"Value must not exceed {maxLength} characters.");
        }

        return result;
    }
}
