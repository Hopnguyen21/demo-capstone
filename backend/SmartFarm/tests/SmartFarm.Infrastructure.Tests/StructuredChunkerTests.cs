using FluentAssertions;
using SmartFarm.Infrastructure.Ai.Knowledge;
using Xunit;

namespace SmartFarm.Infrastructure.Tests;

/// <summary>Chia đoạn theo cấu trúc trên hai bản in trang web thật đã trích chữ (có menu, sidebar, 2–5 trang).</summary>
public class StructuredChunkerTests
{
    private static string Fixture(string name) => File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "TestData", name));

    private static readonly IReadOnlyList<ChunkPiece> HaTinh = StructuredChunker.Chunk(Fixture("khuyen_nong_ha_tinh_ca_chua.txt"));
    private static readonly IReadOnlyList<ChunkPiece> HungYen = StructuredChunker.Chunk(Fixture("so_nn_hung_yen_ca_chua_an_toan.txt"));

    [Fact]
    public void Numbered_sections_become_section_titles()
    {
        HaTinh.Select(c => c.SectionTitle).Should().Contain(["2. Yêu cầu làm đất", "5. Phân bón cho cây cà chua", "7. Thu hoạch"]);
    }

    [Fact]
    public void Harvest_chunk_is_on_page_two_and_stops_before_related_news()
    {
        var harvest = HaTinh.Single(c => c.SectionTitle == "7. Thu hoạch");

        harvest.PageNumber.Should().Be(2);
        harvest.Content.Should().Contain("Thu hoạch khi cà chua chuyển sang màu vàng hoặc đỏ");
        harvest.Content.Should().NotContain("Trồng trọt khác").And.NotContain("phòng trừ sâu bệnh hại lúa");
    }

    [Fact]
    public void Section_continued_on_next_page_keeps_its_title()
    {
        // "Bón thúc lần 4" nằm đầu trang 2 nhưng vẫn thuộc mục 5 (Phân bón).
        HaTinh.Should().Contain(c => c.SectionTitle == "5. Phân bón cho cây cà chua" && c.Content.Contains("Bón thúc lần 4"));
    }

    [Theory]
    [InlineData("THỐNG KÊ TRUY CẬP")]
    [InlineData("Khách viếng thăm")]
    [InlineData("FANPAGE FACEBOOK")]
    [InlineData("GIỚI THIỆU |")]
    [InlineData("VIDEO CLIPS")]
    public void Web_page_chrome_is_not_indexed(string noise) =>
        HaTinh.Concat(HungYen).Should().NotContain(c => c.Content.Contains(noise, StringComparison.OrdinalIgnoreCase));

    [Fact]
    public void Article_content_without_headings_is_kept_with_pages()
    {
        HungYen.Should().Contain(c => c.Content.Contains("Đất phù hợp để SX cà chua") && c.PageNumber == 2);
        HungYen.Should().Contain(c => c.Content.Contains("cách ly với phân đạm urê") && c.PageNumber == 3);
        HungYen.Should().NotContain(c => c.Content.Contains("(https://"));
    }

    [Fact]
    public void Chunks_respect_the_size_limit() =>
        HaTinh.Concat(HungYen).Should().OnlyContain(c => c.Content.Length <= StructuredChunker.MaxChars + StructuredChunker.OverlapChars);

    [Fact]
    public void Plain_text_without_markers_still_chunks() =>
        StructuredChunker.Chunk(new string('a', 50) + " bón phân hữu cơ hoai mục cho cà chua.")
            .Should().ContainSingle().Which.PageNumber.Should().BeNull();
}
