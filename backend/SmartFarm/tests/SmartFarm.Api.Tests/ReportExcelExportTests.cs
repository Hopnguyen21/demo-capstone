using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using ClosedXML.Excel;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;
using SmartFarm.Infrastructure.Reports;
using Xunit;

namespace SmartFarm.Api.Tests;

public sealed class ReportExcelExportTests
{
    private const string ExpectedMimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    [Fact]
    public async Task Export_resource_report_excel_returns_valid_workbook_with_matching_data_and_sheets()
    {
        using var factory = new TestApplicationFactory();
        var seed = await factory.SeedAsync();
        await SeedCommands(factory, seed);
        using var client = factory.CreateClient();
        await Login(client, "owner-a@example.com");

        var response = await client.GetAsync($"/api/v1/farms/{seed.FarmAId}/report/excel");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(ExpectedMimeType, response.Content.Headers.ContentType?.MediaType);
        var disposition = response.Content.Headers.ContentDisposition;
        Assert.NotNull(disposition);
        Assert.Contains(".xlsx", disposition.FileName ?? disposition.FileNameStar, StringComparison.OrdinalIgnoreCase);

        var bytes = await response.Content.ReadAsByteArrayAsync();
        Assert.True(bytes.Length > 0);

        using var ms = new MemoryStream(bytes);
        using var workbook = new XLWorkbook(ms);

        // Verify worksheets
        Assert.Contains(workbook.Worksheets, ws => ws.Name == "TongQuan_KPI");
        Assert.Contains(workbook.Worksheets, ws => ws.Name == "TieuThuNuoc");
        Assert.Contains(workbook.Worksheets, ws => ws.Name == "DienNang");
        Assert.Contains(workbook.Worksheets, ws => ws.Name == "TheoKhuVuc");
        Assert.Contains(workbook.Worksheets, ws => ws.Name == "CongViec_NhanSu");
        Assert.Contains(workbook.Worksheets, ws => ws.Name == "CanCu_CongThuc");

        // Verify data in Water sheet
        var waterSheet = workbook.Worksheet("TieuThuNuoc");
        Assert.Equal("BÁO CÁO TIÊU THỤ NƯỚC TƯỚI", waterSheet.Cell(2, 1).GetString());
        // Verify total row exists and has numeric value
        var lastRow = waterSheet.LastRowUsed()!.RowNumber();
        Assert.True(lastRow >= 8);

        // Verify Formulas sheet
        var formulaSheet = workbook.Worksheet("CanCu_CongThuc");
        Assert.True(formulaSheet.LastRowUsed()!.RowNumber() >= 4);
    }

    [Fact]
    public async Task Export_individual_reports_excel_return_valid_workbooks()
    {
        using var factory = new TestApplicationFactory();
        var seed = await factory.SeedAsync();
        await SeedCommands(factory, seed);
        await SeedSeason(factory, seed);
        using var client = factory.CreateClient();
        await Login(client, "owner-a@example.com");

        var endpoints = new[]
        {
            $"/api/v1/farms/{seed.FarmAId}/report/overview/excel",
            $"/api/v1/farms/{seed.FarmAId}/report/water-usage/excel",
            $"/api/v1/farms/{seed.FarmAId}/report/electricity/excel",
            $"/api/v1/farms/{seed.FarmAId}/report/inventory/excel",
            $"/api/v1/farms/{seed.FarmAId}/report/tasks/excel",
            $"/api/v1/farms/{seed.FarmAId}/report/maintenance/excel",
            $"/api/v1/zones/{seed.ZoneAId}/report/season-summary/excel"
        };

        foreach (var url in endpoints)
        {
            var res = await client.GetAsync(url);
            Assert.True(res.IsSuccessStatusCode, $"{url} returned {(int)res.StatusCode}");
            Assert.Equal(ExpectedMimeType, res.Content.Headers.ContentType?.MediaType);

            var data = await res.Content.ReadAsByteArrayAsync();
            Assert.True(data.Length > 1000, $"{url} should produce valid .xlsx bytes");

            using var ms = new MemoryStream(data);
            using var wb = new XLWorkbook(ms);
            Assert.True(wb.Worksheets.Count >= 1, $"{url} should have at least 1 worksheet");
        }
    }

