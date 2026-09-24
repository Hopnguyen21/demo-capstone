using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Identity;
using SmartFarm.Infrastructure.Persistence;

namespace SmartFarm.Api.Extensions;

public static class AuthenticationExtensions
{
    public static IServiceCollection AddSmartFarmAuthentication(this IServiceCollection services, IConfiguration configuration)
    {
        var jwt = configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>() ?? new JwtOptions();
        if (jwt.SigningKey.Length < 32)
        {
            throw new InvalidOperationException("Jwt:SigningKey must be supplied by environment and contain at least 32 characters.");
        }

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.MapInboundClaims = false;
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidIssuer = jwt.Issuer,
                    ValidateAudience = true,
                    ValidAudience = jwt.Audience,
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.SigningKey)),
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.Zero,
                    NameClaimType = JwtRegisteredClaimNames.Sub,
                    RoleClaimType = ClaimTypes.Role
                };
                options.Events = CreateJwtEvents();
            });

        services.AddAuthorization(options =>
        {
            options.FallbackPolicy = new AuthorizationPolicyBuilder()
                .RequireAuthenticatedUser()
                .Build();
        });
        return services;
    }

    private static JwtBearerEvents CreateJwtEvents() => new()
    {
        OnTokenValidated = async context =>
        {
            var subject = context.Principal?.FindFirstValue(JwtRegisteredClaimNames.Sub);
            var jti = context.Principal?.FindFirstValue(JwtRegisteredClaimNames.Jti);
            if (!Guid.TryParse(subject, out var userId) || string.IsNullOrWhiteSpace(jti))
            {
                context.Fail("Required token claims are missing.");
                return;
            }

            var dbContext = context.HttpContext.RequestServices.GetRequiredService<SmartFarmDbContext>();
            var now = DateTime.UtcNow;
            var validSession = await dbContext.RefreshTokens.AnyAsync(
                x => x.AppUserId == userId &&
                     x.AccessTokenJti == jti &&
                     x.RevokedAtUtc == null &&
                     x.AccessTokenExpiresAtUtc > now &&
                     x.AppUser.Status == AccountStatus.Active,
                context.HttpContext.RequestAborted);
            if (!validSession)
            {
                context.Fail("The token session is no longer active.");
            }
        },
        OnChallenge = async context =>
        {
            context.HandleResponse();
            if (!context.Response.HasStarted)
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await context.Response.WriteAsJsonAsync(new ProblemDetails
                {
                    Status = StatusCodes.Status401Unauthorized,
                    Title = "Authentication required",
                    Detail = "A valid, active bearer token is required.",
                    Instance = context.HttpContext.Request.Path,
                    Extensions = { ["traceId"] = context.HttpContext.TraceIdentifier }
                });
            }
        },
        OnForbidden = async context =>
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            await context.Response.WriteAsJsonAsync(new ProblemDetails
            {
                Status = StatusCodes.Status403Forbidden,
                Title = "Access forbidden",
                Detail = "The authenticated role is not allowed to access this resource.",
                Instance = context.HttpContext.Request.Path,
                Extensions = { ["traceId"] = context.HttpContext.TraceIdentifier }
            });
        }
    };
}
