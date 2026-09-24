using SmartFarm.Domain.Entities;

namespace SmartFarm.Application.Common.Interfaces;

public interface IJwtTokenGenerator
{
    AccessTokenMaterial CreateAccessToken(AppUser user);
    string CreateRefreshToken();
}

public sealed record AccessTokenMaterial(string Token, string Jti, DateTime ExpiresAtUtc);
