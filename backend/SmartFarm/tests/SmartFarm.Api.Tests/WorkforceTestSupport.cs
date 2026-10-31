using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;

namespace SmartFarm.Api.Tests;

/// <summary>Dùng chung cho test mời nhân công và giao việc nhiều Farmer.</summary>
internal static class WorkforceTestSupport
{
    internal static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };
    internal const string Password = "ValidPassword1!";

    internal static async Task Login(HttpClient client, string email)
    {
        client.DefaultRequestHeaders.Authorization = null;
        var response = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = Password });
        response.EnsureSuccessStatusCode();
        var payload = await response.Content.ReadFromJsonAsync<LoginPayload>();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", payload!.AccessToken);
    }

    internal static async Task<T> Read<T>(HttpResponseMessage response)
    {
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<T>(Json))!;
    }

    /// <summary>Tạo Farmer đã thuộc Farm A (kèm quyền truy cập Zone A nếu withZoneAccess); không cấp CanControl.</summary>
    internal static async Task<Guid> AddMemberFarmerAsync(TestApplicationFactory factory, SeedData seed, string email, string name, bool withZoneAccess = true)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        var farm = await db.Farms.SingleAsync(x => x.Id == seed.FarmAId);
        var user = new AppUser { Email = email, NormalizedEmail = email.ToUpperInvariant(), FullName = name, Role = UserRole.Farmer, Status = AccountStatus.Active, TenantId = farm.TenantId, FarmId = farm.Id };
        user.PasswordHash = new PasswordHasher<AppUser>().HashPassword(user, Password);
        db.AppUsers.Add(user);
        if (withZoneAccess) db.UserZoneAccesses.Add(new UserZoneAccess { AppUserId = user.Id, ZoneId = seed.ZoneAId, CanControl = false });
        await db.SaveChangesAsync();
        return user.Id;
    }

    private sealed record LoginPayload(string AccessToken);
}
