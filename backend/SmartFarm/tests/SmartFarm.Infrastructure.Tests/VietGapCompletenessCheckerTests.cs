using System.Text;
using FluentAssertions;
using SmartFarm.Infrastructure.Ai.Knowledge;
using Xunit;

namespace SmartFarm.Infrastructure.Tests;

public class VietGapCompletenessCheckerTests
{
    private const string FullDocument = """
        TCVN 11892-1:2017 Thực hành nông nghiệp tốt (VietGAP) - Phần 1: Trồng trọt. Ban hành năm 2017.
        Đánh giá vùng sản xuất và chất lượng đất trồng, giới hạn kim loại nặng.
        Nguồn nước tưới phải đạt QCVN về chất lượng nước.
        Phân bón và chất dinh dưỡng phải có nguồn gốc rõ ràng.
        Áp dụng IPM, sử dụng thuốc bảo vệ thực vật trong danh mục.
        Thu hoạch đúng thời gian cách ly; ghi chép nhật ký để truy xuất nguồn gốc.
        Giai đoạn cây con kéo dài 20 ngày; nhiệt độ 20-30°C, độ ẩm 70%, pH 6.0, EC 1.5.
        """;

    [Fact]
    public void Full_document_has_no_missing_critical_sections() =>
        VietGapCompletenessChecker.MissingCritical(FullDocument).Should().BeEmpty();

    [Fact]
    public void Topical_ipm_document_reports_missing_core_sections()
    {
        var missing = VietGapCompletenessChecker.MissingCritical(
            "Hướng dẫn quản lý dịch hại tổng hợp IPM trên cà chua, luân phiên thuốc bảo vệ thực vật.")
            .Select(c => c.Key);

        missing.Should().Contain(["standard", "soil", "water", "fertilizer", "harvest", "records"]);
        missing.Should().NotContain("ipm");
    }

    [Fact]
    public void Bare_mentions_of_tuoi_or_dat_do_not_count_as_sections()
    {
        var checks = VietGapCompletenessChecker.Check("Tưới đủ nước cho cây, đất ẩm là đạt yêu cầu.");
        checks.Single(c => c.Key == "water").Found.Should().BeFalse();
        checks.Single(c => c.Key == "soil").Found.Should().BeFalse();
    }

    [Fact]
    public void Decomposed_unicode_text_still_matches() =>
        VietGapCompletenessChecker.Check("Nguồn nước tưới sạch".Normalize(NormalizationForm.FormD))
            .Single(c => c.Key == "water").Found.Should().BeTrue();
}
