using FluentAssertions;
using SmartFarm.Infrastructure.Ai.Knowledge;
using Xunit;

namespace SmartFarm.Infrastructure.Tests;

/// <summary>
/// Dùng toàn văn OCR thật của bài "Kỹ thuật trồng cà chua theo tiêu chuẩn Vietgap" (Khuyến nông Hà Tĩnh):
/// bản in trang web, có lẫn menu/sidebar, xuống dòng giữa câu, 2 trang.
/// </summary>
public class VietGapStructuredExtractorTests
{
    private static readonly string Source =
        File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "TestData", "khuyen_nong_ha_tinh_ca_chua.txt"));

    private static VietGapExtractedFieldLookup Run(string json) =>
        new(VietGapStructuredExtractor.Verify(json, Source, "AI (test)", DateTime.UtcNow));

    [Fact]
    public void Quote_spanning_an_ocr_line_break_is_accepted_and_shown_verbatim()
    {
        // Câu này bị xuống dòng sau "+" trong OCR; AI viết lại value nhưng hệ thống hiển thị câu trích nguyên văn.
        var result = Run("""
            {"fields": {"organicRequirements": {"value": "Bón lót toàn bộ phân hữu cơ",
              "evidence": "+ Bón lót: Toàn bộ phân hữu cơ + toàn bộ phân hữu cơ sinh học + toàn bộ phân vi lượng + toàn bộ phân supe lân + 5kg NPK 16-16-8"}}}
            """);

        var field = result["organicRequirements"];
        field.Value.Should().StartWith("+ Bón lót: Toàn bộ phân hữu cơ").And.EndWith("5kg NPK 16-16-8");
        field.Page.Should().Be(1);
    }

    [Fact]
    public void Fabricated_quote_is_discarded()
    {
        // Bài không hề có IPM: AI bịa trích dẫn thì trường phải trống.
        var result = Run("""
            {"fields": {"ipmPrinciples": {"value": "Dùng bẫy dính vàng", "evidence": "Sử dụng bẫy dính vàng và thiên địch để phòng trừ sâu hại."}}}
            """);

        result["ipmPrinciples"].Value.Should().BeNull();
        result["ipmPrinciples"].Evidence.Should().BeNull();
    }

    [Fact]
    public void Days_not_stated_in_the_quote_are_discarded()
    {
        // Câu trích có thật nhưng không nói "7 ngày" — không được nhận là thời gian cách ly.
        var result = Run("""
            {"fields": {"pesticidePreHarvestDays": {"value": 7, "evidence": "Thu hoạch khi cà chua chuyển sang màu vàng hoặc đỏ"}}}
            """);

        result["pesticidePreHarvestDays"].Value.Should().BeNull();
    }

    [Fact]
    public void Range_numbers_must_appear_in_the_quote_and_page_comes_from_markers()
    {
        var result = Run("""
            {"fields": {
              "tempOptimal": {"value": "40-50 độ C", "evidence": "ngâm hạt trong nước có nhiệt độ 40-50 độ C"},
              "ecOptimal": {"value": "1.5-2.5 mS/cm", "evidence": "ngâm hạt trong nước có nhiệt độ 40-50 độ C"},
              "harvestToolsStandard": {"value": "x", "evidence": "Thu hoạch khi cà chua chuyển sang màu vàng hoặc đỏ"}}}
            """);

        result["tempOptimal"].Value.Should().Be("40-50 độ C");
        result["ecOptimal"].Value.Should().BeNull();
        result["harvestToolsStandard"].Page.Should().Be(2);
    }

    [Fact]
    public void Stage_must_be_named_in_its_own_quote()
    {
        var result = VietGapStructuredExtractor.Verify("""
            {"fields": {}, "stages": [
              {"name": "Cây con", "durationDays": 30, "evidence": "khi cây đã có 5-6 lá, ta có thể đem trồng"},
              {"name": "Bón thúc lần 1", "durationDays": 15, "evidence": "Bón thúc lần 1: (10-15 ngày sau khi trồng)"}]}
            """, Source, "AI (test)", DateTime.UtcNow);

        result.Stages.Should().ContainSingle().Which.Name.Should().Be("Bón thúc lần 1");
        result.Stages[0].DurationDays.Should().Be(15);
    }

    [Fact]
    public void Every_template_field_is_present_even_when_ai_returns_nothing() =>
        VietGapStructuredExtractor.Verify("{}", Source, "AI (test)", DateTime.UtcNow).Fields
            .Should().HaveCount(VietGapStructuredExtractor.Template.Length)
            .And.OnlyContain(f => f.Value == null);

    private sealed class VietGapExtractedFieldLookup(SmartFarm.Application.Common.Interfaces.VietGapStructuredExtraction extraction)
    {
        public SmartFarm.Application.Common.Interfaces.VietGapExtractedField this[string key] =>
            extraction.Fields.Single(f => f.Key == key);
    }
}
