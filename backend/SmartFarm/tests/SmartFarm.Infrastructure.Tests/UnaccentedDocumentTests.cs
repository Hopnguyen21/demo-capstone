using FluentAssertions;
using SmartFarm.Domain.Entities;
using SmartFarm.Infrastructure.Ai.Knowledge;
using Xunit;

namespace SmartFarm.Infrastructure.Tests;

/// <summary>Tài liệu gõ không dấu: "Quy trình kỹ thuật canh tác dâu tây Hana VietGAP (soil beds)".</summary>
public class UnaccentedDocumentTests
{
    private const string Strawberry = """
        QUY TRINH KY THUAT CANH TAC DAU TAY HANA VIETGAP (SOIL BEDS)
        2. THO NHUONG: Dat thit nhe, toi xop giau mun, pH 5.8 - 6.5, EC 1.0 - 1.5 mS/cm, do am dat 60 - 75%.
        3. GIAI DOAN CAY CON BEN RE (1 - 20 ngay):
        - Nhiet do: 16.0 - 24.0 C, Do am dat: 70 - 80%, Do am khong khi: 70 - 80%.
        4. GIAI DOAN PHAT TRIEN THAN LA VA NGO (21 - 50 ngay):
        - Nhiet do: 18.0 - 25.0 C, Do am dat: 65 - 75%, EC nuoc tuoi 1.2 mS/cm.
        5. GIAI DOAN RA HOA VA DAU TRAI (51 - 85 ngay):
        - Tranh tuoi phun mua len chum hoa de phong benh moc xam Botrytis.
        6. GIAI DOAN THU HOACH (86 - 120 ngay):
        - Thoi gian cach ly truoc thu hoach (PHI): Toi thieu 7 ngay.
        7. THU HOACH VA DONG GOI: Thu hai bang keo cat cuong, dong hop dan tem QR VietGAP.
        """;

    [Theory]
    [InlineData("3. GIAI DOAN CAY CON BEN RE (1 - 20 ngay):", 20)]
    [InlineData("4. GIAI DOAN PHAT TRIEN THAN LA VA NGO (21 - 50 ngay):", 30)]
    [InlineData("6. GIAI DOAN THU HOACH (86 - 120 ngay):", 35)]
    [InlineData("Thoi gian cach ly truoc thu hoach (PHI): Toi thieu 7 ngay.", 7)]
    public void Unaccented_days_and_stage_spans_are_recognised(string evidence, int days) =>
        VietnameseText.DaysStated(evidence, days).Should().BeTrue();

    [Fact]
    public void Wrong_duration_is_still_rejected() =>
        VietnameseText.DaysStated("4. GIAI DOAN PHAT TRIEN THAN LA VA NGO (21 - 50 ngay):", 25).Should().BeFalse();

    [Fact]
    public void Checklist_reads_unaccented_text()
    {
        var found = VietGapCompletenessChecker.Check(Strawberry).Where(c => c.Found).Select(c => c.Key);
        found.Should().Contain(["standard", "soil", "harvest", "environment", "stages"]);
    }

    [Fact]
    public void Topics_are_classified_on_unaccented_text()
    {
        TopicClassifier.ClassifyChunk("6. GIAI DOAN THU HOACH (86 - 120 ngay)", "Thoi gian cach ly truoc thu hoach").Should().Be("harvest");
        TopicClassifier.ClassifyQuestion("dau tay bi benh moc xam thi xu ly the nao").Should().Contain("pest");
    }

    [Theory]
    [InlineData("Sau khi trồng 10 ngày thì tỉa lá.", "pest")]
    [InlineData("Năm 2026 áp dụng quy trình mới.", "pest")]
    [InlineData("Đảm bảo đủ ánh sáng cho cây.", "nutrition")]
    [InlineData("Cây giống 20 ngày tuổi đem trồng.", "irrigation")]
    public void Folding_does_not_create_false_topics(string text, string notTopic) =>
        TopicClassifier.ClassifyQuestion(text).Should().NotContain(notTopic);
}
