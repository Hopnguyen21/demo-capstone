using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Application.Features.Ai;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Ai;
using Xunit;

namespace SmartFarm.Infrastructure.Tests;

public sealed class GeminiAiAdvisoryProviderTests
{
    [Fact]
    public async Task Provider_sends_key_in_header_and_parses_structured_action()
    {
        var actuatorId = Guid.NewGuid();
        var output = JsonSerializer.Serialize(new
        {
            summary = "Đất đang khô",
            details = "Độ ẩm thấp hơn ngưỡng hiện tại.",
            confidence = 0.91m,
            limitations = new[] { "Dựa trên mẫu mới nhất." },
            proposedControlAction = new { enabled = true, actuatorId, action = "TurnOn", durationSeconds = 300 }
        });
        var envelope = JsonSerializer.Serialize(new { candidates = new[] { new { content = new { parts = new[] { new { text = output } } } } } });
        var handler = new StubHandler(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(envelope, Encoding.UTF8, "application/json") });
        var provider = new GeminiAiAdvisoryProvider(new HttpClient(handler), Options.Create(new GeminiOptions { ApiKey = "test-secret-key", Model = "gemini-2.5-flash" }), Microsoft.Extensions.Logging.Abstractions.NullLogger<GeminiAiAdvisoryProvider>.Instance);

        var result = await provider.GenerateAsync(new AiProviderRequest("Có nên tưới không?", Context(actuatorId)), CancellationToken.None);

        Assert.Equal("Google Gemini/gemini-2.5-flash", result.ProviderName);
        Assert.Equal(0.91m, result.Confidence);
        Assert.Equal(actuatorId, result.ProposedControlAction!.ActuatorId);
        Assert.Equal(300, result.ProposedControlAction.DurationSeconds);
        Assert.Equal("test-secret-key", handler.ApiKey);
        Assert.DoesNotContain("test-secret-key", handler.Uri!.ToString(), StringComparison.Ordinal);
        Assert.Contains("responseJsonSchema", handler.Body, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Provider_rejects_response_without_candidate_text()
    {
        var handler = new StubHandler(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("{}", Encoding.UTF8, "application/json") });
        var provider = new GeminiAiAdvisoryProvider(new HttpClient(handler), Options.Create(new GeminiOptions { ApiKey = "test-secret-key" }), Microsoft.Extensions.Logging.Abstractions.NullLogger<GeminiAiAdvisoryProvider>.Instance);
        await Assert.ThrowsAsync<InvalidOperationException>(() => provider.GenerateAsync(new AiProviderRequest("Phân tích", Context(Guid.NewGuid())), CancellationToken.None));
    }

    [Fact]
    public async Task Provider_includes_rag_knowledge_passages_in_prompt_content()
    {
        var actuatorId = Guid.NewGuid();
        var output = JsonSerializer.Serialize(new
        {
            summary = "Dựa trên tiêu chuẩn VietGAP",
            details = "Tưới nhỏ giọt theo quy trình VietGAP.",
            confidence = 0.95m,
            limitations = new[] { "Theo tài liệu VietGAP 2024" },
            proposedControlAction = new { enabled = false }
        });
        var envelope = JsonSerializer.Serialize(new { candidates = new[] { new { content = new { parts = new[] { new { text = output } } } } } });
        var handler = new StubHandler(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(envelope, Encoding.UTF8, "application/json") });
        var provider = new GeminiAiAdvisoryProvider(new HttpClient(handler), Options.Create(new GeminiOptions { ApiKey = "test-secret-key", Model = "gemini-2.5-flash" }), Microsoft.Extensions.Logging.Abstractions.NullLogger<GeminiAiAdvisoryProvider>.Instance);

        var passages = new List<KnowledgePassageView>
        {
            new(Guid.NewGuid(), Guid.NewGuid(), "Tài liệu VietGAP tưới tiêu", "Bộ NN&PTNT", "irrigation", "Độ ẩm tối ưu cho cà chua là 65-75%.", 0.92f)
        };

        var request = new AiProviderRequest("Có nên tưới không?", Context(actuatorId), passages);
        var result = await provider.GenerateAsync(request, CancellationToken.None);

        Assert.Equal("Google Gemini/gemini-2.5-flash", result.ProviderName);
        Assert.Contains("agriculture_knowledge", handler.Body, StringComparison.Ordinal);
        Assert.Contains("Độ ẩm tối ưu cho cà chua là 65-75%.", handler.Body, StringComparison.Ordinal);
        Assert.Contains("Tài liệu VietGAP tưới tiêu", result.Sources!);
    }

    private static AiZoneContext Context(Guid actuatorId) => new(
        Guid.NewGuid(), "Farm", "Asia/Ho_Chi_Minh", Guid.NewGuid(), "Field", Guid.NewGuid(), "Zone", 100,
        Guid.NewGuid(), "Cucumber", "F1", Guid.NewGuid(), "Profile", 10, Guid.NewGuid(), "Vegetative",
        [new(EnvironmentalParameterCode.SoilMoisture, 55, 75, 65, "%")],
        [new(EnvironmentalParameterCode.SoilMoisture, 40, "%", DateTime.UtcNow, true)],
        [new(actuatorId, "Pump", 1800, true)],
        [],
        new(true, "Clear", 10, 27, DateTime.UtcNow, null), [], true);

    private sealed class StubHandler(HttpResponseMessage response) : HttpMessageHandler
    {
        public string? ApiKey { get; private set; }
        public Uri? Uri { get; private set; }
        public string Body { get; private set; } = string.Empty;

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            ApiKey = request.Headers.GetValues("x-goog-api-key").Single();
            Uri = request.RequestUri;
            Body = await request.Content!.ReadAsStringAsync(cancellationToken);
            return response;
        }
    }
}
