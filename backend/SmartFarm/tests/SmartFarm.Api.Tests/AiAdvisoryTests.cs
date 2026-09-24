using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SmartFarm.Application.Features.Ai;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;
using Xunit;

namespace SmartFarm.Api.Tests;

public sealed class AiAdvisoryTests
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };

    [Fact]
    public async Task Missing_context_returns_explicit_non_actionable_result_without_calling_provider()
    {
        using var factory = new TestApplicationFactory();
        var seed = await factory.SeedAsync();
        using var client = factory.CreateClient();
        await Login(client, "owner-a@example.com");

        var response = await client.PostAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}/ai/ask", new { question = "Tôi nên chăm sóc khu vực này thế nào?" });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var recommendation = await Read<AiRecommendationView>(response);
        Assert.Equal(AiRecommendationStatus.InsufficientData, recommendation.Status);
        Assert.False(recommendation.IsActionable);
        Assert.Contains(recommendation.Limitations, x => x.Contains("planting season", StringComparison.OrdinalIgnoreCase));
        Assert.Equal(0, factory.AiProvider.Calls);
    }

    [Fact]
    public async Task Farmer_is_forbidden_and_cross_tenant_zone_is_hidden()
    {
        using var factory = new TestApplicationFactory();
        var seed = await factory.SeedAsync();
        using var client = factory.CreateClient();

        await Login(client, "farmer@example.com");
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync($"/api/v1/zones/{seed.ZoneAId}/ai/context")).StatusCode);

        await Login(client, "owner-b@example.com");
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/v1/zones/{seed.ZoneAId}/ai/context")).StatusCode);
    }

    [Fact]
    public async Task Rejection_is_audited_and_never_creates_control_command()
    {
        using var factory = new TestApplicationFactory();
        var fixture = await PrepareActionableContextAsync(factory);
        using var client = factory.CreateClient();
        await Login(client, "owner-a@example.com");
        var recommendation = await Ask(client, fixture.ZoneId);

        var response = await client.PostAsJsonAsync($"/api/v1/zones/{fixture.ZoneId}/ai/apply-recommendation", new
        {
            recommendationId = recommendation.RecommendationId,
            decision = "Rejected",
            reason = "Owner prefers manual inspection"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await Read<AiDecisionResult>(response);
        Assert.Equal(AiRecommendationStatus.Rejected, result.Recommendation.Status);
        Assert.Null(result.Command);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        Assert.Empty(await db.ActuatorCommands.Where(x => x.RecommendationId == recommendation.RecommendationId).ToListAsync());
        Assert.Equal(AiRecommendationDecisionType.Rejected, (await db.AiRecommendationDecisions.SingleAsync()).DecisionType);
    }

    [Fact]
    public async Task Owner_acceptance_hands_valid_recommendation_to_control_with_ai_audit_source()
    {
        using var factory = new TestApplicationFactory();
        var fixture = await PrepareActionableContextAsync(factory);
        using var client = factory.CreateClient();
        await Login(client, "owner-a@example.com");
        var recommendation = await Ask(client, fixture.ZoneId);
        Assert.True(recommendation.IsActionable);

        var response = await client.PostAsJsonAsync($"/api/v1/zones/{fixture.ZoneId}/ai/apply-recommendation", new
        {
            recommendationId = recommendation.RecommendationId,
            decision = "Accepted"
        });

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        var result = await Read<AiDecisionResult>(response);
        Assert.NotNull(result.Command);
        Assert.Equal(CommandTriggerSource.AI_APPROVED, result.Command!.TriggerSource);
        Assert.Equal(ActuatorCommandStatus.Sent, result.Command.Status);
        Assert.Null(result.Command.AcknowledgedAtUtc);
        Assert.Single(factory.ControlTransport.Published);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        var command = await db.ActuatorCommands.SingleAsync(x => x.Id == result.Command.CommandId);
        Assert.Equal(recommendation.RecommendationId, command.RecommendationId);
        Assert.Equal(CommandTriggerSource.AI_APPROVED, command.TriggerSource);
    }

    [Fact]
    public async Task Low_confidence_recommendation_cannot_be_accepted()
    {
        using var factory = new TestApplicationFactory();
        var fixture = await PrepareActionableContextAsync(factory);
        factory.AiProvider.Result = factory.AiProvider.Result with { Confidence = 0.40m };
        using var client = factory.CreateClient();
        await Login(client, "owner-a@example.com");
        var recommendation = await Ask(client, fixture.ZoneId);
        Assert.Equal(AiRecommendationStatus.LowConfidence, recommendation.Status);
        Assert.False(recommendation.IsActionable);

        var response = await client.PostAsJsonAsync($"/api/v1/zones/{fixture.ZoneId}/ai/apply-recommendation", new { recommendationId = recommendation.RecommendationId, decision = "Accepted" });
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Empty(factory.ControlTransport.Published);
    }

    [Fact]
    public async Task More_analysis_decision_supersedes_original_and_links_follow_up()
    {
        using var factory = new TestApplicationFactory();
        var fixture = await PrepareActionableContextAsync(factory);
        using var client = factory.CreateClient();
        await Login(client, "owner-a@example.com");
        var recommendation = await Ask(client, fixture.ZoneId);

        var response = await client.PostAsJsonAsync($"/api/v1/zones/{fixture.ZoneId}/ai/apply-recommendation", new
        {
            recommendationId = recommendation.RecommendationId,
            decision = "MoreAnalysisRequested",
            followUpQuestion = "Phân tích thêm rủi ro tưới trong 15 phút tới"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await Read<AiDecisionResult>(response);
        Assert.Equal(AiRecommendationStatus.Superseded, result.Recommendation.Status);
        Assert.NotNull(result.FollowUpRecommendation);
        Assert.Equal(recommendation.RecommendationId, (await GetConsultation(factory, result.FollowUpRecommendation!.ConsultationRequestId)).ParentRecommendationId);
        Assert.Empty(factory.ControlTransport.Published);
    }

    [Fact]
    public async Task Consultation_rate_limit_returns_429_and_retry_after()
    {
        using var factory = new TestApplicationFactory();
        var seed = await factory.SeedAsync();
        using var client = factory.CreateClient();
        await Login(client, "owner-a@example.com");
        for (var i = 0; i < 10; i++)
        {
            var accepted = await client.PostAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}/ai/ask", new { question = $"Phân tích lần thứ {i + 1} cho khu vực này" });
            Assert.Equal(HttpStatusCode.Created, accepted.StatusCode);
        }

        var limited = await client.PostAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}/ai/ask", new { question = "Phân tích thêm một lần nữa" });
        Assert.Equal(HttpStatusCode.TooManyRequests, limited.StatusCode);
        Assert.True(limited.Headers.TryGetValues("Retry-After", out _));
    }

    private static async Task<AiRecommendationView> Ask(HttpClient client, Guid zoneId)
    {
        var response = await client.PostAsJsonAsync($"/api/v1/zones/{zoneId}/ai/ask", new { question = "Độ ẩm đất thấp, có nên tưới ngay không?" });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await Read<AiRecommendationView>(response);
    }

    private static async Task<AiFixture> PrepareActionableContextAsync(TestApplicationFactory factory)
    {
        var seed = await factory.SeedAsync();
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        var farm = await db.Farms.Include(x => x.Tenant).SingleAsync(x => x.Id == seed.FarmAId);
        var crop = await db.Crops.SingleAsync(x => x.Id == Guid.Parse("10000000-0000-0000-0000-000000000001"));
        var variety = await db.CropVarieties.SingleAsync(x => x.Id == Guid.Parse("10000000-0000-0000-0000-000000000002"));
        var profile = await db.GrowthProfiles.SingleAsync(x => x.Id == Guid.Parse("10000000-0000-0000-0000-000000000003"));
        var stage = await db.GrowthStages.Include(x => x.Requirements).SingleAsync(x => x.Id == Guid.Parse("10000000-0000-0000-0000-000000000004"));
        var season = new PlantingSeason
        {
            ZoneId = seed.ZoneAId, Crop = crop, Variety = variety, GrowthProfile = profile, CurrentGrowthStage = stage,
            Name = "AI season", StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-10)), ExpectedEndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(60))
        };
        foreach (var requirement in stage.Requirements)
            season.AppliedRequirements.Add(new SeasonAppliedRequirement { ParameterCode = requirement.ParameterCode, MinValue = requirement.MinValue, MaxValue = requirement.MaxValue, TargetValue = requirement.TargetValue, Unit = requirement.Unit });

        var deployment = new DeploymentRequest { TenantId = farm.TenantId, FarmId = farm.Id, ZoneId = seed.ZoneAId, PlantingSeason = season, OwnerUserId = seed.OwnerAId, TechnicianUserId = seed.TechnicianId, Status = DeploymentRequestStatus.Completed, RequiredParametersCsv = "SoilMoisture" };
        var gateway = new Gateway { FarmId = farm.Id, DeploymentRequest = deployment, MacAddress = "AA:BB:CC:DD:EE:99", GatewaySerial = $"AI-{Guid.NewGuid():N}", FrequencyBand = "433MHz", FirmwareVersion = "v1", MqttClientId = $"ai-{Guid.NewGuid():N}", ClientCertificateFingerprint = new string('C', 64), Status = GatewayStatus.Online, LastSeenAtUtc = DateTime.UtcNow };
        var device = new Device { FarmId = farm.Id, Gateway = gateway, DeploymentRequest = deployment, ZoneId = seed.ZoneAId, HardwareAddress = $"AI-{Guid.NewGuid():N}", DeviceType = DeviceType.ActuatorNode, Status = DeviceStatus.Online };
        var pump = new DeviceActuator { Device = device, ActuatorType = "WaterPump", RelayChannel = 1, MaxDurationMinutes = 30 };
        db.AddRange(season, deployment, gateway, device, pump);
        await db.SaveChangesAsync();
        db.DeviceConnectionTests.Add(new DeviceConnectionTest { DeviceId = device.Id, DeploymentRequestId = deployment.Id, TechnicianUserId = seed.TechnicianId, Succeeded = true, ObservedAtUtc = DateTime.UtcNow });
        db.TelemetryReadings.Add(new TelemetryReading { TenantId = farm.TenantId, FarmId = farm.Id, ZoneId = seed.ZoneAId, DeviceId = device.Id, GatewayId = gateway.Id, MessageId = $"ai-{Guid.NewGuid():N}", ParameterCode = EnvironmentalParameterCode.SoilMoisture, Value = 35, Unit = "%", CapturedAtUtc = DateTime.UtcNow, ReceivedAtUtc = DateTime.UtcNow });
        await db.SaveChangesAsync();
        factory.AiProvider.Result = new AiProviderResult("FakeAgronomist", "Soil is dry", "Irrigation may restore the current stage target.", 0.92m, ["Based on the latest available sample."], new AiProposedControlAction(pump.Id, ActuatorCommandAction.TurnOn, 300));
        return new AiFixture(seed.ZoneAId, pump.Id);
    }

    private static async Task<T> Read<T>(HttpResponseMessage response) => (await response.Content.ReadFromJsonAsync<T>(Json))!;
    private static async Task<AiConsultationRequest> GetConsultation(TestApplicationFactory factory, Guid id)
    {
        using var scope = factory.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>().AiConsultationRequests.AsNoTracking().SingleAsync(x => x.Id == id);
    }
    private static async Task Login(HttpClient client, string email)
    {
        client.DefaultRequestHeaders.Authorization = null;
        var response = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = "ValidPassword1!" });
        response.EnsureSuccessStatusCode();
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", json.RootElement.GetProperty("accessToken").GetString());
    }

    private sealed record AiFixture(Guid ZoneId, Guid PumpId);
}
