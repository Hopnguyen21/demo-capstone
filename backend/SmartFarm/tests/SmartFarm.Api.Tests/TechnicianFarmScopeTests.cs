using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;
using Xunit;

namespace SmartFarm.Api.Tests;

/// <summary>
/// Kỹ thuật viên nền tảng không thuộc tenant nào: chỉ đọc được cấu trúc trang trại (trang trại, lô, Zone) của trang trại có
/// yêu cầu đang xử lý được giao cho chính họ. Không có yêu cầu nào được giao thì không thấy gì; admin vẫn thấy toàn hệ thống.
/// </summary>
public sealed class TechnicianFarmScopeTests
{
    [Fact]
    public async Task Technician_without_assigned_requests_sees_no_farm_structure()
    {
        using var factory = new TestApplicationFactory();
        var seed = await factory.SeedAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, "technician@example.com");

        Assert.Empty(await ReadListAsync(client, "/api/v1/farms"));
        Assert.Empty(await ReadListAsync(client, "/api/v1/fields"));
        Assert.Empty(await ReadListAsync(client, "/api/v1/zones"));
        await AssertNotFoundAsync(client, $"/api/v1/farms/{seed.FarmAId}");
        await AssertNotFoundAsync(client, $"/api/v1/farms/{seed.FarmAId}/structure");
        await AssertNotFoundAsync(client, $"/api/v1/farms/{seed.FarmAId}/fields");
        await AssertNotFoundAsync(client, $"/api/v1/fields/{seed.FieldAId}");
        await AssertNotFoundAsync(client, $"/api/v1/fields/{seed.FieldAId}/zones");
        await AssertNotFoundAsync(client, $"/api/v1/zones/{seed.ZoneAId}");
    }

    [Fact]
    public async Task Technician_with_accepted_deployment_sees_only_that_farm()
    {
        using var factory = new TestApplicationFactory();
        var seed = await factory.SeedAsync();
        await AddDeploymentAsync(factory, seed, seed.FarmAId, DeploymentRequestStatus.Accepted, assigned: true);
        using var client = factory.CreateClient();
        await LoginAsync(client, "technician@example.com");

        var farms = await ReadListAsync(client, "/api/v1/farms");
        Assert.Equal([seed.FarmAId], farms.Select(f => f.GetProperty("farmId").GetGuid()).ToArray());
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/v1/farms/{seed.FarmAId}")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/v1/farms/{seed.FarmAId}/structure")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/v1/farms/{seed.FarmAId}/fields")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/v1/fields/{seed.FieldAId}")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/v1/fields/{seed.FieldAId}/zones")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/v1/zones/{seed.ZoneAId}")).StatusCode);
        Assert.Equal([seed.FieldAId], (await ReadListAsync(client, "/api/v1/fields")).Select(f => f.GetProperty("fieldId").GetGuid()).ToArray());
        Assert.Equal([seed.ZoneAId], (await ReadListAsync(client, "/api/v1/zones")).Select(z => z.GetProperty("zoneId").GetGuid()).ToArray());

        // Trang trại của chủ trại khác: không tồn tại với kỹ thuật viên này (không lộ sự tồn tại).
        await AssertNotFoundAsync(client, $"/api/v1/farms/{seed.FarmBId}");
        await AssertNotFoundAsync(client, $"/api/v1/farms/{seed.FarmBId}/structure");
        await AssertNotFoundAsync(client, $"/api/v1/farms/{seed.FarmBId}/fields");
        await AssertNotFoundAsync(client, $"/api/v1/fields/{seed.FieldBId}");
        await AssertNotFoundAsync(client, $"/api/v1/fields/{seed.FieldBId}/zones");
        await AssertNotFoundAsync(client, $"/api/v1/zones/{seed.ZoneBId}");
    }

    [Theory]
    [InlineData(DeploymentRequestStatus.Submitted, false)] // chưa ai tiếp nhận
    [InlineData(DeploymentRequestStatus.Accepted, true)]
    [InlineData(DeploymentRequestStatus.Surveyed, true)]
    [InlineData(DeploymentRequestStatus.PlanConfirmed, true)]
    [InlineData(DeploymentRequestStatus.Installing, true)]
    [InlineData(DeploymentRequestStatus.MaintenanceRequired, true)]
    [InlineData(DeploymentRequestStatus.Completed, false)] // xong việc thì hết quyền đọc
    public async Task Deployment_status_decides_whether_the_farm_is_readable(DeploymentRequestStatus status, bool expected)
    {
        using var factory = new TestApplicationFactory();
        var seed = await factory.SeedAsync();
        await AddDeploymentAsync(factory, seed, seed.FarmAId, status, assigned: status != DeploymentRequestStatus.Submitted);
        using var client = factory.CreateClient();
        await LoginAsync(client, "technician@example.com");

        var response = await client.GetAsync($"/api/v1/farms/{seed.FarmAId}");
        Assert.Equal(expected ? HttpStatusCode.OK : HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Deployment_assigned_to_another_technician_gives_no_access()
    {
        using var factory = new TestApplicationFactory();
        var seed = await factory.SeedAsync();
        await AddDeploymentAsync(factory, seed, seed.FarmAId, DeploymentRequestStatus.Installing, assigned: false, technicianUserId: Guid.NewGuid());
        using var client = factory.CreateClient();
        await LoginAsync(client, "technician@example.com");

        await AssertNotFoundAsync(client, $"/api/v1/farms/{seed.FarmAId}");
        Assert.Empty(await ReadListAsync(client, "/api/v1/farms"));
    }

    [Theory]
    [InlineData(ServiceRequestStatus.Assigned, true)]
    [InlineData(ServiceRequestStatus.InProgress, true)]
    [InlineData(ServiceRequestStatus.WorkCompleted, true)]
    [InlineData(ServiceRequestStatus.Resolved, false)]
    [InlineData(ServiceRequestStatus.Closed, false)]
    public async Task Assigned_service_request_grants_access_until_it_is_closed(ServiceRequestStatus status, bool expected)
    {
        using var factory = new TestApplicationFactory();
        var seed = await factory.SeedAsync();
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            var farm = await db.Farms.SingleAsync(f => f.Id == seed.FarmBId);
            db.ServiceRequests.Add(new ServiceRequest
            {
                TenantId = farm.TenantId, FarmId = farm.Id, ZoneId = seed.ZoneBId, DeploymentRequestId = Guid.NewGuid(),
                Source = "Test", FailureCode = "X", Description = "Thiết bị lỗi", Status = status, AssignedTechnicianId = seed.TechnicianId
            });
            await db.SaveChangesAsync();
        }
        using var client = factory.CreateClient();
        await LoginAsync(client, "technician@example.com");

        Assert.Equal(expected ? HttpStatusCode.OK : HttpStatusCode.NotFound, (await client.GetAsync($"/api/v1/farms/{seed.FarmBId}")).StatusCode);
        // Chỉ trang trại của yêu cầu được giao; trang trại còn lại vẫn ngoài phạm vi.
        await AssertNotFoundAsync(client, $"/api/v1/farms/{seed.FarmAId}");
    }

    [Fact]
    public async Task Inventory_follows_the_same_scope_and_never_discloses_other_tenants()
    {
        using var factory = new TestApplicationFactory();
        var seed = await factory.SeedAsync();
        using var client = factory.CreateClient();

        // Chủ trại tenant B đọc tồn kho trang trại tenant A: 404 (không phải 403, để không lộ trang trại có tồn tại).
        await LoginAsync(client, "owner-b@example.com");
        await AssertNotFoundAsync(client, $"/api/v1/farms/{seed.FarmAId}/inventory");

        await LoginAsync(client, "technician@example.com");
        await AssertNotFoundAsync(client, $"/api/v1/farms/{seed.FarmAId}/inventory");

        await AddDeploymentAsync(factory, seed, seed.FarmAId, DeploymentRequestStatus.Installing, assigned: true);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/v1/farms/{seed.FarmAId}/inventory")).StatusCode);
        await AssertNotFoundAsync(client, $"/api/v1/farms/{seed.FarmBId}/inventory");

        await LoginAsync(client, "admin@example.com");
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/v1/farms/{seed.FarmBId}/inventory")).StatusCode);
    }

    [Fact]
    public async Task Admin_still_reads_every_farm_and_owner_stays_tenant_scoped()
    {
        using var factory = new TestApplicationFactory();
        var seed = await factory.SeedAsync();
        using var client = factory.CreateClient();

        await LoginAsync(client, "admin@example.com");
        var all = (await ReadListAsync(client, "/api/v1/farms")).Select(f => f.GetProperty("farmId").GetGuid()).ToHashSet();
        Assert.Contains(seed.FarmAId, all);
        Assert.Contains(seed.FarmBId, all);

        await LoginAsync(client, "owner-a@example.com");
        var own = (await ReadListAsync(client, "/api/v1/farms")).Select(f => f.GetProperty("farmId").GetGuid()).ToArray();
        Assert.Equal([seed.FarmAId], own);
        await AssertNotFoundAsync(client, $"/api/v1/farms/{seed.FarmBId}");
    }

    private static async Task AddDeploymentAsync(
        TestApplicationFactory factory, SeedData seed, Guid farmId, DeploymentRequestStatus status, bool assigned, Guid? technicianUserId = null)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        var farm = await db.Farms.SingleAsync(f => f.Id == farmId);
        var zoneId = farmId == seed.FarmAId ? seed.ZoneAId : seed.ZoneBId;
        db.DeploymentRequests.Add(new DeploymentRequest
        {
            TenantId = farm.TenantId, FarmId = farmId, ZoneId = zoneId, PlantingSeasonId = Guid.NewGuid(),
            OwnerUserId = farmId == seed.FarmAId ? seed.OwnerAId : seed.OwnerBId,
            TechnicianUserId = technicianUserId ?? (assigned ? seed.TechnicianId : null),
            Status = status, RequiredParametersCsv = "SoilMoisture"
        });
        await db.SaveChangesAsync();
    }

    private static async Task AssertNotFoundAsync(HttpClient client, string url) =>
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync(url)).StatusCode);

    private static async Task<List<JsonElement>> ReadListAsync(HttpClient client, string url)
    {
        var response = await client.GetAsync(url);
        response.EnsureSuccessStatusCode();
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return json.RootElement.EnumerateArray().Select(e => e.Clone()).ToList();
    }

    private static async Task LoginAsync(HttpClient client, string email)
    {
        client.DefaultRequestHeaders.Authorization = null;
        var response = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = "ValidPassword1!" });
        response.EnsureSuccessStatusCode();
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", json.RootElement.GetProperty("accessToken").GetString());
    }
}
