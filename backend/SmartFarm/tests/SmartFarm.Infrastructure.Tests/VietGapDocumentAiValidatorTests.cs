using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using SmartFarm.Domain.Entities;
using SmartFarm.Infrastructure.Ai;
using SmartFarm.Infrastructure.Ai.Knowledge;
using Xunit;

namespace SmartFarm.Infrastructure.Tests;

public class VietGapDocumentAiValidatorTests
{
    [Fact]
    public void Sufficient_verdict_is_accepted() =>
        VietGapDocumentAiValidator.ParseVerdict(
            """{"isSufficient": true, "documentType": "quy chuẩn", "missingRequirements": [], "issues": [], "summary": "Đủ."}""", "AI")
            .IsSufficient.Should().BeTrue();

    [Fact]
    public void Sufficient_claim_with_missing_items_is_rejected()
    {
        var result = VietGapDocumentAiValidator.ParseVerdict(
            """{"isSufficient": true, "missingRequirements": ["Thiếu thời gian cách ly"], "summary": ""}""", "AI");

        result.IsSufficient.Should().BeFalse();
        result.MissingRequirements.Should().ContainSingle("Thiếu thời gian cách ly");
    }

    [Theory]
    [InlineData("""{"summary": "không có trường isSufficient"}""")]
    [InlineData("""{"isSufficient": "true"}""")]
    public void Missing_or_non_boolean_verdict_is_treated_as_insufficient(string json) =>
        VietGapDocumentAiValidator.ParseVerdict(json, "AI").IsSufficient.Should().BeFalse();

    [Fact]
    public void Fenced_json_is_parsed() =>
        VietGapDocumentAiValidator.ParseVerdict("```json\n{\"isSufficient\": true}\n```", "AI")
            .IsSufficient.Should().BeTrue();

    [Fact]
    public async Task Document_missing_core_sections_is_rejected_without_calling_ai()
    {
        // Không cấu hình API key: nếu validator gọi AI sẽ ném lỗi "không xác minh được" thay vì trả kết quả.
        var validator = new VietGapDocumentAiValidator(new HttpClient(), Options.Create(new GeminiOptions()),
            NullLogger<VietGapDocumentAiValidator>.Instance);

        var result = await validator.ValidateAsync("Kỹ thuật trồng cà chua: cày đất, bón phân hữu cơ, thu hoạch khi quả chín.",
            new(AgricultureDocumentType.OfficialStandard, "general", HasSource: false), default);

        result.IsSufficient.Should().BeFalse();
        result.VerifiedBy.Should().Be("checklist");
        result.MissingRequirements.Should().NotBeEmpty();
    }
}
