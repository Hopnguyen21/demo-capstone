using SmartFarm.Infrastructure.Ai.Knowledge;
using Xunit;

namespace SmartFarm.Infrastructure.Tests;

public sealed class VietGapMetadataExtractorTests
{
    private const string TomatoSample = """
        QUY CHUẨN KỸ THUẬT CANH TÁC CÀ CHUA BEEFSTEAK NHÀ MÀNG THEO TIÊU CHUẨN VIETGAP
        Mã số tiêu chuẩn: TCVN 11892-1:2017
        Đơn vị ban hành: Viện Nghiên cứu Rau quả (FAVRI) - Bộ Nông nghiệp & PTNT
        Cây trồng áp dụng: Cà Chua Beefsteak (Lycopersicon esculentum)
        Thời hạn hiệu lực: 2024 - 2027

        1. ĐẤT, GIÁ THỂ VÀ NGUỒN NƯỚC:
        - Loại đất và giá thể: Xơ dừa đã khử chát
        """;

    [Fact]
    public void Reads_labelled_fields_from_file_content()
    {
        var m = VietGapMetadataExtractor.Extract(TomatoSample, "01_VietGAP_Ca_Chua.txt");

        Assert.Equal("QUY CHUẨN KỸ THUẬT CANH TÁC CÀ CHUA BEEFSTEAK NHÀ MÀNG THEO TIÊU CHUẨN VIETGAP", m.Title);
        Assert.Equal("Cà Chua Beefsteak", m.CropScope);
        Assert.Equal("TCVN 11892-1:2017", m.StandardCode);
        Assert.Equal("Viện Nghiên cứu Rau quả (FAVRI) - Bộ Nông nghiệp & PTNT", m.AuthorOrganization);
        Assert.Equal("2024 - 2027", m.Version);
        Assert.Equal("general", m.Category);
    }

    [Fact]
    public void Falls_back_to_crop_in_title_and_inline_standard_code()
    {
        const string text = """
            Quy trình sản xuất dưa lưới an toàn trong nhà màng
            Tài liệu tham chiếu TCVN 11892-1:2017 về thực hành nông nghiệp tốt.
            Nội dung kỹ thuật chi tiết.
            """;

        var m = VietGapMetadataExtractor.Extract(text, "quy_trinh.docx");

        Assert.Equal("Quy trình sản xuất dưa lưới an toàn trong nhà màng", m.Title);
        Assert.Equal("dưa lưới", m.CropScope);
        Assert.Equal("TCVN 11892-1:2017", m.StandardCode);
        Assert.Null(m.AuthorOrganization);
        Assert.Null(m.Version);
    }

    [Fact]
    public void Skips_ocr_banner_and_page_marker_when_choosing_title()
    {
        const string text = """
            [OCR bằng AI từ PDF scan — cần đối chiếu bản gốc]

            [TRANG 1]
            HƯỚNG DẪN VIETGAP CHO XÀ LÁCH THỦY CANH
            """;

        var m = VietGapMetadataExtractor.Extract(text, "scan.pdf");

        Assert.Equal("HƯỚNG DẪN VIETGAP CHO XÀ LÁCH THỦY CANH", m.Title);
        Assert.Equal("xà lách", m.CropScope);
    }

    [Fact]
    public void Skips_web_page_chrome_and_reads_organization_from_footer()
    {
        // Bản in trang web khuyến nông đã OCR: logo, menu và ngày giờ đứng trước tiêu đề bài viết.
        const string text = """
            [OCR bằng AI từ PDF scan — cần đối chiếu bản gốc]

            [TRANG 1]
            Thứ Tư - Ngày 28/10/2026 - 11:20:47pm
            Khuyến
            nông Hà Tĩnh
            Ở đâu có nông dân, ở đó có khuyến nông
            GIỚI THIỆU |
            >> CẨM NANG KỸ THUẬT | TRỒNG TRỌT
            Kỹ thuật trồng cà chua theo tiêu chuẩn Vietgap
            Tin đăng ngày: 17/12/2025 - Xem: 864
            1. Thời vụ cà chua:
            TRUNG TÂM KHUYÊN NÔNG HÀ TĨNH
            7. Thu hoạch:
            Trung tâm Khuyến nông Hà Tĩnh
            Địa chỉ: Số 150 đường Trần Phú, TP Hà Tĩnh, tỉnh Hà Tĩnh
            """;

        var m = VietGapMetadataExtractor.Extract(text, "scan.pdf");

        Assert.Equal("Kỹ thuật trồng cà chua theo tiêu chuẩn Vietgap", m.Title);
        Assert.Equal("Trung tâm Khuyến nông Hà Tĩnh", m.AuthorOrganization);
        Assert.Equal("cà chua", m.CropScope);
    }

    [Fact]
    public void Uses_file_name_when_content_has_no_title_line()
    {
        var m = VietGapMetadataExtractor.Extract("Mã số: 01\nNgày: 12", "Quy_trinh_ot_chuong.pdf");

        Assert.Equal("Quy trinh ot chuong", m.Title);
        Assert.Equal("ớt", m.CropScope); // tên file nêu cây (nhận diện theo tên file, xem VietGapMetadataExtractor)
    }
}
