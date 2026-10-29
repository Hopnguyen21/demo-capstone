using FluentAssertions;
using SmartFarm.Domain.Entities;
using SmartFarm.Infrastructure.Ai.Knowledge;
using Xunit;

namespace SmartFarm.Infrastructure.Tests;

/// <summary>
/// Mỗi tài liệu là một nguồn RAG riêng: chỉ bắt buộc nguồn truy vết được, mã tiêu chuẩn (nếu là tiêu chuẩn chính thức)
/// và nội dung của các chủ đề đã khai báo. Dùng toàn văn thật "Quy trình kỹ thuật SX cà chua an toàn" (Sở NN-MT Hưng Yên):
/// có đất, phân bón, sâu bệnh, thu hoạch; không có mã TCVN, nguồn nước tưới hay truy xuất nguồn gốc.
/// </summary>
public class DocumentTypeRequirementsTests
{
    private static readonly string HungYenGuide =
        File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "TestData", "so_nn_hung_yen_ca_chua_an_toan.txt"));

    private static IEnumerable<string> Missing(AgricultureDocumentType type, string topics, bool hasSource) =>
        VietGapCompletenessChecker.MissingCritical(HungYenGuide, type, topics, hasSource).Select(c => c.Key);

    [Fact]
    public void Guide_with_publisher_and_covered_topics_passes() =>
        Missing(AgricultureDocumentType.TechnicalGuide, "soil,nutrition,pest,harvest", hasSource: true).Should().BeEmpty();

    [Fact]
    public void Topic_document_does_not_need_every_vietgap_section() =>
        Missing(AgricultureDocumentType.Thematic, "pest", hasSource: true).Should().BeEmpty();

    [Fact]
    public void Declared_topic_without_content_is_reported() =>
        Missing(AgricultureDocumentType.Thematic, "irrigation,record", hasSource: true).Should().BeEquivalentTo(["water", "records"]);

    [Fact]
    public void Official_standard_still_needs_a_standard_code() =>
        Missing(AgricultureDocumentType.OfficialStandard, "pest", hasSource: true).Should().Equal("standard");

    [Fact]
    public void Every_document_needs_a_traceable_source() =>
        Missing(AgricultureDocumentType.TechnicalGuide, "", hasSource: false).Should().Equal("source");
}
