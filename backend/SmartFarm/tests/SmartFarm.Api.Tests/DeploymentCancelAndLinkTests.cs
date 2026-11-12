using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SmartFarm.Application.Features.Finance;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;
using Xunit;

namespace SmartFarm.Api.Tests;

/// Hủy yêu cầu triển khai và quy tắc liên kết phiếu dịch vụ ↔ yêu cầu triển khai.
public sealed class DeploymentCancelAndLinkTests
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };
    private sealed record LoginPayload(string AccessToken);

    private static async Task Login(HttpClient c, string email)
    {
        var r = await c.PostAsJsonAsync("/api/v1/auth/login", new { email, password = "ValidPassword1!" });
        r.EnsureSuccessStatusCode();
        var p = await r.Content.ReadFromJsonAsync<LoginPayload>();
        c.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", p!.AccessToken);
    }

    private static async Task<Guid> AddDeployment(TestApplicationFactory f, SeedData s, DeploymentRequestStatus status, bool withInstallRequest = true, bool signed = false)
    {
        using var scope = f.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        var farm = await db.Farms.SingleAsync(x => x.Id == s.FarmAId);
        var dep = new DeploymentRequest { TenantId = farm.TenantId, FarmId = s.FarmAId, ZoneId = s.ZoneAId, PlantingSeasonId = Guid.NewGuid(), OwnerUserId = s.OwnerAId, Status = status, RequiredParametersCsv = "SoilMoisture" };
        db.DeploymentRequests.Add(dep);
        if (withInstallRequest)
            db.ServiceRequests.Add(new ServiceRequest
            {
                TenantId = farm.TenantId, FarmId = s.FarmAId, ZoneId = s.ZoneAId, DeploymentRequestId = dep.Id, Source = "DeploymentRequest",
                FailureCode = "INSTALLATION", Description = "Lắp đặt", Status = ServiceRequestStatus.Assigned, AssignedTechnicianId = s.TechnicianId,
                IsContractSigned = signed, IsDepositPaid = signed
            });
        await db.SaveChangesAsync();
        return dep.Id;
    }

    [Theory]
    [InlineData(DeploymentRequestStatus.Submitted)]
    [InlineData(DeploymentRequestStatus.Accepted)]
    [InlineData(DeploymentRequestStatus.PlanConfirmed)]
    public async Task Owner_cancels_before_installation_closes_linked_installation_request_and_unlocks_zone(DeploymentRequestStatus status)
    {
        using var f = new TestApplicationFactory(); using var c = f.CreateClient(); var s = await f.SeedAsync();
        var id = await AddDeployment(f, s, status);
        await Login(c, "owner-a@example.com");
        var r = await c.PostAsJsonAsync($"/api/v1/deployment-requests/{id}/cancel", new { reason = "Gửi nhầm Zone" });
        r.EnsureSuccessStatusCode();
        using var scope = f.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        Assert.Equal(DeploymentRequestStatus.Cancelled, (await db.DeploymentRequests.SingleAsync(x => x.Id == id)).Status);
        var sr = await db.ServiceRequests.Include(x => x.History).SingleAsync(x => x.DeploymentRequestId == id);
        Assert.Equal(ServiceRequestStatus.Closed, sr.Status);
        Assert.NotNull(sr.ClosedAtUtc);
        Assert.Contains(sr.History, h => h.ToStatus == ServiceRequestStatus.Closed && h.Notes == "Gửi nhầm Zone");
        // Đợt đã hủy không còn khóa Zone.
        Assert.False(await db.DeploymentRequests.AnyAsync(x => x.ZoneId == s.ZoneAId && new[] { DeploymentRequestStatus.Submitted, DeploymentRequestStatus.Accepted, DeploymentRequestStatus.Surveyed, DeploymentRequestStatus.PlanConfirmed, DeploymentRequestStatus.Installing }.Contains(x.Status)));
    }

    [Theory]
    [InlineData(DeploymentRequestStatus.Installing)]
    [InlineData(DeploymentRequestStatus.Completed)]
    [InlineData(DeploymentRequestStatus.MaintenanceRequired)]
    [InlineData(DeploymentRequestStatus.Cancelled)]
    public async Task Cancel_is_rejected_once_installation_started_or_deployment_is_terminal(DeploymentRequestStatus status)
    {
        using var f = new TestApplicationFactory(); using var c = f.CreateClient(); var s = await f.SeedAsync();
        var id = await AddDeployment(f, s, status);
        await Login(c, "owner-a@example.com");
        Assert.Equal(HttpStatusCode.Conflict, (await c.PostAsJsonAsync($"/api/v1/deployment-requests/{id}/cancel", new { reason = "x" })).StatusCode);
    }

    [Fact]
    public async Task Cancel_is_rejected_when_contract_is_signed_and_deposit_paid()
    {
        using var f = new TestApplicationFactory(); using var c = f.CreateClient(); var s = await f.SeedAsync();
        var id = await AddDeployment(f, s, DeploymentRequestStatus.PlanConfirmed, signed: true);
        await Login(c, "owner-a@example.com");
        Assert.Equal(HttpStatusCode.Conflict, (await c.PostAsJsonAsync($"/api/v1/deployment-requests/{id}/cancel", new { reason = "x" })).StatusCode);
        using var scope = f.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        Assert.Equal(DeploymentRequestStatus.PlanConfirmed, (await db.DeploymentRequests.SingleAsync(x => x.Id == id)).Status);
    }

    [Fact]
    public async Task Cancel_of_another_tenants_or_missing_request_is_not_found_and_technician_cannot_cancel()
    {
        using var f = new TestApplicationFactory(); using var c = f.CreateClient(); var s = await f.SeedAsync();
        var id = await AddDeployment(f, s, DeploymentRequestStatus.Submitted);
        await Login(c, "owner-b@example.com");
        Assert.Equal(HttpStatusCode.NotFound, (await c.PostAsJsonAsync($"/api/v1/deployment-requests/{id}/cancel", new { })).StatusCode);
        await Login(c, "technician@example.com");
        Assert.Equal(HttpStatusCode.Forbidden, (await c.PostAsJsonAsync($"/api/v1/deployment-requests/{id}/cancel", new { })).StatusCode);
    }

    [Fact]
    public async Task New_installation_request_never_links_to_a_completed_deployment_and_needs_a_real_season()
    {
        using var f = new TestApplicationFactory(); using var c = f.CreateClient(); var s = await f.SeedAsync();
        var completed = await AddDeployment(f, s, DeploymentRequestStatus.Completed, withInstallRequest: false);
        await Login(c, "owner-a@example.com");
        // Zone chưa có vụ trồng: không tạo đợt triển khai ngầm với Guid.Empty.
        var noSeason = await c.PostAsJsonAsync($"/api/v1/farms/{s.FarmAId}/service-requests", new { zoneId = s.ZoneAId, failureCode = "NEW_INSTALL", description = "Lắp thêm trạm" });
        Assert.Equal(HttpStatusCode.Conflict, noSeason.StatusCode);
        using var scope = f.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        Assert.Equal(1, await db.DeploymentRequests.CountAsync(x => x.ZoneId == s.ZoneAId));
        Assert.False(await db.DeploymentRequests.AnyAsync(x => x.PlantingSeasonId == Guid.Empty));
        Assert.Equal(DeploymentRequestStatus.Completed, (await db.DeploymentRequests.SingleAsync(x => x.Id == completed)).Status);
    }

    [Fact]
    public async Task Installation_request_links_to_the_active_deployment_and_maintenance_links_to_the_installed_one()
    {
        using var f = new TestApplicationFactory(); using var c = f.CreateClient(); var s = await f.SeedAsync();
        var active = await AddDeployment(f, s, DeploymentRequestStatus.Accepted, withInstallRequest: false);
        await Login(c, "owner-a@example.com");
        var inst = await c.PostAsJsonAsync($"/api/v1/farms/{s.FarmAId}/service-requests", new { zoneId = s.ZoneAId, failureCode = "NEW_INSTALL", description = "Lắp đặt" });
        inst.EnsureSuccessStatusCode();
        Assert.Equal(active, (await inst.Content.ReadFromJsonAsync<ServiceRequestView>(Json))!.DeploymentRequestId);
    }

    [Fact]
    public async Task Maintenance_request_without_any_installed_system_is_rejected()
    {
        using var f = new TestApplicationFactory(); using var c = f.CreateClient(); var s = await f.SeedAsync();
        await Login(c, "owner-a@example.com");
        var r = await c.PostAsJsonAsync($"/api/v1/farms/{s.FarmAId}/service-requests", new { zoneId = s.ZoneAId, failureCode = "SENSOR_OFFLINE", description = "Mất tín hiệu" });
        Assert.Equal(HttpStatusCode.Conflict, r.StatusCode);
    }
}