    [Fact]
    public async Task Owner_cannot_export_excel_report_across_tenants()
    {
        using var factory = new TestApplicationFactory();
        var seed = await factory.SeedAsync();
        using var client = factory.CreateClient();
        await Login(client, "owner-b@example.com");

        // Try to export Farm A's reports as Owner B
        var farmPaths = new[]
        {
            "excel", "overview/excel", "water-usage/excel", "electricity/excel", "inventory/excel", "tasks/excel", "maintenance/excel"
        };
        foreach (var p in farmPaths)
        {
            var res = await client.GetAsync($"/api/v1/farms/{seed.FarmAId}/report/{p}");
            Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
        }

        var zoneRes = await client.GetAsync($"/api/v1/zones/{seed.ZoneAId}/report/season-summary/excel");
        Assert.Equal(HttpStatusCode.NotFound, zoneRes.StatusCode);
    }

    [Theory]
    [InlineData("=SUM(A1:A10)", "'=SUM(A1:A10)")]
    [InlineData("+12345", "'+12345")]
    [InlineData("-cmd|' /C calc'!A0", "'-cmd|' /C calc'!A0")]
    [InlineData("@HYPERLINK(\"http://evil.com\")", "'@HYPERLINK(\"http://evil.com\")")]
    [InlineData("\tmalicious", "'\tmalicious")]
    [InlineData("  =FORMULA", "'  =FORMULA")]
    [InlineData("Khu vực 1", "Khu vực 1")]
    [InlineData("Cà chua Beefsteak", "Cà chua Beefsteak")]
    [InlineData("", "")]
    [InlineData(null, "")]
    public void Formula_injection_characters_are_sanitized_with_leading_apostrophe(string? input, string expected)
    {
        var sanitized = ReportExcelExporter.SanitizeText(input);
        Assert.Equal(expected, sanitized);
    }

    [Fact]
    public void SetSafeCell_sets_text_data_type_and_prevents_formula_execution()
    {
        using var wb = new XLWorkbook();
        var ws = wb.Worksheets.Add("Test");
        var cell = ws.Cell(1, 1);

        ReportExcelExporter.SetSafeCell(cell, "=SUM(1,2)");

        Assert.False(cell.HasFormula);
        Assert.Equal("@", cell.Style.NumberFormat.Format);
    }

    [Fact]
    public async Task Empty_data_range_produces_valid_workbook_with_notice_row()
    {
        using var factory = new TestApplicationFactory();
        var seed = await factory.SeedAsync();
        using var client = factory.CreateClient();
        await Login(client, "owner-a@example.com");

        var pastStart = DateTime.UtcNow.AddYears(-5);
        var pastEnd = pastStart.AddDays(1);
        var query = $"?fromUtc={Uri.EscapeDataString(pastStart.ToString("O"))}&toUtc={Uri.EscapeDataString(pastEnd.ToString("O"))}";

        var res = await client.GetAsync($"/api/v1/farms/{seed.FarmAId}/report/water-usage/excel{query}");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);

        var data = await res.Content.ReadAsByteArrayAsync();
        using var ms = new MemoryStream(data);
        using var wb = new XLWorkbook(ms);

