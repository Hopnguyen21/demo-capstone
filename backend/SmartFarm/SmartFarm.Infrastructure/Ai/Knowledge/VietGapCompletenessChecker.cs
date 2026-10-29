using System.Text;
using System.Text.RegularExpressions;
using SmartFarm.Domain.Entities;

namespace SmartFarm.Infrastructure.Ai.Knowledge;

/// <summary>Kết quả kiểm tra một mục nội dung VietGAP.</summary>
public sealed record VietGapCompletenessCheck(string Key, string Label, bool IsCritical, bool Found);

/// <summary>
/// Kiểm tra độ đầy đủ của toàn văn tài liệu VietGAP theo các mục chính của quy trình.
/// Chỉ phát hiện mục còn thiếu để người duyệt xem lại; không chứng minh nội dung đúng.
/// Quy tắc phải giữ đồng bộ với frontend/src/pages/admin/vietGapCompleteness.ts.
/// </summary>
public static class VietGapCompletenessChecker
{
    private const RegexOptions Opts = RegexOptions.IgnoreCase | RegexOptions.CultureInvariant;

    private static readonly (string Key, string Label, bool Critical, Regex[] AllOf)[] Rules =
    [
        ("standard", "Mã tiêu chuẩn (TCVN / QCVN / VietGAP)", true,
            [VietnameseText.FoldedRegex(@"TCVN\s*\d|QCVN\s*\d|Viet\s?GAP")]),
        ("soil", "Quản lý đất / giá thể", true,
            [VietnameseText.FoldedRegex(@"đất trồng|giá thể|chất lượng đất|kim loại nặng|vùng sản xuất|loại đất|làm đất|đất thịt|đất cát")]),
        ("water", "Nguồn nước / nước tưới", true,
            [VietnameseText.FoldedRegex(@"nguồn nước|nước tưới|chất lượng nước")]),
        ("fertilizer", "Phân bón / dinh dưỡng", true,
            [VietnameseText.FoldedRegex(@"phân bón|chất dinh dưỡng|bón phân")]),
        ("ipm", "IPM / thuốc bảo vệ thực vật", true,
            [VietnameseText.FoldedRegex(@"\bIPM\b|BVTV|thuốc bảo vệ thực vật|dịch hại|sâu bệnh")]),
        ("harvest", "Thu hoạch / sau thu hoạch", true,
            [VietnameseText.FoldedRegex(@"thu hoạch")]),
        ("records", "Ghi chép hồ sơ / truy xuất nguồn gốc", true,
            [VietnameseText.FoldedRegex(@"truy xuất|ghi chép|nhật ký|lưu hồ sơ|hồ sơ sản xuất")]),
        ("version", "Năm, phiên bản hoặc ngày hiệu lực", false,
            [VietnameseText.FoldedRegex(@"\b(19|20)\d{2}\b|phiên bản|ngày ban hành|hiệu lực")]),
        ("environment", "Số liệu môi trường (nhiệt độ, độ ẩm, pH, EC)", false,
            [VietnameseText.FoldedRegex(@"nhiệt độ"), VietnameseText.FoldedRegex(@"độ ẩm|ẩm đất"), VietnameseText.FoldedRegex(@"\bpH\b"), VietnameseText.FoldedRegex(@"\bEC\b")]),
        ("stages", "Giai đoạn / thời lượng sinh trưởng", false,
            [VietnameseText.FoldedRegex(@"giai đoạn|thời kỳ"), VietnameseText.FoldedRegex(@"\d+\s*ngày")])
    ];

    // Mục bắt buộc theo loại tài liệu. Tài liệu chuyên đề bắt buộc mục ứng với Category của nó.
    // Chủ đề tài liệu (Category/Topics) → mục cần có nội dung. Mỗi tài liệu là một nguồn RAG riêng:
    // chỉ cần nguồn truy vết được và nội dung của các chủ đề nó khai báo, không cần đủ mọi mục VietGAP (DECISIONS #27).
    private static readonly Dictionary<string, string> SectionByTopic = new(StringComparer.OrdinalIgnoreCase)
    {
        ["irrigation"] = "water",
        ["pest"] = "ipm",
        ["nutrition"] = "fertilizer",
        ["harvest"] = "harvest",
        ["record"] = "records",
        ["climate"] = "environment",
        ["soil"] = "soil"
    };

    /// <summary>Kiểm tra theo chuẩn tài liệu VietGAP chính thức đầy đủ 7 mục (dùng cho checklist tham khảo).</summary>
    public static IReadOnlyList<VietGapCompletenessCheck> Check(string? text)
    {
        var normalized = VietnameseText.Fold(text);
        return Rules.Select(r => new VietGapCompletenessCheck(r.Key, r.Label, r.Critical, r.AllOf.All(p => p.IsMatch(normalized)))).ToList();
    }

    /// <summary>
    /// Mục bắt buộc của một tài liệu: nguồn (đơn vị ban hành hoặc mã tiêu chuẩn), mã tiêu chuẩn nếu là tiêu chuẩn chính thức,
    /// và nội dung của từng chủ đề đã khai báo (<paramref name="topics"/>, phân tách bằng dấu phẩy).
    /// Các mục khác chỉ để tham khảo (IsCritical = false).
    /// </summary>
    public static IReadOnlyList<VietGapCompletenessCheck> Check(string? text, AgricultureDocumentType type, string? topics, bool hasSource)
    {
        // DOCX/PDF có thể trả về Unicode dạng tổ hợp (NFD); chuẩn hóa để regex tiếng Việt khớp.
        var normalized = VietnameseText.Fold(text);
        var checks = Rules
            .Select(r => new VietGapCompletenessCheck(r.Key, r.Label, false, r.AllOf.All(p => p.IsMatch(normalized))))
            .ToList();

        // SRS 4.2.4: tài liệu phải "curated and traceable".
        var standardFound = checks.Single(c => c.Key == "standard").Found;
        checks.Insert(0, new VietGapCompletenessCheck("source", "Nguồn: mã tiêu chuẩn hoặc đơn vị ban hành", false, hasSource || standardFound));

        var required = new HashSet<string> { "source" };
        if (type == AgricultureDocumentType.OfficialStandard) required.Add("standard");
        foreach (var topic in (topics ?? string.Empty).Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            if (SectionByTopic.TryGetValue(topic, out var section)) required.Add(section);

        return checks.Select(c => required.Contains(c.Key) ? c with { IsCritical = true } : c).ToList();
    }

    public static IReadOnlyList<VietGapCompletenessCheck> MissingCritical(string? text) =>
        Check(text).Where(c => c.IsCritical && !c.Found).ToList();

    public static IReadOnlyList<VietGapCompletenessCheck> MissingCritical(string? text, AgricultureDocumentType type, string? topics, bool hasSource) =>
        Check(text, type, topics, hasSource).Where(c => c.IsCritical && !c.Found).ToList();
}
