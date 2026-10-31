using FluentAssertions;
using SmartFarm.Infrastructure.Ai.Knowledge;
using Xunit;

namespace SmartFarm.Infrastructure.Tests;

/// <summary>Bản in trang web "Quy trình kỹ thuật SX cà chua an toàn" (Sở NN-MT Hưng Yên): lọc rác trang web, nhận diện đơn vị đăng tải.</summary>
public class PortalChromeTests
{
    private static readonly string Source =
        File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "TestData", "so_nn_hung_yen_ca_chua_an_toan.txt"));

    [Theory]
    [InlineData("Địa chỉ")]
    [InlineData("sonnmt@hungyen")]
    [InlineData("mailto:")]
    [InlineData("duong-day-")]
    [InlineData("Cải cách Hành")]
    [InlineData("Quyết định công")]
    [InlineData("Zalo")]
    [InlineData("Kế hoạch tổ chức Hội thi")]
    [InlineData("AllThuTuc")]
    [InlineData("url=https")]
    public void Portal_chrome_is_removed_from_chunks_and_from_cleaned_text(string noise)
    {
        StructuredChunker.Chunk(Source).Should().NotContain(c => c.Content.Contains(noise, StringComparison.OrdinalIgnoreCase));
        StructuredChunker.CleanedText(Source).Should().NotContain(noise);
    }

    [Fact]
    public void Cleaned_text_keeps_the_article_and_its_page_markers()
    {
        var cleaned = StructuredChunker.CleanedText(Source);

        cleaned.Should().Contain("[TRANG 2]").And.Contain("[TRANG 3]");
        cleaned.Should().Contain("Đất phù hợp để SX cà chua").And.Contain("cách ly với phân đạm urê");
    }

    [Fact]
    public void Publisher_comes_from_the_source_attribution_and_wrapped_title_is_joined()
    {
        var d = VietGapMetadataExtractor.Detect(Source, "scan.pdf");

        d.Title.Value.Should().Be("Quy trình kỹ thuật SX cà chua an toàn");
        d.Publisher.Status.Should().Be("detected");
        d.Publisher.Value.Should().Be("Sở Nông Nghiệp và Môi Trường Tỉnh Hưng Yên");
        d.Publisher.Evidence!.Quote.Should().Contain("Ghi rõ nguồn");
    }
}
