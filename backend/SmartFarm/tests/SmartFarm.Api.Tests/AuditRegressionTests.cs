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

public sealed class AuditRegressionTests
{
    [Fact]
    public async Task Linked_technician_can_open_detail_but_cannot_confirm_empty_plan()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        Guid id;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            var tech = await db.AppUsers.SingleAsync(u => u.Email == "technician@example.com");
            var owner = await db.AppUsers.SingleAsync(u => u.Email == "owner-a@example.com");
            var dep = new DeploymentRequest { TenantId = owner.TenantId!.Value, FarmId = seed.FarmAId,
                ZoneId = seed.ZoneAId, OwnerUserId = owner.Id, Status = DeploymentRequestStatus.Surveyed };
            dep.Surveys.Add(new DeploymentSurvey { TechnicianUserId = tech.Id, IsFeasible = true,
                Notes = "Survey completed", SiteConditions = "Power ready" });
            db.DeploymentRequests.Add(dep);
            db.ServiceRequests.Add(new ServiceRequest { ZoneId = seed.ZoneAId, FarmId = seed.FarmAId,
                TenantId = owner.TenantId.Value, DeploymentRequestId = dep.Id, AssignedTechnicianId = tech.Id });
            await db.SaveChangesAsync(); id = dep.Id;
        }
        using var client = factory.CreateClient(); await Login(client, "technician@example.com");
        (await client.GetAsync($"/api/v1/platform/deployment-requests/{id}")).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsync($"/api/v1/platform/deployment-requests/{id}/confirm", null)).StatusCode);
        using var verify = factory.Services.CreateScope();
        Assert.Equal(DeploymentRequestStatus.Surveyed,
            (await verify.ServiceProvider.GetRequiredService<SmartFarmDbContext>().DeploymentRequests.SingleAsync(r => r.Id == id)).Status);
    }

    private static async Task Login(HttpClient client, string email)
    {
        var r = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = "ValidPassword1!" });
        r.EnsureSuccessStatusCode();
        using var json = JsonDocument.Parse(await r.Content.ReadAsStringAsync());
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", json.RootElement.GetProperty("accessToken").GetString());
    }

    [Fact]
    public async Task Owner_cannot_create_or_renew_contract_directly()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        using var client = factory.CreateClient(); await Login(client, "owner-a@example.com");
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}/contracts", new {})).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync($"/api/v1/zone-contracts/{Guid.NewGuid()}/renew", new {})).StatusCode);
    }

    [Fact]
    public async Task Technician_without_tenant_reads_only_assigned_zone_contracts()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            var tech = await db.AppUsers.SingleAsync(u => u.Email == "technician@example.com");
            foreach (var zoneId in new[] { seed.ZoneAId, seed.ZoneBId })
            {
                var z = await db.Zones.Include(z => z.Field).ThenInclude(f => f.Farm).SingleAsync(z => z.Id == zoneId);
                db.ZoneContracts.Add(new ZoneContract { ZoneId = z.Id, FarmId = z.Field.FarmId, TenantId = z.Field.Farm.TenantId,
                    ContractNumber = z.Id.ToString(), LesseeName = "Owner", StartDate = new DateOnly(2026,1,1), EndDate = new DateOnly(2027,1,1) });
                if (zoneId == seed.ZoneAId)
                    db.ServiceRequests.Add(new ServiceRequest { ZoneId = z.Id, FarmId = z.Field.FarmId,
                        TenantId = z.Field.Farm.TenantId, AssignedTechnicianId = tech.Id });
            }
            await db.SaveChangesAsync();
        }
        using var client = factory.CreateClient(); await Login(client, "technician@example.com");
        var response = await client.GetAsync("/api/v1/zone-contracts"); response.EnsureSuccessStatusCode();
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(seed.ZoneAId, Assert.Single(json.RootElement.EnumerateArray()).GetProperty("zoneId").GetGuid());
        var foreign = await client.GetAsync($"/api/v1/zones/{seed.ZoneBId}/contracts"); foreign.EnsureSuccessStatusCode();
        Assert.Equal("[]", await foreign.Content.ReadAsStringAsync());
    }

    [Theory]
    [InlineData(0, 100, 8)]
    [InlineData(1, -1, 8)]
    [InlineData(1, 100, 101)]
    public async Task Quotation_rejects_invalid_financial_input(int quantity, decimal price, decimal vat)
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        Guid id;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            var tech = await db.AppUsers.SingleAsync(u => u.Email == "technician@example.com");
            var z = await db.Zones.Include(z => z.Field).ThenInclude(f => f.Farm).SingleAsync(z => z.Id == seed.ZoneAId);
            var r = new ServiceRequest { ZoneId = z.Id, FarmId = z.Field.FarmId, TenantId = z.Field.Farm.TenantId, AssignedTechnicianId = tech.Id };
            db.ServiceRequests.Add(r); await db.SaveChangesAsync(); id = r.Id;
        }
        using var client = factory.CreateClient(); await Login(client, "technician@example.com");
        var response = await client.PostAsJsonAsync($"/api/v1/service-requests/{id}/quotation", new {
            items = new[] { new { code = "X", name = "Device", category = "HARDWARE", unit = "Bộ", quantity, unitPrice = price, vatPercent = vat } }
        });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var verifyScope = factory.Services.CreateScope();
        Assert.False(await verifyScope.ServiceProvider.GetRequiredService<SmartFarmDbContext>().ServiceRequestQuotations.AnyAsync(q => q.ServiceRequestId == id));
    }
}
