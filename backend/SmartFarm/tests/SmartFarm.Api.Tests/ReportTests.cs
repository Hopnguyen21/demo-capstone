using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SmartFarm.Application.Features.Reports;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;
using Xunit;

namespace SmartFarm.Api.Tests;

public sealed class ReportTests
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };

    [Fact]
    public async Task Water_and_electricity_use_only_acknowledged_commands_and_expose_unmeasured_counts()
    {
        using var factory = new TestApplicationFactory();
        var seed = await factory.SeedAsync();
        await SeedCommands(factory, seed);
        using var client = factory.CreateClient();
        await Login(client, "owner-a@example.com");

        var water = await Read<ResourceUsageReport>(await client.GetAsync($"/api/v1/farms/{seed.FarmAId}/report/water-usage"));
        var electricity = await Read<ResourceUsageReport>(await client.GetAsync($"/api/v1/farms/{seed.FarmAId}/report/electricity"));

        Assert.Equal(100m, water.Total);
        Assert.Equal(0.2m, electricity.Total);
        Assert.Equal(1, water.CountedCommandCount);
        Assert.Equal(1, water.UnmeasuredCommandCount);
        Assert.Equal(1, electricity.CountedCommandCount);
        Assert.Equal(1, electricity.UnmeasuredCommandCount);
        Assert.Contains(water.Formulas, x => x.Source.Contains("actuator_commands", StringComparison.Ordinal));
    }

    [Fact]
    public async Task Owner_cannot_read_any_cross_tenant_report()
    {
        using var factory = new TestApplicationFactory();
        var seed = await factory.SeedAsync();
        using var client = factory.CreateClient();
        await Login(client, "owner-b@example.com");

        var farmPaths = new[]
        {
            "overview", "water-usage", "electricity", "inventory", "tasks", "maintenance"
        };
        foreach (var report in farmPaths)
            Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/v1/farms/{seed.FarmAId}/report/{report}")).StatusCode);

        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/v1/zones/{seed.ZoneAId}/report/season-summary")).StatusCode);
    }

    [Fact]
    public async Task Overview_and_operational_reports_return_formula_and_source_metadata()
    {
        using var factory = new TestApplicationFactory();
        var seed = await factory.SeedAsync();
        using var client = factory.CreateClient();
        await Login(client, "owner-a@example.com");

        var overview = await Read<FarmOverviewReport>(await client.GetAsync($"/api/v1/farms/{seed.FarmAId}/report/overview"));
        var inventory = await Read<InventoryReport>(await client.GetAsync($"/api/v1/farms/{seed.FarmAId}/report/inventory"));
        var tasks = await Read<TaskReport>(await client.GetAsync($"/api/v1/farms/{seed.FarmAId}/report/tasks"));
        var maintenance = await Read<MaintenanceReport>(await client.GetAsync($"/api/v1/farms/{seed.FarmAId}/report/maintenance"));

        Assert.Equal(seed.FarmAId, overview.FarmId);
        Assert.NotEmpty(overview.Formulas);
        Assert.NotEmpty(inventory.Formulas);
        Assert.NotEmpty(tasks.Formulas);
        Assert.NotEmpty(maintenance.Formulas);
        Assert.All(overview.Formulas, x => Assert.False(string.IsNullOrWhiteSpace(x.Source)));
    }

    [Fact]
    public async Task Season_summary_uses_the_current_zone_season_and_stage()
    {
        using var factory = new TestApplicationFactory();
        var seed = await factory.SeedAsync();
        var seasonId = await SeedSeason(factory, seed);
        using var client = factory.CreateClient();
        await Login(client, "owner-a@example.com");

        var report = await Read<SeasonSummaryReport>(await client.GetAsync($"/api/v1/zones/{seed.ZoneAId}/report/season-summary"));

        Assert.Equal(seasonId, report.SeasonId);
        Assert.Equal("Report crop", report.CropName);
        Assert.Equal("Vegetative", report.GrowthStageName);
        Assert.Equal(PlantingSeasonStatus.InProgress, report.Status);
        Assert.Contains(report.Formulas, x => x.Metric == "materialIssuedQuantity");
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
            Command(farm.TenantId, seed, gateway, device, unrated, "report-ack-unrated", ActuatorCommandStatus.Acknowledged, acknowledgedAt),
            Command(farm.TenantId, seed, gateway, device, rated, "report-sent", ActuatorCommandStatus.Sent, null));
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

    private static async Task<T> Read<T>(HttpResponseMessage response)
    {
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<T>(Json))!;
    }

    private sealed record LoginPayload(string AccessToken);
}
