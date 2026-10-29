using System.Text.RegularExpressions;

namespace SmartFarm.Infrastructure.Ai.Knowledge;

/// <summary>Thông tin mô tả tài liệu được đọc trực tiếp từ nội dung file VietGAP.</summary>
public sealed record VietGapDocumentMetadata(
    string Title,
    string CropScope,
    string? StandardCode,
    string? AuthorOrganization,
    string? Version,
    string Category);

/// <summary>
/// Tự lấy tiêu đề, cây trồng, mã tiêu chuẩn, đơn vị ban hành và phiên bản từ toàn văn tài liệu
/// để admin chỉ cần chọn file khi thêm tài liệu VietGAP. Chỉ đọc những gì có trong file, không suy đoán.
/// </summary>
public static class VietGapMetadataExtractor
{
    private const RegexOptions Opts = RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.Multiline;

    private static readonly string[] KnownCrops =
    [
        "cà chua", "dưa leo", "dưa chuột", "dưa lưới", "dâu tây", "xà lách", "rau muống", "cải bắp", "cải ngọt",
        "cải", "ớt chuông", "ớt", "bắp cải", "súp lơ", "đậu bắp", "bí đỏ", "khổ qua", "mướp đắng", "hành lá",
        "lúa", "cà phê", "hồ tiêu", "thanh long", "xoài", "sầu riêng", "bưởi", "chè"
    ];

    private static readonly Regex CropLine = new(
        @"^\s*[-•*]?\s*(?:cây trồng áp dụng|cây trồng|đối tượng cây trồng|đối tượng áp dụng|áp dụng cho cây|áp dụng cho)\s*[:：]\s*(?<v>.+)$", Opts);
    private static readonly Regex CodeLine = new(
        @"^\s*[-•*]?\s*(?:mã số tiêu chuẩn|mã tiêu chuẩn|mã quy chuẩn|số hiệu tiêu chuẩn|tiêu chuẩn áp dụng)\s*[:：]\s*(?<v>.+)$", Opts);
    private static readonly Regex CodeInline = new(
        @"\b(?:TCVN|QCVN)\s*[\d\-]+(?:\s*[-:]\s*[\d]+)*(?::\d{4})?(?:/[A-ZĐ]+)?", Opts);
    private static readonly Regex AuthorLine = new(
        @"^\s*[-•*]?\s*(?:đơn vị ban hành|cơ quan ban hành|ban hành bởi|cơ quan thẩm định|tổ chức ban hành|đơn vị biên soạn)\s*[:：]\s*(?<v>.+)$", Opts);
    private static readonly Regex VersionLine = new(
        @"^\s*[-•*]?\s*(?:phiên bản|version|lần ban hành|thời hạn hiệu lực|năm ban hành)\s*[:：]\s*(?<v>.+)$", Opts);

    public static VietGapDocumentMetadata Extract(string text, string? fileName)
    {
        text ??= string.Empty;
        var normalized = text.Replace("\r\n", "\n").Replace('\r', '\n');

        var title = FirstMeaningfulLine(normalized) ?? FileNameTitle(fileName);
        var crop = Clean(CropLine.Match(normalized).Groups["v"].Value, 500, stripParentheses: true);
        if (string.IsNullOrEmpty(crop)) crop = DetectCrop(title + "\n" + normalized);

        var code = Clean(CodeLine.Match(normalized).Groups["v"].Value, 100);
        if (string.IsNullOrEmpty(code))
        {
            var inline = CodeInline.Match(normalized);
            if (inline.Success) code = Clean(inline.Value, 100);
        }

        var author = Clean(AuthorLine.Match(normalized).Groups["v"].Value, 200);
        if (string.IsNullOrEmpty(author)) author = FindOrganization(normalized);
        var version = Clean(VersionLine.Match(normalized).Groups["v"].Value, 50);

        return new VietGapDocumentMetadata(
            Truncate(title, 300),
            crop,
            string.IsNullOrEmpty(code) ? null : code,
            string.IsNullOrEmpty(author) ? null : author,
            string.IsNullOrEmpty(version) ? null : version,
            "general");
    }

    // Dòng tên tài liệu kỹ thuật thường chứa một trong các cụm này.
    private static readonly Regex TitleKeywords = new(
        @"kỹ thuật|quy trình|hướng dẫn|tiêu chuẩn|quy chuẩn|viet\s?gap|thực hành nông nghiệp", Opts);

