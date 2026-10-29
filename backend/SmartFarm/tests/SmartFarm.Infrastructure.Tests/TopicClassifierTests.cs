using FluentAssertions;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Infrastructure.Ai.Knowledge;
using Xunit;

namespace SmartFarm.Infrastructure.Tests;

public class TopicClassifierTests
{
    [Theory]
    [InlineData("7. Thu hoạch", "Thu hoạch khi quả chín đỏ.", "harvest")]
    [InlineData("5. Phân bón cho cây cà chua", "Bón lót phân hữu cơ hoai mục.", "nutrition")]
    [InlineData(null, "Phòng trừ sâu khoang bằng bẫy pheromone, theo dõi bệnh héo xanh.", "pest")]
    [InlineData(null, "Cày đất, lên luống cao 30 cm.", "soil")]
    [InlineData(null, "Giới thiệu chung về dự án.", "general")]
    public void Chunk_topic_prefers_section_title_then_content(string? title, string content, string expected) =>
        TopicClassifier.ClassifyChunk(title, content).Should().Be(expected);

    [Fact]
    public void Question_topics_are_detected() =>
        TopicClassifier.ClassifyQuestion("Cà chua bị sâu đục quả thì phun thuốc gì, cách ly mấy ngày trước khi thu hoạch?")
            .Should().Contain(["pest", "harvest"]);

    [Fact]
    public void Topics_are_normalized() =>
        TopicClassifier.NormalizeTopics(["Pest", "general", "pest,harvest", "unknown"]).Should().Be("pest,harvest");

    [Fact]
    public void Content_hash_ignores_whitespace_case_and_unicode_form() =>
        TopicClassifier.ContentHash("Bón Phân  hữu cơ\n").Should().Be(TopicClassifier.ContentHash("bón phân hữu cơ".Normalize(System.Text.NormalizationForm.FormD)));

    [Fact]
    public void Profile_quotes_are_attributed_to_their_source_document()
    {
        var bundle = new CropSourceBundle("…", [
            new(Guid.NewGuid(), "Hướng dẫn bón phân cà chua", null, "Bón thúc lần 1: 10-15 ngày sau khi trồng."),
            new(Guid.NewGuid(), "Quy trình thu hoạch cà chua", null, "Thu hoạch khi quả chuyển màu đỏ.")
        ]);
        var draft = new VietGapGrowthProfileDraftResult("P", "D", 15, [
            new GrowthStageDraft(1, "Cây con", 15, "10-15 ngày sau khi trồng", "", "", "", "", "", "", [])
        ]);

        var attributed = AgricultureDocumentService.AttributeSources(draft, bundle);

        attributed.Stages[0].DurationEvidence.Should().EndWith("[Nguồn: Hướng dẫn bón phân cà chua]");
        attributed.SourceDocuments.Should().Equal("Hướng dẫn bón phân cà chua", "Quy trình thu hoạch cà chua");
    }
}
