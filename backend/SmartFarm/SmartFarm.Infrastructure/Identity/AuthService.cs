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
        var result = CreateSession(user, now);
        await dbContext.SaveChangesAsync(cancellationToken);
        return result;
    }

    public async Task<AuthTokenView> RefreshAsync(string refreshToken, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(refreshToken))
        {
            throw new RequestValidationException(nameof(refreshToken), "Refresh token is required.");
        }

        var hash = TokenHash.Create(refreshToken);
        var session = await dbContext.RefreshTokens
            .Include(x => x.AppUser)
            .SingleOrDefaultAsync(x => x.TokenHash == hash, cancellationToken);
        var now = timeProvider.GetUtcNow().UtcDateTime;
        if (session is null || session.RevokedAtUtc.HasValue || session.ExpiresAtUtc <= now || session.AppUser.Status != AccountStatus.Active)
        {
            throw new AuthenticationException("The refresh token is invalid or expired.");
        }

        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);
        session.RevokedAtUtc = now;
        var result = CreateSession(session.AppUser, now);
        session.ReplacedByTokenId = dbContext.RefreshTokens.Local.Single(x => x.AccessTokenJti == ReadJti(result.AccessToken)).Id;
        await dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return result;
    }

    public async Task<LogoutView> LogoutAsync(
        Guid userId,
        string accessTokenJti,
        LogoutCommand command,
        CancellationToken cancellationToken)
    {
        var now = timeProvider.GetUtcNow().UtcDateTime;
        var sessions = dbContext.RefreshTokens.Where(x => x.AppUserId == userId && x.RevokedAtUtc == null);

        if (command.RevokeAllDevices)
        {
            // Revoke all active sessions below.
        }
        else if (!string.IsNullOrWhiteSpace(command.RefreshToken))
        {
            var hash = TokenHash.Create(command.RefreshToken);
            sessions = sessions.Where(x => x.TokenHash == hash);
        }
        else
        {
            sessions = sessions.Where(x => x.AccessTokenJti == accessTokenJti);
        }

        var matches = await sessions.ToListAsync(cancellationToken);
        foreach (var session in matches)
        {
            session.RevokedAtUtc = now;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return new LogoutView(now, matches.Count);
    }

    private AuthTokenView CreateSession(AppUser user, DateTime now)
    {
        var access = tokenGenerator.CreateAccessToken(user);
        var rawRefreshToken = tokenGenerator.CreateRefreshToken();
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
                "Password must be 8-100 characters and include upper-case, lower-case, number and special characters.");
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
