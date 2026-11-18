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
using SmartFarm.Application.Features.Platform;
using SmartFarm.Infrastructure.Platform;
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
        var x = await SetupAsync(f, c, DeploymentRequestStatus.PlanConfirmed);
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
        // Nghiệm thu xong thì phiếu lắp đặt được đóng và có lịch sử (không kẹt ở Assigned).
        var closed = await Read<ServiceRequestView>(await c.GetAsync($"/api/v1/service-requests/{x.ServiceRequestId}"));
        Assert.Equal(ServiceRequestStatus.Closed, closed.Status);
        Assert.NotNull(closed.ClosedAtUtc);
        Assert.Contains(closed.History, h => h.ToStatus == ServiceRequestStatus.Closed);
    }

    [Fact]
    public async Task Deposit_percent_changes_apply_only_until_the_owner_has_viewed_the_quotation()
    {
        using var f = new TestApplicationFactory(); using var c = f.CreateClient();
        var x = await SetupAsync(f, c, DeploymentRequestStatus.Installing); // đang đăng nhập kỹ thuật viên
        async Task SetDeposit(string value)
        {
            using var scope = f.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            await new PlatformAdminService(db).UpdateSettingsAsync([new(PlatformSettingKeys.DepositPercent, value)], Guid.NewGuid(), default);
        }
        async Task<QuotationView> GetQuotation() =>
            await Read<QuotationView>(await c.GetAsync($"/api/v1/service-requests/{x.ServiceRequestId}/quotation"));

        // Owner CHƯA xem: tỷ lệ Admin đổi thì báo giá (kỹ thuật viên xem) theo tỷ lệ mới và chưa bị chốt.
        var q0 = await GetQuotation();
        Assert.Equal(q0.TotalAmount * 0.3m, q0.Deposit30Percent);
        await SetDeposit("40");
        Assert.Equal(q0.TotalAmount * 0.4m, (await GetQuotation()).Deposit30Percent);

        // Owner xem lần đầu: chốt số đang hiển thị (40%).
        await Login(c, "owner-a@example.com");
        var seen = await GetQuotation();
        Assert.Equal(q0.TotalAmount * 0.4m, seen.Deposit30Percent);
        Assert.Equal(q0.TotalAmount * 0.6m, seen.Remaining70Percent);

        // Owner ĐÃ xem: Admin đổi tiếp sang 45% / 50% cũng không làm đổi số Owner đã thấy.
        await SetDeposit("45");
        Assert.Equal(q0.TotalAmount * 0.4m, (await GetQuotation()).Deposit30Percent);
        await Login(c, "technician@example.com");
        Assert.Equal(q0.TotalAmount * 0.4m, (await GetQuotation()).Deposit30Percent);
        await Login(c, "owner-a@example.com");

        // Ký đúng số đã xem: khoản cọc là 40%, không phải 45%.
        var pay = await Read<ServiceRequestPaymentView>(await c.PostAsJsonAsync($"/api/v1/service-requests/{x.ServiceRequestId}/sign-contract-deposit",
            new { signerFullName = "Chủ A", paymentMethod = "BANK_TRANSFER", transactionReference = "TX-1", expectedDepositAmount = seen.Deposit30Percent }));
        Assert.Equal(q0.TotalAmount * 0.4m, pay.Amount);

        // Đã ký: tiếp tục giữ nguyên.
        await SetDeposit("50");
        var after = await GetQuotation();
        Assert.Equal(q0.TotalAmount * 0.4m, after.Deposit30Percent);
        Assert.Equal(q0.TotalAmount * 0.6m, after.Remaining70Percent);
    }

    [Fact]
    public async Task Signing_without_viewing_uses_the_current_percentage_and_stale_expected_amount_is_refused()
    {
        using var f = new TestApplicationFactory(); using var c = f.CreateClient();
        var x = await SetupAsync(f, c, DeploymentRequestStatus.Installing);
        var q0 = await Read<QuotationView>(await c.GetAsync($"/api/v1/service-requests/{x.ServiceRequestId}/quotation")); // kỹ thuật viên xem, không phải Owner
        using (var scope = f.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            await new PlatformAdminService(db).UpdateSettingsAsync([new(PlatformSettingKeys.DepositPercent, "40")], Guid.NewGuid(), default);
        }
        await Login(c, "owner-a@example.com");
        // Owner ký thẳng (chưa xem) với số cũ: số thật theo tỷ lệ hiện hành là 40% nên bị từ chối.
        var stale = await c.PostAsJsonAsync($"/api/v1/service-requests/{x.ServiceRequestId}/sign-contract-deposit",
            new { signerFullName = "Chủ A", paymentMethod = "BANK_TRANSFER", transactionReference = "TX-OLD", expectedDepositAmount = q0.Deposit30Percent });
        Assert.Equal(HttpStatusCode.Conflict, stale.StatusCode);
        var ok = await Read<ServiceRequestPaymentView>(await c.PostAsJsonAsync($"/api/v1/service-requests/{x.ServiceRequestId}/sign-contract-deposit",
            new { signerFullName = "Chủ A", paymentMethod = "BANK_TRANSFER", transactionReference = "TX-NEW", expectedDepositAmount = q0.TotalAmount * 0.4m }));
        Assert.Equal(q0.TotalAmount * 0.4m, ok.Amount);
    }

    [Fact]
    public async Task Final_acceptance_waits_for_completed_installation_and_flags_are_exposed_on_the_service_request()
    {
        using var f = new TestApplicationFactory(); using var c = f.CreateClient();
        var x = await SetupAsync(f, c, DeploymentRequestStatus.Installing);
        await Login(c, "owner-a@example.com");
        var before = await Read<ServiceRequestView>(await c.GetAsync($"/api/v1/service-requests/{x.ServiceRequestId}"));
        Assert.False(before.IsContractSigned); Assert.False(before.IsDepositPaid); Assert.False(before.IsAcceptanceSigned); Assert.False(before.IsFullyPaid);
        (await Deposit(c, x.ServiceRequestId)).EnsureSuccessStatusCode();
        var signed = await Read<ServiceRequestView>(await c.GetAsync($"/api/v1/service-requests/{x.ServiceRequestId}"));
        Assert.True(signed.IsContractSigned); Assert.True(signed.IsDepositPaid); Assert.False(signed.IsAcceptanceSigned); Assert.False(signed.IsFullyPaid);
        // Chỉ nghiệm thu sau khi kỹ thuật viên hoàn tất lắp đặt: đang Installing thì bị từ chối (409), không đóng phiếu sớm.
        Assert.Equal(HttpStatusCode.Conflict, (await Final(c, x.ServiceRequestId)).StatusCode);
        using (var scope = f.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            (await db.DeploymentRequests.SingleAsync(d => d.Id == x.DeploymentId)).Status = DeploymentRequestStatus.Completed;
            await db.SaveChangesAsync();
        }
        (await Final(c, x.ServiceRequestId)).EnsureSuccessStatusCode();
        var done = await Read<ServiceRequestView>(await c.GetAsync($"/api/v1/service-requests/{x.ServiceRequestId}"));
        Assert.True(done.IsAcceptanceSigned); Assert.True(done.IsFullyPaid);
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

    [Fact]
    public async Task Contract_made_from_a_signed_quotation_has_no_invented_rent_phone_or_address()
    {
        using var f = new TestApplicationFactory(); using var c = f.CreateClient();
        var x = await SetupAsync(f, c, DeploymentRequestStatus.Installing);
        await Login(c, "owner-a@example.com");
        (await Deposit(c, x.ServiceRequestId)).EnsureSuccessStatusCode();

        using var scope = f.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        var contract = await db.ZoneContracts.SingleAsync(z => z.ContractNumber.StartsWith("HD-SR-"));
        // Phí dịch vụ/tháng chưa thiết lập (không suy từ tổng báo giá / 12), SĐT/địa chỉ không phải số cố định.
        Assert.Equal(0m, contract.MonthlyRentVnd);
        Assert.NotEqual("0903666888", contract.LesseePhone);
        Assert.NotEqual("Trang trại thông minh SmartFarm", contract.LesseeAddress);
    }

    [Fact]
    public async Task Renewing_a_contract_without_a_service_fee_is_rejected_until_a_fee_is_given()
    {
        using var f = new TestApplicationFactory(); using var c = f.CreateClient();
        var x = await SetupAsync(f, c, DeploymentRequestStatus.Installing);
        await Login(c, "owner-a@example.com");
        (await Deposit(c, x.ServiceRequestId)).EnsureSuccessStatusCode();
        Guid contractId;
        using (var scope = f.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            contractId = (await db.ZoneContracts.SingleAsync(z => z.ContractNumber.StartsWith("HD-SR-"))).Id;
        }
        await Login(c, "admin@example.com");
        var noFee = await c.PostAsJsonAsync($"/api/v1/zone-contracts/{contractId}/renew", new { durationPreset = "1_YEAR" });
        Assert.True((int)noFee.StatusCode is 400 or 422);
        var withFee = await c.PostAsJsonAsync($"/api/v1/zone-contracts/{contractId}/renew", new { durationPreset = "1_YEAR", newMonthlyRentVnd = 500000m });
        withFee.EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task Depreciation_list_never_invents_records_for_devices_without_one()
    {
        using var f = new TestApplicationFactory(); using var c = f.CreateClient();
        var x = await SetupAsync(f, c, DeploymentRequestStatus.Installing);
        using (var scope = f.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            var gateway = new Gateway { FarmId = x.Seed.FarmAId, DeploymentRequestId = x.DeploymentId, MacAddress = "AA:BB:CC:DD:EE:77", GatewaySerial = $"DP-{Guid.NewGuid():N}", FrequencyBand = "433MHz", FirmwareVersion = "v1", MqttClientId = $"dp-{Guid.NewGuid():N}", ClientCertificateFingerprint = new string('D', 64), Status = GatewayStatus.Online, LastSeenAtUtc = DateTime.UtcNow };
            db.Gateways.Add(gateway);
            await db.SaveChangesAsync();
            db.Devices.Add(new Device { FarmId = x.Seed.FarmAId, GatewayId = gateway.Id, DeploymentRequestId = x.DeploymentId, ZoneId = x.Seed.ZoneAId, HardwareAddress = $"DP-{Guid.NewGuid():N}", DeviceType = DeviceType.SensorNode, Status = DeviceStatus.Online });
            await db.SaveChangesAsync();
        }
        await Login(c, "owner-a@example.com");
        var list = await c.GetFromJsonAsync<JsonElement>($"/api/v1/zones/{x.Seed.ZoneAId}/depreciations", Json);
        Assert.Equal(0, list.GetArrayLength());
        using var check = f.Services.CreateScope();
        Assert.Equal(0, await check.ServiceProvider.GetRequiredService<SmartFarmDbContext>().DeviceDepreciations.CountAsync());
    }


    [Fact]
    public async Task Technician_only_reaches_depreciation_of_assigned_zones_and_start_date_cannot_be_in_the_future()
    {
        using var f = new TestApplicationFactory(); using var c = f.CreateClient();
        var x = await SetupAsync(f, c, DeploymentRequestStatus.Installing);
        await Login(c, "technician@example.com");
        // Zone của trang trại khác (không được giao): đọc theo Zone và tạo hồ sơ đều bị từ chối.
        Assert.Equal(HttpStatusCode.Forbidden, (await c.GetAsync($"/api/v1/zones/{x.Seed.ZoneBId}/depreciations")).StatusCode);
        var body = new { deviceId = Guid.NewGuid(), originalCostVnd = 1_000_000, depreciationLifetimeMonths = 12, startDate = DateTime.UtcNow.AddMonths(-1).ToString("yyyy-MM-dd") };
        Assert.Equal(HttpStatusCode.Forbidden, (await c.PostAsJsonAsync($"/api/v1/zones/{x.Seed.ZoneBId}/depreciations", body)).StatusCode);
        // Zone được giao thì đọc được.
        Assert.Equal(HttpStatusCode.OK, (await c.GetAsync($"/api/v1/zones/{x.Seed.ZoneAId}/depreciations")).StatusCode);
        // Ngày bắt đầu ở tương lai: 400 (Owner của Zone A).
        await Login(c, "owner-a@example.com");
        var future = new { deviceId = Guid.NewGuid(), originalCostVnd = 1_000_000, depreciationLifetimeMonths = 12, startDate = DateTime.UtcNow.AddMonths(2).ToString("yyyy-MM-dd") };
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsJsonAsync($"/api/v1/zones/{x.Seed.ZoneAId}/depreciations", future)).StatusCode);
    }

    [Fact]
    public async Task Service_request_list_returns_farm_and_zone_names_even_after_the_request_is_closed()
    {
        using var f = new TestApplicationFactory(); using var c = f.CreateClient();
        var x = await SetupAsync(f, c, DeploymentRequestStatus.Installing);
        string farmName, zoneName;
        using (var scope = f.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            farmName = (await db.Farms.SingleAsync(z => z.Id == x.Seed.FarmAId)).Name;
            zoneName = (await db.Zones.SingleAsync(z => z.Id == x.Seed.ZoneAId)).Name;
            (await db.ServiceRequests.SingleAsync(r => r.Id == x.ServiceRequestId)).Status = ServiceRequestStatus.Closed;
            await db.SaveChangesAsync();
        }
        // Phiếu đã đóng: kỹ thuật viên không còn quyền đọc Zone của trang trại, nhưng danh sách vẫn phải có tên.
        await Login(c, "technician@example.com");
        var list = await c.GetFromJsonAsync<JsonElement>("/api/v1/service-requests", Json);
        var item = list.EnumerateArray().Single(e => e.GetProperty("id").GetGuid() == x.ServiceRequestId);
        Assert.Equal(farmName, item.GetProperty("farmName").GetString());
        Assert.Equal(zoneName, item.GetProperty("zoneName").GetString());
        var one = await c.GetFromJsonAsync<JsonElement>($"/api/v1/service-requests/{x.ServiceRequestId}", Json);
        Assert.Equal(zoneName, one.GetProperty("zoneName").GetString());
    }


    private static async Task<List<Notification>> ServiceNotesAsync(TestApplicationFactory f, string email)
    {
        using var scope = f.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        var userId = (await db.AppUsers.SingleAsync(u => u.Email == email)).Id;
        return await db.Notifications.Where(n => n.UserId == userId && n.Type == NotificationType.Service).OrderBy(n => n.CreatedAtUtc).ToListAsync();
    }

    [Fact]
    public async Task Installation_flow_notifies_the_owner_on_quotation_and_the_technician_on_deposit_and_acceptance()
    {
        using var f = new TestApplicationFactory(); using var c = f.CreateClient();
        var x = await SetupAsync(f, c, DeploymentRequestStatus.Completed);
        // KTV gửi báo giá/hợp đồng → Chủ trang trại được báo (ReferenceId = phiếu dịch vụ), KTV chưa có gì.
        var owner = Assert.Single(await ServiceNotesAsync(f, "owner-a@example.com"));
        Assert.Equal("Báo giá/hợp đồng lắp đặt mới", owner.Title);
        Assert.Equal(x.ServiceRequestId.ToString(), owner.ReferenceId);
        Assert.False(owner.IsRead);
        Assert.DoesNotContain(await ServiceNotesAsync(f, "technician@example.com"), n => n.Title.Contains("ký hợp đồng"));

        await Login(c, "owner-a@example.com");
        (await Deposit(c, x.ServiceRequestId)).EnsureSuccessStatusCode();
        var afterDeposit = await ServiceNotesAsync(f, "technician@example.com");
        var dep = Assert.Single(afterDeposit, n => n.Title == "Chủ trang trại đã ký hợp đồng và đóng cọc");
        Assert.Equal(x.ServiceRequestId.ToString(), dep.ReferenceId);

        (await Final(c, x.ServiceRequestId)).EnsureSuccessStatusCode();
        var afterFinal = await ServiceNotesAsync(f, "technician@example.com");
        Assert.Contains(afterFinal, n => n.Title == "Chủ trang trại đã ký nghiệm thu");
        // Mỗi sự kiện đúng một thông báo cho KTV (không nhân đôi).
        Assert.Equal(1, afterFinal.Count(n => n.Title == "Chủ trang trại đã ký hợp đồng và đóng cọc"));
    }
}
