using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using SmartFarm.Domain.Entities;
using SmartFarm.Infrastructure.Ai;
using SmartFarm.Infrastructure.Ai.Knowledge;
using SmartFarm.Infrastructure.Persistence;
using Xunit;

namespace SmartFarm.Infrastructure.Tests;

public class CropNamesTests
{
    [Theory]
    [InlineData("Cà Chua Beefsteak (Tomato)", "Cà chua")]
    [InlineData("  ca   chua ", "Cà chua")]
    [InlineData("Ca Chua Chuong (Sweet Pepper)", "Ớt chuông")]
    [InlineData("Xà Lách Cuộn (Batavia Lettuce)", "Xà lách")]
    [InlineData("Dau Tay Hana (Strawberry)", "Dâu tây")]
    [InlineData("Dưa leo Baby VietGAP", "Dưa leo")]
    [InlineData("ớt chuông", "Ớt chuông")]
    [InlineData("ớt", "Ớt")]
    [InlineData("thanh long", "Thanh long")]
    public void Canonical_maps_catalog_and_aliases(string raw, string expected) =>
        CropNames.Canonical(raw).Should().Be(expected);

    [Fact]
    public void Scope_does_not_match_by_substring()
    {
        CropNames.ScopeIncludes("Ớt chuông", "ớt").Should().BeFalse();
        CropNames.ScopeIncludes("ớt", "Ớt chuông").Should().BeFalse();
        CropNames.ScopeIncludes("cà chua, ớt", "Cà Chua Beefsteak (Tomato)").Should().BeTrue();
    }

    [Fact]
    public void NormalizeScope_dedupes_case_and_diacritic_insensitive() =>
        CropNames.NormalizeScope("cà chua, Ca Chua ,tomato,  thanh   long").Should().Be("Cà chua, Thanh long");

    [Fact]
    public void MentionedIn_uses_whole_words_and_prefers_longest()
    {
        CropNames.MentionedIn("Khi nào thu hoạch cà chua?", []).Should().Be("Cà chua");
        CropNames.MentionedIn("Bón phân cho ớt chuông thế nào", []).Should().Be("Ớt chuông");
        CropNames.MentionedIn("Tưới nước bao nhiêu là đủ?", []).Should().BeNull();
    }
}

