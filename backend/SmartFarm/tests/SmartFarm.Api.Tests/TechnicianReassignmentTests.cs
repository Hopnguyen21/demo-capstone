using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;
using Xunit;

namespace SmartFarm.Api.Tests;

/// <summary>Phân công yêu cầu cho KTV: chỉ KTV được Admin phân công mới thấy/làm được; đổi KTV thì KTV cũ mất quyền.</summary>
public class TechnicianReassignmentTests
{
    private static async Task LoginAsync(HttpClient client, string email)
    {
        client.DefaultRequestHeaders.Authorization = null;
        var r = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = "ValidPassword1!" });
        r.EnsureSuccessStatusCode();
        using var j = JsonDocument.Parse(await r.Content.ReadAsStringAsync());
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", j.RootElement.GetProperty("accessToken").GetString());
    }

    /// <summary>Yêu cầu triển khai đang Installing do KTV A (technician@example.com) phụ trách + phiếu dịch vụ gán cho A.</summary>
    private static async Task<(Guid depId, Guid srId, Guid techBId)> SetupAsync(TestApplicationFactory factory, SeedData seed)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        var farm = await db.Farms.SingleAsync(f => f.Id == seed.FarmAId);
        var techB = new AppUser { Email = "tech-b@example.com", NormalizedEmail = "TECH-B@EXAMPLE.COM", FullName = "Technician B", Role = UserRole.PlatformTechnician, Status = AccountStatus.Active };
        techB.PasswordHash = new PasswordHasher<AppUser>().HashPassword(techB, "ValidPassword1!");
        db.AppUsers.Add(techB);
        var dep = new DeploymentRequest
        {
            TenantId = farm.TenantId, FarmId = farm.Id, ZoneId = seed.ZoneAId, PlantingSeasonId = Guid.NewGuid(), OwnerUserId = seed.OwnerAId,
            TechnicianUserId = seed.TechnicianId, Status = DeploymentRequestStatus.Installing, RequiredParametersCsv = "SoilMoisture"
        };
        db.DeploymentRequests.Add(dep);
        var sr = new ServiceRequest
        {
            TenantId = farm.TenantId, FarmId = farm.Id, ZoneId = seed.ZoneAId, DeploymentRequestId = dep.Id,
            Source = "Test", FailureCode = "X", Description = "Lắp đặt", Status = ServiceRequestStatus.Assigned, AssignedTechnicianId = seed.TechnicianId
        };
        db.ServiceRequests.Add(sr);
        await db.SaveChangesAsync();
        return (dep.Id, sr.Id, techB.Id);
    }

    [Fact]
    public async Task Reassigning_the_request_moves_the_deployment_to_the_new_technician_and_the_old_one_loses_access()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        var (depId, srId, techBId) = await SetupAsync(factory, seed);
        using var client = factory.CreateClient();

        await LoginAsync(client, "technician@example.com");
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/v1/platform/deployment-requests/{depId}")).StatusCode);

        await LoginAsync(client, "admin@example.com");
        var assign = await client.PostAsJsonAsync($"/api/v1/service-requests/{srId}/assign", new { technicianUserId = techBId, notes = "đổi KTV" });
        Assert.Equal(HttpStatusCode.OK, assign.StatusCode);

        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            Assert.Equal(techBId, (await db.DeploymentRequests.SingleAsync(x => x.Id == depId)).TechnicianUserId);
            Assert.True(await db.DeploymentDecisionHistory.AnyAsync(x => x.DeploymentRequestId == depId && x.DecisionType == "Reassigned"));
        }

        await LoginAsync(client, "technician@example.com"); // KTV cũ (A)
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/v1/platform/deployment-requests/{depId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.PostAsync($"/api/v1/platform/deployment-requests/{depId}/installation/start", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/v1/farms/{seed.FarmAId}")).StatusCode);
        var list = JsonDocument.Parse(await client.GetStringAsync("/api/v1/platform/deployment-requests")).RootElement;
        Assert.Equal(0, list.GetArrayLength());

        await LoginAsync(client, "tech-b@example.com"); // KTV mới (B)
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/v1/platform/deployment-requests/{depId}")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/v1/farms/{seed.FarmAId}")).StatusCode);
    }

    [Fact]
    public async Task A_finished_deployment_keeps_its_original_technician_when_the_request_is_reassigned()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        var (depId, srId, techBId) = await SetupAsync(factory, seed);
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            (await db.DeploymentRequests.SingleAsync(x => x.Id == depId)).Status = DeploymentRequestStatus.Completed;
            await db.SaveChangesAsync();
        }
        using var client = factory.CreateClient();
        await LoginAsync(client, "admin@example.com");
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync($"/api/v1/service-requests/{srId}/assign", new { technicianUserId = techBId })).StatusCode);
        await using var s2 = factory.Services.CreateAsyncScope();
        Assert.Equal(seed.TechnicianId, (await s2.ServiceProvider.GetRequiredService<SmartFarmDbContext>().DeploymentRequests.SingleAsync(x => x.Id == depId)).TechnicianUserId);
    }

    [Fact]
    public async Task Only_an_admin_can_assign_and_the_technician_must_be_an_active_platform_technician()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        var (_, srId, techBId) = await SetupAsync(factory, seed);
        using var client = factory.CreateClient();
        await LoginAsync(client, "technician@example.com");
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync($"/api/v1/service-requests/{srId}/assign", new { technicianUserId = techBId })).StatusCode);
        await LoginAsync(client, "owner-a@example.com");
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync($"/api/v1/service-requests/{srId}/assign", new { technicianUserId = techBId })).StatusCode);
        await LoginAsync(client, "admin@example.com");
        // gán cho người không phải KTV nền tảng (chủ trại) bị từ chối
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync($"/api/v1/service-requests/{srId}/assign", new { technicianUserId = seed.OwnerAId })).StatusCode);
    }

    [Fact]
    public async Task A_technician_cannot_accept_a_deployment_request_the_admin_has_not_assigned_to_them()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        Guid depId;
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            var farm = await db.Farms.SingleAsync(f => f.Id == seed.FarmAId);
            var dep = new DeploymentRequest { TenantId = farm.TenantId, FarmId = farm.Id, ZoneId = seed.ZoneAId, PlantingSeasonId = Guid.NewGuid(), OwnerUserId = seed.OwnerAId, Status = DeploymentRequestStatus.Submitted, RequiredParametersCsv = "SoilMoisture" };
            db.DeploymentRequests.Add(dep);
            // phiếu dịch vụ của yêu cầu CHƯA gán cho ai
            db.ServiceRequests.Add(new ServiceRequest { TenantId = farm.TenantId, FarmId = farm.Id, ZoneId = seed.ZoneAId, DeploymentRequestId = dep.Id, Source = "Test", FailureCode = "X", Description = "Lắp đặt", Status = ServiceRequestStatus.Open });
            await db.SaveChangesAsync();
            depId = dep.Id;
        }
        using var client = factory.CreateClient();
        await LoginAsync(client, "technician@example.com");
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/v1/platform/deployment-requests/{depId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.PostAsync($"/api/v1/platform/deployment-requests/{depId}/accept", null)).StatusCode);
        Assert.Equal(0, JsonDocument.Parse(await client.GetStringAsync("/api/v1/platform/deployment-requests")).RootElement.GetArrayLength());

        // Admin phân công thì KTV tiếp nhận được
        await LoginAsync(client, "admin@example.com");
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            var srId = (await db.ServiceRequests.SingleAsync(x => x.DeploymentRequestId == depId)).Id;
            Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync($"/api/v1/service-requests/{srId}/assign", new { technicianUserId = seed.TechnicianId })).StatusCode);
        }
        await LoginAsync(client, "technician@example.com");
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsync($"/api/v1/platform/deployment-requests/{depId}/accept", null)).StatusCode);
    }
}
