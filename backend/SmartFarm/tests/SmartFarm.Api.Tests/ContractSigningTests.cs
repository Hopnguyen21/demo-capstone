using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SmartFarm.Application.Features.Finance;
using SmartFarm.Application.Features.IoTDeployment;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;
using Xunit;

namespace SmartFarm.Api.Tests;

/// Ký hợp đồng lắp đặt, liên kết service request ↔ deployment request và danh sách yêu cầu của Owner.
public sealed class ContractSigningTests
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };
    private sealed record LoginPayload(string AccessToken);
    private sealed record Fixture(SeedData Seed, Guid DeploymentId, Guid ServiceRequestId);

    private static async Task Login(HttpClient c, string email)
    {
        var r = await c.PostAsJsonAsync("/api/v1/auth/login", new { email, password = "ValidPassword1!" });
        r.EnsureSuccessStatusCode();
        var p = await r.Content.ReadFromJsonAsync<LoginPayload>();
        c.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", p!.AccessToken);
    }

    private static async Task<T> Read<T>(HttpResponseMessage r)
    {
        r.EnsureSuccessStatusCode();
        return (await r.Content.ReadFromJsonAsync<T>(Json))!;
    }

    /// Một deployment request của Tenant A, một service request liên kết với nó đã được giao cho KTV và có báo giá.
    private static async Task<Fixture> SetupAsync(TestApplicationFactory f, HttpClient c, DeploymentRequestStatus deploymentStatus)
    {
        var s = await f.SeedAsync();
        Guid depId;
        using (var scope = f.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            var farm = await db.Farms.SingleAsync(x => x.Id == s.FarmAId);
            var dep = new DeploymentRequest { TenantId = farm.TenantId, FarmId = s.FarmAId, ZoneId = s.ZoneAId, PlantingSeasonId = Guid.NewGuid(), OwnerUserId = s.OwnerAId, Status = deploymentStatus, RequiredParametersCsv = "SoilMoisture" };
            db.DeploymentRequests.Add(dep);
            await db.SaveChangesAsync();
            depId = dep.Id;
        }
        await Login(c, "owner-a@example.com");
        var created = await Read<ServiceRequestView>(await c.PostAsJsonAsync($"/api/v1/farms/{s.FarmAId}/service-requests",
            new { zoneId = s.ZoneAId, failureCode = "NEW_INSTALL", description = "Lắp đặt thiết bị IoT", deploymentRequestId = depId }));
        Assert.Equal(depId, created.DeploymentRequestId);
        await Login(c, "admin@example.com");
        (await c.PostAsJsonAsync($"/api/v1/service-requests/{created.Id}/assign", new { technicianUserId = s.TechnicianId })).EnsureSuccessStatusCode();
        await Login(c, "technician@example.com");
        (await c.PostAsJsonAsync($"/api/v1/service-requests/{created.Id}/quotation", new
        {
            items = new[] { new { code = "GW-01", name = "Gateway", category = "GATEWAY", unit = "Cái", quantity = 1, unitPrice = 1000000m, vatPercent = 8m } },
            contractTerms = "Bảo hành 24 tháng"
        })).EnsureSuccessStatusCode();
        return new(s, depId, created.Id);
    }

    private static Task<HttpResponseMessage> Deposit(HttpClient c, Guid id) =>
        c.PostAsJsonAsync($"/api/v1/service-requests/{id}/sign-contract-deposit", new { signerFullName = "Chủ A", paymentMethod = "BANK_TRANSFER", transactionReference = "TX-1" });

    private static Task<HttpResponseMessage> Final(HttpClient c, Guid id) =>
        c.PostAsJsonAsync($"/api/v1/service-requests/{id}/sign-acceptance-final", new { signerFullName = "Chủ A", paymentMethod = "BANK_TRANSFER", transactionReference = "TX-2" });

    [Fact]
    public async Task Other_tenant_owner_cannot_sign_or_read_the_quotation()
    {
        using var f = new TestApplicationFactory(); using var c = f.CreateClient();
        var x = await SetupAsync(f, c, DeploymentRequestStatus.Installing);
        await Login(c, "owner-b@example.com");
        Assert.Equal(HttpStatusCode.NotFound, (await Deposit(c, x.ServiceRequestId)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await c.GetAsync($"/api/v1/service-requests/{x.ServiceRequestId}/quotation")).StatusCode);
    }

    [Fact]
    public async Task Signed_contract_keeps_the_quotation_vat_so_the_price_breakdown_adds_up()
    {
        using var f = new TestApplicationFactory(); using var c = f.CreateClient();
        var x = await SetupAsync(f, c, DeploymentRequestStatus.Installing);
        await Login(c, "owner-a@example.com");
        (await Deposit(c, x.ServiceRequestId)).EnsureSuccessStatusCode();

        using var scope = f.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        var contract = await db.ZoneContracts.SingleAsync(z => z.ContractNumber.StartsWith("HD-SR-"));
        Assert.Equal(8m, contract.VatPercent);
        Assert.Equal(80000m, contract.VatAmountVnd);
        Assert.Equal(1080000m, contract.TotalContractValueVnd);

        var list = await c.GetFromJsonAsync<JsonElement>("/api/v1/zone-contracts", Json);
        var item = list.EnumerateArray().Single(e => e.GetProperty("contractNumber").GetString() == contract.ContractNumber);
        Assert.Equal(1000000m, item.GetProperty("subtotalVnd").GetDecimal());
        Assert.Equal(80000m, item.GetProperty("vatAmountVnd").GetDecimal());
        Assert.Equal(8m, item.GetProperty("vatPercent").GetDecimal());
        var equipment = Assert.Single(item.GetProperty("equipment").EnumerateArray());
        Assert.Equal("Gateway", equipment.GetProperty("name").GetString());
        Assert.Equal(1, equipment.GetProperty("quantity").GetInt32());
    }

    [Fact]
    public async Task Deposit_cannot_be_signed_twice()
    {
        using var f = new TestApplicationFactory(); using var c = f.CreateClient();
        var x = await SetupAsync(f, c, DeploymentRequestStatus.Installing);
        await Login(c, "owner-a@example.com");
        (await Deposit(c, x.ServiceRequestId)).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.Conflict, (await Deposit(c, x.ServiceRequestId)).StatusCode);
        using var scope = f.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        Assert.Equal(1, await db.ServiceRequestPayments.CountAsync(p => p.ServiceRequestId == x.ServiceRequestId));
    }

    [Fact]
    public async Task Signing_requires_signer_and_transaction_reference()
    {
        using var f = new TestApplicationFactory(); using var c = f.CreateClient();
        var x = await SetupAsync(f, c, DeploymentRequestStatus.Installing);
        await Login(c, "owner-a@example.com");
        var r = await c.PostAsJsonAsync($"/api/v1/service-requests/{x.ServiceRequestId}/sign-contract-deposit", new { signerFullName = "", paymentMethod = "CASH", transactionReference = "" });
        Assert.True((int)r.StatusCode is 400 or 422);
    }

    [Fact]
    public async Task Final_acceptance_requires_signed_deposit_and_completed_deployment_and_is_single_use()
    {
        using var f = new TestApplicationFactory(); using var c = f.CreateClient();
        var x = await SetupAsync(f, c, DeploymentRequestStatus.Installing);
        await Login(c, "owner-a@example.com");
        Assert.Equal(HttpStatusCode.Conflict, (await Final(c, x.ServiceRequestId)).StatusCode); // chưa ký cọc
        (await Deposit(c, x.ServiceRequestId)).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.Conflict, (await Final(c, x.ServiceRequestId)).StatusCode); // triển khai chưa hoàn tất
        using (var scope = f.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            (await db.DeploymentRequests.SingleAsync(d => d.Id == x.DeploymentId)).Status = DeploymentRequestStatus.Completed;
            await db.SaveChangesAsync();
        }
        (await Final(c, x.ServiceRequestId)).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.Conflict, (await Final(c, x.ServiceRequestId)).StatusCode);
    }

    [Fact]
    public async Task Service_request_cannot_link_another_tenants_deployment_request()
    {
        using var f = new TestApplicationFactory(); using var c = f.CreateClient();
        var x = await SetupAsync(f, c, DeploymentRequestStatus.Installing);
        await Login(c, "owner-b@example.com");
        var r = await c.PostAsJsonAsync($"/api/v1/farms/{x.Seed.FarmBId}/service-requests",
            new { zoneId = x.Seed.ZoneBId, failureCode = "NEW_INSTALL", description = "x", deploymentRequestId = x.DeploymentId });
        Assert.Equal(HttpStatusCode.NotFound, r.StatusCode);
    }

    [Fact]
    public async Task Owner_lists_only_own_tenant_deployment_requests_and_can_filter_by_zone()
    {
        using var f = new TestApplicationFactory(); using var c = f.CreateClient();
        var x = await SetupAsync(f, c, DeploymentRequestStatus.Submitted);
        await Login(c, "owner-a@example.com");
        var mine = await Read<List<DeploymentRequestView>>(await c.GetAsync("/api/v1/deployment-requests"));
        Assert.Contains(mine, d => d.RequestId == x.DeploymentId);
        Assert.Empty(await Read<List<DeploymentRequestView>>(await c.GetAsync($"/api/v1/deployment-requests?zoneId={x.Seed.ZoneBId}")));
        await Login(c, "owner-b@example.com");
        Assert.DoesNotContain(await Read<List<DeploymentRequestView>>(await c.GetAsync("/api/v1/deployment-requests")), d => d.RequestId == x.DeploymentId);
    }
}