public class KnowledgeCropScopeRetrievalTests
{
    private static SmartFarmDbContext Db() =>
        new(new DbContextOptionsBuilder<SmartFarmDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    // Không có API key → không tạo embedding → đi đường keyword (vẫn cùng phạm vi tài liệu).
    private static AgricultureKnowledgeRetriever Retriever(SmartFarmDbContext db) =>
        new(db, new GeminiEmbeddingProvider(new HttpClient(), Options.Create(new GeminiEmbeddingOptions { ApiKey = "" }),
            NullLogger<GeminiEmbeddingProvider>.Instance), NullLogger<AgricultureKnowledgeRetriever>.Instance);

    private static AgricultureDocument Doc(SmartFarmDbContext db, string title, string scope, string content,
        AgricultureDocumentReviewStatus status = AgricultureDocumentReviewStatus.Approved)
    {
        var doc = new AgricultureDocument { Title = title, CropScope = CropNames.NormalizeScope(scope), ContentText = content, ReviewStatus = status, IsPublic = true };
        db.AgricultureDocuments.Add(doc);
        db.AgricultureKnowledgeChunks.Add(new AgricultureKnowledgeChunk { DocumentId = doc.Id, Document = doc, ChunkIndex = 0, Content = content, Keywords = "thu hoạch" });
        return doc;
    }

    private const string Harvest = "Thu hoạch quả khi chín 70-80% màu sắc đặc trưng, thu hoạch vào sáng sớm khi nhiệt độ thấp, dụng cụ thu hoạch và thùng chứa phải sạch, ghi chép ngày thu hoạch và lô sản phẩm để truy xuất.";

    [Fact]
    public async Task Tomato_harvest_question_uses_approved_tomato_sources_only()
    {
        await using var db = Db();
        var pending = Doc(db, "Thu hoạch cà chua (chờ duyệt)", "cà chua", Harvest, AgricultureDocumentReviewStatus.PendingReview);
        var a = Doc(db, "Hướng dẫn thu hoạch cà chua", "Cà Chua Beefsteak (Tomato)", Harvest);
        var b = Doc(db, "VietGAP cà chua", "cà chua, ớt", "Cà chua: " + Harvest);
        var lettuce = Doc(db, "Thu hoạch xà lách", "xà lách", Harvest);
        await db.SaveChangesAsync();

        var result = await Retriever(db).RetrievePassagesAsync("Khi nào thu hoạch cà chua?", "Cà Chua Beefsteak (Tomato)", null, null, 5, true, default);

        result.Select(p => p.DocumentId).Should().Contain([a.Id, b.Id]).And.NotContain([pending.Id, lettuce.Id]);
    }

    [Fact]
    public async Task Lettuce_question_excludes_tomato_specific_but_allows_general()
    {
        await using var db = Db();
        var tomato = Doc(db, "Thu hoạch cà chua", "cà chua", Harvest);
        var general = Doc(db, "Quy định chung VietGAP", "", Harvest);
        await db.SaveChangesAsync();

        var result = await Retriever(db).RetrievePassagesAsync("Thu hoạch xà lách thế nào?", "xà lách", null, null, 5, true, default);

        result.Select(p => p.DocumentId).Should().Contain(general.Id).And.NotContain(tomato.Id);
    }

    [Fact]
    public async Task Unknown_crop_uses_general_documents_only()
    {
        await using var db = Db();
        var tomato = Doc(db, "Thu hoạch cà chua", "cà chua", Harvest);
        var general = Doc(db, "Quy định chung VietGAP", "", Harvest);
        await db.SaveChangesAsync();

        var result = await Retriever(db).RetrievePassagesAsync("Thu hoạch thế nào?", null, null, null, 5, true, default);

        result.Select(p => p.DocumentId).Should().Equal(general.Id);
        result.Should().NotContain(p => p.DocumentId == tomato.Id);
    }

    [Fact]
    public async Task Weak_keyword_match_and_metadata_only_chunks_are_not_returned()
    {
        await using var db = Db();
        Doc(db, "Vi khí hậu nhà màng", "dưa leo", "Quản lý vi khí hậu và thông gió nhà màng.\nTrạng thái tài liệu: Đã kiểm định & Áp dụng RAG\nThẩm định: Viện Khoa học Nông nghiệp Việt Nam (VAAS)");
        Doc(db, "Dưa leo tổng hợp", "dưa leo", "Giai đoạn thân lá cần bón phân cân đối đạm lân kali, tưới đủ ẩm và tỉa nhánh để thông thoáng tán lá, theo dõi sâu bệnh hằng tuần trên toàn bộ luống trồng.");
        await db.SaveChangesAsync();

        var result = await Retriever(db).RetrievePassagesAsync(
            "Nhiệt độ hiện tại có an toàn cho cây dưa leo ở giai đoạn thân lá và nên chăm sóc thế nào cho đúng quy trình?", "dưa leo", null, null, 5, true, default);

        Assert.DoesNotContain(result, p => p.DocumentTitle == "Vi khí hậu nhà màng");
    }

    [Theory]
    [InlineData("Quản lý vi khí hậu và thông gió nhà màng.\nTrạng thái tài liệu: Đã kiểm định\nThẩm định: VAAS", false)]
    [InlineData("", false)]
    [InlineData(Harvest, true)]
    public void IsSubstantive_requires_real_content(string content, bool expected) =>
        AgricultureKnowledgeRetriever.IsSubstantive(content).Should().Be(expected);
}