    // Phần khung của trang web in ra PDF (menu, ngày giờ, lượt xem...) không phải tiêu đề.
    private static readonly Regex WebChromeLine = new(
        @"\||^>>|^(?:thứ\s+\S+|chủ nhật)\s*-|tin đăng|lượt xem|\bxem:\s*\d|^bản in$|^tìm kiếm$|^chia sẻ$|^\d+\s*/\s*\d+$", Opts);

    private static string? FirstMeaningfulLine(string text)
    {
        string? firstCandidate = null;
        foreach (var raw in text.Split('\n').Take(40))
        {
            var line = raw.Trim().Trim('#', '*', '=', '-', '_', ' ').Trim();
            if (line.StartsWith("[OCR bằng AI", StringComparison.OrdinalIgnoreCase)) continue;
            if (Regex.IsMatch(line, @"^\[?TRANG\s*\d+\]?$", Opts)) continue;
            if (line.Length < 8 || !line.Any(char.IsLetter)) continue;
            if (WebChromeLine.IsMatch(line)) continue;
            // Bỏ qua dòng dạng "Nhãn: giá trị" (mã số, đơn vị...) để tiêu đề là dòng tên tài liệu.
            if (Regex.IsMatch(line, @"^[^:：]{1,40}[:：]\s*\S")) continue;
            // Mục đánh số ("1. Thời vụ:") là nội dung, không phải tiêu đề.
            if (Regex.IsMatch(line, @"^(?:\d{1,2}|[IVX]{1,4})[.)]\s")) continue;
            if (line.Length <= 200 && TitleKeywords.IsMatch(line)) return line;
            firstCandidate ??= line;
        }
        return firstCandidate;
    }

    // Tên cơ quan nông nghiệp thường gặp; phần địa danh viết hoa chữ cái đầu, không vượt qua xuống dòng.
    private static readonly Regex OrganizationName = new(
        @"(?:Trung tâm Khuyến nông|Chi cục Trồng trọt và Bảo vệ thực vật|Chi cục Bảo vệ thực vật|Sở Nông nghiệp(?: và (?:Phát triển nông thôn|Môi trường))?|Cục Trồng trọt|Cục Bảo vệ thực vật|Bộ Nông nghiệp(?: và (?:Phát triển nông thôn|Môi trường))?|Viện (?:Khoa học|Nghiên cứu|Cây)[^\n,.;]{0,60})(?:[ \t]+(?:tỉnh|thành phố|TP\.?)?[ \t]*(?:\p{Lu}\p{Ll}+)(?:[ \t]+\p{Lu}\p{Ll}+){0,2})?",
        RegexOptions.CultureInvariant);

    private static string FindOrganization(string text)
    {
        var match = OrganizationName.Match(text);
        return match.Success ? Clean(match.Value, 200) : string.Empty;
    }

    private static string FileNameTitle(string? fileName)
    {
        var name = Path.GetFileNameWithoutExtension(fileName ?? string.Empty);
        name = Regex.Replace(name, @"[_\-]+", " ").Trim();
        return name.Length >= 3 ? name : "Tài liệu VietGAP";
    }

    private static string DetectCrop(string text)
    {
        var lower = text.ToLowerInvariant();
        // Chọn cây xuất hiện đầu tiên trong văn bản (thường là tiêu đề); ưu tiên tên dài ("ớt chuông" trước "ớt").
        return KnownCrops
            .Select(crop => (crop, index: lower.IndexOf(crop, StringComparison.Ordinal)))
            .Where(x => x.index >= 0)
            .OrderBy(x => x.index).ThenByDescending(x => x.crop.Length)
            .Select(x => x.crop)
            .FirstOrDefault() ?? string.Empty;
    }

    private static string Clean(string value, int max, bool stripParentheses = false)
    {
        var result = value.Trim().TrimEnd('.', ';', ',').Trim();
        if (stripParentheses) result = Regex.Replace(result, @"\s*\([^)]*\)", string.Empty).Trim();
        return Truncate(result, max);
    }

    private static string Truncate(string value, int max) => value.Length <= max ? value : value[..max].Trim();
}
