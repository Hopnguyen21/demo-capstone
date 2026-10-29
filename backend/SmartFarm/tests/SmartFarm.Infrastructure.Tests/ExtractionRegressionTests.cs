using FluentAssertions;
using SmartFarm.Infrastructure.Ai.Knowledge;
using Xunit;

namespace SmartFarm.Infrastructure.Tests;

/// <summary>Lỗi thấy trên bài "Quy trình kỹ thuật SX cà chua an toàn" (Sở NN-MT Hưng Yên).</summary>
public class ExtractionRegressionTests
{
    private const string PhiSentence = "Đảm bảo thời gian cách ly với phân đạm urê ít nhất 7 - 10 ngày trước khi thu hoạch.";

    [Theory]
    [InlineData(7, true)]
    [InlineData(10, true)]
    [InlineData(8, false)]
    [InlineData(1, false)]
    public void Day_ranges_count_as_stated_days(int days, bool expected) =>
        VietGapStructuredExtractor.DaysStated(PhiSentence, days).Should().Be(expected);

    [Fact]
    public void Fertilizer_pre_harvest_interval_is_kept_when_quoted_as_a_range()
    {
        var result = VietGapStructuredExtractor.Verify(
            "{\"fields\": {\"fertilizerPreHarvestDays\": {\"value\": 7, \"evidence\": \"" + PhiSentence + "\"}}}",
            PhiSentence, "AI (test)", DateTime.UtcNow);

        result.Fields.Single(f => f.Key == "fertilizerPreHarvestDays").Value.Should().Be("7");
    }

    [Theory]
    [InlineData("cải cách hành chính (/chuyen-muc-cai-cach-hanh-chinh)", "cải", false)]
    [InlineData("cải thiện năng suất và cải tạo đất", "cải", false)]
    [InlineData("trồng cải ngọt và cải bắp vụ đông", "cải", true)]
    [InlineData("phân bón cho cây ớt chuông", "ớt", true)]
    [InlineData("phương pháp tốt nhất", "ớt", false)]
    public void Crop_tags_need_a_real_crop_mention(string text, string crop, bool expected) =>
        AgricultureDocumentService.CropMentioned(text, crop).Should().Be(expected);
}

public class DuplicateDetectionTests
{
    private static string Text(int n) => string.Join(' ', Enumerable.Range(0, n).Select(i => $"từ{i}"));

    [Fact]
    public void Small_edit_keeps_high_similarity() =>
        AgricultureDocumentService.Jaccard(
            AgricultureDocumentService.Shingles(Text(200)),
            AgricultureDocumentService.Shingles(Text(200) + " thêm một câu mới"))
        .Should().BeGreaterThan(AgricultureDocumentService.NearDuplicateThreshold);

    [Fact]
    public void Different_documents_are_not_near_duplicates() =>
        AgricultureDocumentService.Jaccard(
            AgricultureDocumentService.Shingles("Bón lót phân hữu cơ hoai mục trước khi trồng cà chua trên luống cao."),
            AgricultureDocumentService.Shingles("Thu hoạch dưa lưới khi vỏ chuyển màu, bảo quản nơi thoáng mát và sạch sẽ."))
        .Should().Be(0);
}

public class CropNameTests
{
    [Theory]
    [InlineData("Lettuce", "Xà lách")]
    [InlineData("Batavia", "Xà lách")]
    [InlineData("Xa lach", "Xà lách")]
    [InlineData("Cucumber", "Dưa leo")]
    [InlineData("Dưa chuột", "Dưa leo")]
    [InlineData("Capsicum", "Ớt chuông")]
    [InlineData("Ớt ngọt", "Ớt chuông")]
    [InlineData("Cà chua (Rau ăn quả)", "Cà chua")]
    [InlineData("Dau tay", "Dâu tây")]
    public void Aliases_map_to_one_crop(string raw, string expected) =>
        CropNames.Canonical(raw).Should().Be(expected);

    [Fact]
    public void Scope_matching_uses_canonical_names()
    {
        CropNames.ScopeIncludes("Cà chua, Lettuce, Cucumber", "Xà lách").Should().BeTrue();
        CropNames.ScopeIncludes("Cà chua, Lettuce, Cucumber", "Dâu tây").Should().BeFalse();
        // "Ớt" và "Ớt chuông" là hai cây khác nhau.
        CropNames.ScopeIncludes("Ớt", "Ớt chuông").Should().BeFalse();
    }
}
