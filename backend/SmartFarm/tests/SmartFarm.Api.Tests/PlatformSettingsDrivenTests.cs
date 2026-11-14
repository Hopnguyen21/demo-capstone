using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SmartFarm.Application.Common.Exceptions;
using SmartFarm.Application.Features.Platform;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;
using SmartFarm.Infrastructure.Platform;
using Xunit;

namespace SmartFarm.Api.Tests;

/// <summary>Tham số nghiệp vụ (ngưỡng mưa, tỷ lệ cọc, ngưỡng AI) đọc từ platform_settings, không hardcode.</summary>
public class PlatformSettingsDrivenTests
{
    private static SmartFarmDbContext NewDb() =>
        new(new DbContextOptionsBuilder<SmartFarmDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private static async Task SetAsync(SmartFarmDbContext db, string key, string value)
    {
        await PlatformSettingsStore.EnsureDefaultsAsync(db, CancellationToken.None);
        (await db.PlatformSettings.SingleAsync(x => x.Key == key)).Value = value;
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task Missing_or_invalid_setting_falls_back_to_the_documented_default()
    {
        using var db = NewDb();
        Assert.Equal(70m, await PlatformSettingsStore.GetDecimalAsync(db, PlatformSettingKeys.RainGuardThresholdPercent, default));
        Assert.Equal(30m, await PlatformSettingsStore.GetDecimalAsync(db, PlatformSettingKeys.DepositPercent, default));
        await SetAsync(db, PlatformSettingKeys.RainGuardThresholdPercent, "abc");
        Assert.Equal(70m, await PlatformSettingsStore.GetDecimalAsync(db, PlatformSettingKeys.RainGuardThresholdPercent, default));
        await SetAsync(db, PlatformSettingKeys.RainGuardThresholdPercent, "150");
        Assert.Equal(70m, await PlatformSettingsStore.GetDecimalAsync(db, PlatformSettingKeys.RainGuardThresholdPercent, default));
        await SetAsync(db, PlatformSettingKeys.RainGuardThresholdPercent, "55");
        Assert.Equal(55m, await PlatformSettingsStore.GetDecimalAsync(db, PlatformSettingKeys.RainGuardThresholdPercent, default));
    }

    [Fact]
    public async Task Admin_settings_list_shows_the_business_parameters_with_their_defaults()
    {
        using var db = NewDb();
        var admin = new PlatformAdminService(db);
        var list = await admin.GetSettingsAsync(default);
        foreach (var def in PlatformSettingsStore.Definitions)
            Assert.Contains(list, x => x.Key == def.Key && x.Group == def.Group);
    }

    [Fact]
    public async Task Updating_a_setting_validates_the_range_and_writes_an_audit_record()
    {
        using var db = NewDb();
        var admin = new PlatformAdminService(db);
        var actor = Guid.NewGuid();
        await Assert.ThrowsAsync<RequestValidationException>(() =>
            admin.UpdateSettingsAsync([new(PlatformSettingKeys.DepositPercent, "0")], actor, default));
        await Assert.ThrowsAsync<RequestValidationException>(() =>
            admin.UpdateSettingsAsync([new(PlatformSettingKeys.AiTelemetryFreshnessMinutes, "2.5")], actor, default));
        Assert.False(await db.AuditLogs.AnyAsync(x => x.Action == "PLATFORM_SETTING_UPDATED"));

        await admin.UpdateSettingsAsync([new(PlatformSettingKeys.DepositPercent, "40")], actor, default);
        Assert.Equal(40m, await PlatformSettingsStore.GetDecimalAsync(db, PlatformSettingKeys.DepositPercent, default));
        var audit = await db.AuditLogs.SingleAsync(x => x.Action == "PLATFORM_SETTING_UPDATED");
        Assert.Equal(PlatformSettingKeys.DepositPercent, audit.EntityId);
        Assert.Equal(actor, audit.ActorUserId);
        Assert.Contains("'40'", audit.Details);
    }

    [Theory]
    [InlineData(null, 300_000, 700_000)]
    [InlineData("40", 400_000, 600_000)]
    public async Task Quotation_deposit_follows_the_configured_percentage(string? configured, int deposit, int remaining)
    {
        using var db = NewDb();
        if (configured is not null) await SetAsync(db, PlatformSettingKeys.DepositPercent, configured);
        var tech = Guid.NewGuid();
        var sr = new ServiceRequest { TenantId = Guid.NewGuid(), FarmId = Guid.NewGuid(), ZoneId = Guid.NewGuid(), DeploymentRequestId = Guid.NewGuid(), Source = "Owner", FailureCode = "NEW_INSTALL", Description = "x", AssignedTechnicianId = tech };
        db.ServiceRequests.Add(sr); await db.SaveChangesAsync();
        var view = await new QuotationService(db).CreateAsync(tech, sr.Id,
            new CreateQuotationCommand([new("GW-1", "Gateway", "GATEWAY", "Trạm", 1, 1_000_000m, 0m, null)], null, null), default);
        Assert.Equal(1_000_000m, view.TotalAmount);
        Assert.Equal(deposit, view.Deposit30Percent);
        Assert.Equal(remaining, view.Remaining70Percent);
    }

    [Fact]
    public async Task Business_parameters_are_public_for_the_landing_page_and_readable_by_any_signed_in_role()
    {
        using var factory = new TestApplicationFactory(); await factory.SeedAsync();
        using var client = factory.CreateClient();
        // Công khai có chủ ý: trang giới thiệu (web/mobile) hiển thị tỷ lệ cọc trước khi đăng nhập; chỉ 4 con số không bí mật.
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/v1/platform/business-parameters")).StatusCode);

        var login = await client.PostAsJsonAsync("/api/v1/auth/login", new { email = "owner-a@example.com", password = "ValidPassword1!" });
        login.EnsureSuccessStatusCode();
        var token = JsonDocument.Parse(await login.Content.ReadAsStringAsync()).RootElement.GetProperty("accessToken").GetString();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var json = JsonDocument.Parse(await client.GetStringAsync("/api/v1/platform/business-parameters")).RootElement;
        Assert.Equal(30m, json.GetProperty("depositPercent").GetDecimal());
        Assert.Equal(70m, json.GetProperty("rainGuardThresholdPercent").GetDecimal());
        Assert.Equal(15m, json.GetProperty("repeatPurchaseDiscountPercent").GetDecimal());
        Assert.Equal(10m, json.GetProperty("renewalDiscountPercent").GetDecimal());

        using (var scope = factory.Services.CreateScope())
            await SetAsync(scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>(), PlatformSettingKeys.DepositPercent, "35");
        json = JsonDocument.Parse(await client.GetStringAsync("/api/v1/platform/business-parameters")).RootElement;
        Assert.Equal(35m, json.GetProperty("depositPercent").GetDecimal());
    }
}
