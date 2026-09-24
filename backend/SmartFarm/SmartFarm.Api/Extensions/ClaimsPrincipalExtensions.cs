using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using SmartFarm.Infrastructure.Identity;
using SmartFarm.Application.Common.Exceptions;

namespace SmartFarm.Api.Extensions;

public static class ClaimsPrincipalExtensions
{
    public static Guid GetUserId(this ClaimsPrincipal principal)
    {
        var value = principal.FindFirstValue(JwtRegisteredClaimNames.Sub);
        return Guid.TryParse(value, out var id)
            ? id
            : throw new InvalidOperationException("Authenticated token has no valid subject.");
    }

    public static string GetTokenJti(this ClaimsPrincipal principal)
    {
        return principal.FindFirstValue(JwtRegisteredClaimNames.Jti)
            ?? throw new InvalidOperationException("Authenticated token has no jti.");
    }

    public static Guid GetTenantId(this ClaimsPrincipal principal)
    {
        var value = principal.FindFirstValue(AuthClaimNames.TenantId);
        return Guid.TryParse(value, out var id)
            ? id
            : throw new AuthorizationException("Authenticated token has no valid Tenant scope. Sign in again after Tenant setup.");
    }

    public static Guid? GetOptionalTenantId(this ClaimsPrincipal principal)
    {
        var value = principal.FindFirstValue(AuthClaimNames.TenantId);
        return Guid.TryParse(value, out var id) ? id : null;
    }
}
