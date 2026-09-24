using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using Xunit;

namespace SmartFarm.Api.Tests;

public sealed class AuthAuthorizationTests
{
    [Fact]
    public async Task Login_with_wrong_password_returns_unauthorized_problem_details()
    {
        using var factory = new TestApplicationFactory();
        await factory.SeedAsync();
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/v1/auth/login", new
        {
            email = "owner-a@example.com",
            password = "WrongPassword1!"
        });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Expired_access_token_is_rejected()
    {
        using var factory = new TestApplicationFactory();
        var seed = await factory.SeedAsync();
        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", CreateExpiredToken(seed.OwnerAId));

        var response = await client.GetAsync("/api/v1/users/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Farmer_cannot_access_owner_only_user_list()
    {
        using var factory = new TestApplicationFactory();
        await factory.SeedAsync();
        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", await LoginAsync(client, "farmer@example.com"));

        var response = await client.GetAsync("/api/v1/users");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Owner_cannot_read_user_from_another_tenant()
    {
        using var factory = new TestApplicationFactory();
        var seed = await factory.SeedAsync();
        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", await LoginAsync(client, "owner-a@example.com"));

        var response = await client.GetAsync($"/api/v1/users/{seed.TenantBFarmerId}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Refresh_token_is_rotated_and_cannot_be_replayed()
    {
        using var factory = new TestApplicationFactory();
        await factory.SeedAsync();
        using var client = factory.CreateClient();
        var login = await LoginPayloadAsync(client, "owner-a@example.com");

        var firstRefresh = await client.PostAsJsonAsync("/api/v1/auth/refresh", new { refreshToken = login.RefreshToken });
        var replay = await client.PostAsJsonAsync("/api/v1/auth/refresh", new { refreshToken = login.RefreshToken });

        Assert.Equal(HttpStatusCode.OK, firstRefresh.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, replay.StatusCode);
    }

    [Fact]
    public async Task Logout_revokes_the_current_access_token_session()
    {
        using var factory = new TestApplicationFactory();
        await factory.SeedAsync();
        using var client = factory.CreateClient();
        var accessToken = await LoginAsync(client, "owner-a@example.com");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        var logout = await client.PostAsJsonAsync("/api/v1/auth/logout", new { revokeAllDevices = false });
        var afterLogout = await client.GetAsync("/api/v1/users/me");

        Assert.Equal(HttpStatusCode.OK, logout.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, afterLogout.StatusCode);
    }

    [Fact]
    public async Task Owner_cannot_assign_farmer_to_zone_from_another_farm()
    {
        using var factory = new TestApplicationFactory();
        var seed = await factory.SeedAsync();
        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", await LoginAsync(client, "owner-a@example.com"));
        var invite = await client.PostAsJsonAsync("/api/v1/users/invite", new
        {
            email = "farmer@example.com",
            farmId = seed.FarmAId
        });
        invite.EnsureSuccessStatusCode();

        var response = await client.PutAsJsonAsync($"/api/v1/users/{seed.UnassignedFarmerId}/zone-access", new
        {
            access = new[] { new { zoneId = seed.ZoneBId, canControl = true } }
        });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private static async Task<string> LoginAsync(HttpClient client, string email)
    {
        return (await LoginPayloadAsync(client, email)).AccessToken;
    }

    private static async Task<LoginPayload> LoginPayloadAsync(HttpClient client, string email)
    {
        var response = await client.PostAsJsonAsync("/api/v1/auth/login", new
        {
            email,
            password = "ValidPassword1!"
        });
        response.EnsureSuccessStatusCode();
        var payload = await response.Content.ReadFromJsonAsync<LoginPayload>();
        return payload ?? throw new InvalidOperationException("Login response was empty.");
    }

    private static string CreateExpiredToken(Guid userId)
    {
        var now = DateTime.UtcNow;
        var token = new JwtSecurityToken(
            issuer: "SmartFarm.Api.Tests",
            audience: "SmartFarm.TestClients",
            claims:
            [
                new Claim(JwtRegisteredClaimNames.Sub, userId.ToString()),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N")),
                new Claim(ClaimTypes.Role, "FarmOwner")
            ],
            notBefore: now.AddMinutes(-10),
            expires: now.AddMinutes(-1),
            signingCredentials: new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(TestApplicationFactory.SigningKey)),
                SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private sealed record LoginPayload(string AccessToken, string RefreshToken);
}