        var ws = wb.Worksheet("TieuThuNuoc");
        Assert.NotNull(ws);
        // Notice row should contain "Không có dữ liệu"
        var text = ws.Cell(8, 1).GetString();
        Assert.Contains("Không có dữ liệu", text);
    }

    private static async Task SeedCommands(TestApplicationFactory factory, SeedData seed)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        var farm = await db.Farms.SingleAsync(x => x.Id == seed.FarmAId);
        var deployment = new DeploymentRequest
        {
            TenantId = farm.TenantId, FarmId = seed.FarmAId, ZoneId = seed.ZoneAId,
            PlantingSeasonId = Guid.NewGuid(), OwnerUserId = seed.OwnerAId,
            Status = DeploymentRequestStatus.Completed, RequiredParametersCsv = "SoilMoisture"
        };
        var gateway = new Gateway
        {
            FarmId = seed.FarmAId, DeploymentRequest = deployment,
            MacAddress = "AA:BB:CC:91:92:93", GatewaySerial = "GW-REPORT-1", FrequencyBand = "AS923",
            FirmwareVersion = "1.0", MqttClientId = "report-gateway", ClientCertificateFingerprint = new string('A', 64)
        };
        var device = new Device
        {
            FarmId = seed.FarmAId, Gateway = gateway, DeploymentRequest = deployment, ZoneId = seed.ZoneAId,
            HardwareAddress = "REPORT-ACTUATOR", DeviceType = DeviceType.ActuatorNode, Status = DeviceStatus.Online
        };
        var rated = new DeviceActuator { Device = device, ActuatorType = "Pump", RelayChannel = 1, MaxDurationMinutes = 30, FlowRateLitersPerMinute = 10, RatedPowerWatt = 1200 };
        var unrated = new DeviceActuator { Device = device, ActuatorType = "Valve", RelayChannel = 2, MaxDurationMinutes = 30 };
        var acknowledgedAt = DateTime.UtcNow.AddMinutes(-5);
        db.AddRange(deployment, gateway, device, rated, unrated,
            Command(farm.TenantId, seed, gateway, device, rated, "report-ack-rated", ActuatorCommandStatus.Acknowledged, acknowledgedAt),
            Command(farm.TenantId, seed, gateway, device, unrated, "report-ack-unrated", ActuatorCommandStatus.Acknowledged, acknowledgedAt));
        await db.SaveChangesAsync();
    }

    private static async Task<Guid> SeedSeason(TestApplicationFactory factory, SeedData seed)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        var tenantId = (await db.Farms.SingleAsync(x => x.Id == seed.FarmAId)).TenantId;
        var crop = new Crop { TenantId = tenantId, CreatedByUserId = seed.OwnerAId, Name = "Report crop", NormalizedName = "REPORT CROP", ScientificName = "Testus reportus" };
        var profile = new GrowthProfile { Crop = crop, TenantId = tenantId, CreatedByUserId = seed.OwnerAId, Name = "Report profile", NormalizedName = "REPORT PROFILE", IsDefault = true };
        var stage = new GrowthStage { GrowthProfile = profile, Name = "Vegetative", StageOrder = 1, DurationDays = 30 };
        var season = new PlantingSeason
        {
            ZoneId = seed.ZoneAId, Crop = crop, GrowthProfile = profile, CurrentGrowthStage = stage,
            Name = "Current report season", StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-10)),
            ExpectedEndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(20)), Status = PlantingSeasonStatus.InProgress
        };
        db.AddRange(crop, profile, stage, season);
        await db.SaveChangesAsync();
        return season.Id;
    }

    private static ActuatorCommand Command(Guid tenantId, SeedData seed, Gateway gateway, Device device, DeviceActuator actuator, string key, ActuatorCommandStatus status, DateTime? acknowledgedAt) => new()
    {
        TenantId = tenantId, FarmId = seed.FarmAId, ZoneId = seed.ZoneAId,
        Gateway = gateway, Device = device, Actuator = actuator, TriggeredByUserId = seed.OwnerAId,
        IdempotencyKey = key, TriggerSource = CommandTriggerSource.Manual, Action = ActuatorCommandAction.TurnOn,
        DurationSeconds = 600, Status = status, QueuedAtUtc = DateTime.UtcNow.AddMinutes(-6),
        SentAtUtc = DateTime.UtcNow.AddMinutes(-5), AcknowledgedAtUtc = acknowledgedAt
    };

    private static async Task Login(HttpClient client, string email)
    {
        var response = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = "ValidPassword1!" });
        response.EnsureSuccessStatusCode();
        var payload = await response.Content.ReadFromJsonAsync<LoginPayload>();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", payload!.AccessToken);
    }

    private sealed record LoginPayload(string AccessToken);
}
