using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SmartFarm.Application.Features.Inventory;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;
using Xunit;

namespace SmartFarm.Api.Tests;

public sealed class InventoryTaskTests
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };

    [Fact]
    public async Task Duplicate_material_is_rejected_case_insensitively()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync(); using var client = factory.CreateClient(); await Login(client, "owner-a@example.com");
        var one = await client.PostAsJsonAsync($"/api/v1/farms/{seed.FarmAId}/inventory", Item("NPK 20-20-15", 10));
        var duplicate = await client.PostAsJsonAsync($"/api/v1/farms/{seed.FarmAId}/inventory", Item("  npk 20-20-15  ", 0));
        Assert.Equal(HttpStatusCode.Created, one.StatusCode); Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);
    }

    [Fact]
    public async Task Issue_over_stock_is_rejected_without_changing_balance_and_valid_issue_opens_low_alert()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync(); using var client = factory.CreateClient(); await Login(client, "owner-a@example.com");
        var created = await client.PostAsJsonAsync($"/api/v1/farms/{seed.FarmAId}/inventory", Item("Compost", 5, 2));
        var item = await Read<InventoryItemView>(created);
        var over = await client.PostAsJsonAsync($"/api/v1/farms/{seed.FarmAId}/inventory/issues", new { inventoryItemId = item.Id, quantity = 6, zoneId = seed.ZoneAId });
        Assert.Equal(HttpStatusCode.Conflict, over.StatusCode);
        var valid = await client.PostAsJsonAsync($"/api/v1/farms/{seed.FarmAId}/inventory/issues", new { inventoryItemId = item.Id, quantity = 3, zoneId = seed.ZoneAId });
        valid.EnsureSuccessStatusCode(); Assert.Equal(2, (await Read<InventoryMovementView>(valid)).BalanceAfter);
        var alerts = await Read<List<LowStockAlertView>>(await client.GetAsync($"/api/v1/farms/{seed.FarmAId}/inventory/low-stock-alerts"));
        Assert.Single(alerts); Assert.Equal(LowStockAlertStatus.Open, alerts[0].Status);
    }

    [Fact]
    public async Task Owner_cannot_assign_farmer_from_another_farm_and_unassigned_farmer_cannot_edit_task()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync(); var farmers = await AttachFarmers(factory, seed); using var client = factory.CreateClient(); await Login(client, "owner-a@example.com");
        var wrongFarm = await client.PostAsJsonAsync($"/api/v1/farms/{seed.FarmAId}/tasks", NewTask(seed.ZoneAId, seed.TenantBFarmerId));
        Assert.Equal(HttpStatusCode.Conflict, wrongFarm.StatusCode);
        var created = await client.PostAsJsonAsync($"/api/v1/farms/{seed.FarmAId}/tasks", NewTask(seed.ZoneAId, farmers.OtherFarmerId));
        var task = await Read<FarmTaskView>(created);
        await Login(client, "farmer@example.com");
        var edit = await client.PutAsJsonAsync($"/api/v1/farms/{seed.FarmAId}/tasks/{task.Id}", new { action = "Accept" });
        Assert.Equal(HttpStatusCode.Forbidden, edit.StatusCode);
    }

    [Fact]
    public async Task Completion_requires_owner_approval_and_failure_can_be_reassigned()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync(); var farmers = await AttachFarmers(factory, seed); using var client = factory.CreateClient();
        await Login(client, "owner-a@example.com");
        var completedTask = await Read<FarmTaskView>(await client.PostAsJsonAsync($"/api/v1/farms/{seed.FarmAId}/tasks", NewTask(seed.ZoneAId, seed.UnassignedFarmerId)));
        await Login(client, "farmer@example.com");
        await Act(client, seed.FarmAId, completedTask.Id, "Accept"); await Act(client, seed.FarmAId, completedTask.Id, "Start");
        var submitted = await Act(client, seed.FarmAId, completedTask.Id, "Complete", result: "Beds inspected and fertilized"); Assert.Equal(FarmTaskStatus.CompletedPendingReview, submitted.Status);
        await Login(client, "owner-a@example.com"); var approved = await Act(client, seed.FarmAId, completedTask.Id, "Approve"); Assert.Equal(FarmTaskStatus.Approved, approved.Status);

        var failedTask = await Read<FarmTaskView>(await client.PostAsJsonAsync($"/api/v1/farms/{seed.FarmAId}/tasks", NewTask(seed.ZoneAId, seed.UnassignedFarmerId)));
        await Login(client, "farmer@example.com"); await Act(client, seed.FarmAId, failedTask.Id, "Accept"); var failed = await Act(client, seed.FarmAId, failedTask.Id, "Fail", failure: "Irrigation line is blocked"); Assert.Equal(FarmTaskStatus.Failed, failed.Status);
        await Login(client, "owner-a@example.com"); var reassigned = await Act(client, seed.FarmAId, failedTask.Id, "Reassign", assignedFarmerId: farmers.OtherFarmerId); Assert.Equal(FarmTaskStatus.Pending, reassigned.Status); Assert.Equal(2, reassigned.AssignmentVersion); Assert.Contains(reassigned.History, x => x.EventType == FarmTaskEventType.Reassigned);
    }

    [Fact]
    public async Task Inventory_and_tasks_hide_cross_tenant_farm()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync(); using var client = factory.CreateClient(); await Login(client, "owner-b@example.com");
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/v1/farms/{seed.FarmAId}/inventory")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/v1/farms/{seed.FarmAId}/tasks")).StatusCode);
    }

    private static object Item(string name, decimal initial, decimal threshold = 1) => new { name, materialType = "Fertilizer", unit = "kg", lowStockThreshold = threshold, initialQuantity = initial };
    private static object NewTask(Guid zoneId, Guid farmerId) => new { zoneId, title = "Inspect crop", description = "Inspect all beds", requirements = "Attach notes", dueAtUtc = DateTime.UtcNow.AddDays(1), assignedFarmerId = farmerId };
    private static async Task<FarmTaskView> Act(HttpClient c, Guid farm, Guid task, string action, string? result = null, string? failure = null, Guid? assignedFarmerId = null) { var r = await c.PutAsJsonAsync($"/api/v1/farms/{farm}/tasks/{task}", new { action, result, failureReason = failure, assignedFarmerId }); r.EnsureSuccessStatusCode(); return await Read<FarmTaskView>(r); }
    private static async Task<(Guid OtherFarmerId, Guid TenantId)> AttachFarmers(TestApplicationFactory factory, SeedData seed)
    {
        using var scope = factory.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>(); var farm = await db.Farms.SingleAsync(x => x.Id == seed.FarmAId); var farmer = await db.AppUsers.SingleAsync(x => x.Id == seed.UnassignedFarmerId);
        farmer.TenantId = farm.TenantId; farmer.FarmId = farm.Id; db.UserZoneAccesses.Add(new UserZoneAccess { AppUserId = farmer.Id, ZoneId = seed.ZoneAId });
        var other = new AppUser { Email = "other-a@example.com", NormalizedEmail = "OTHER-A@EXAMPLE.COM", FullName = "Other Farmer A", Role = UserRole.Farmer, Status = AccountStatus.Active, TenantId = farm.TenantId, FarmId = farm.Id }; other.PasswordHash = new PasswordHasher<AppUser>().HashPassword(other, "ValidPassword1!"); db.AppUsers.Add(other); db.UserZoneAccesses.Add(new UserZoneAccess { AppUser = other, ZoneId = seed.ZoneAId }); await db.SaveChangesAsync(); return (other.Id, farm.TenantId);
    }
    private static async Task Login(HttpClient client, string email) { var response = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = "ValidPassword1!" }); response.EnsureSuccessStatusCode(); var p = await response.Content.ReadFromJsonAsync<LoginPayload>(); client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", p!.AccessToken); }
    private static async Task<T> Read<T>(HttpResponseMessage r) { r.EnsureSuccessStatusCode(); return (await r.Content.ReadFromJsonAsync<T>(Json))!; }
    private sealed record LoginPayload(string AccessToken);
}
