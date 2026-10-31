using System.Text.RegularExpressions;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Domain.Entities;

namespace SmartFarm.Infrastructure.Ai.Knowledge;

/// <summary>Thông tin mô tả tài liệu dạng đơn giản (giá trị chưa kèm bằng chứng) — suy ra từ <see cref="DocumentMetadataDetection"/>.</summary>
public sealed record VietGapDocumentMetadata(
    string Title,
    string CropScope,
    string? StandardCode,
    string? AuthorOrganization,
    string? Version,
    string Category);

/// <summary>
/// Nhận diện metadata từ toàn văn tài liệu bằng quy tắc xác định: tiêu đề, cây áp dụng, đơn vị ban hành, mã tiêu chuẩn,
/// phiên bản/hiệu lực, loại tài liệu. Chỉ ghi giá trị khi nội dung file có bằng chứng; mỗi giá trị kèm câu trích, số trang
/// và trạng thái detected / uncertain / not_found. Nội dung file được xem là dữ liệu: không thực thi chỉ dẫn nằm trong đó.
/// </summary>
public static class VietGapMetadataExtractor
{
    private const RegexOptions Opts = RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.Multiline;

    // "cải" đứng riêng gây nhầm ("cải tạo đất", "cải thiện") nên không nằm trong danh sách.
    private static readonly string[] KnownCrops =
    [
        "cà chua", "dưa leo màu", "dưa leo baby", "dưa leo", "dưa chuột", "dưa lưới", "dâu tây", "xà lách", "rau muống", "cải bẹ xanh", "cải bắp", "cải ngọt",
        "ớt chuông", "ớt", "bắp cải", "súp lơ", "đậu bắp", "bí đỏ", "khổ qua", "mướp đắng", "hành lá",
        "lúa", "cà phê", "hồ tiêu", "thanh long", "xoài", "sầu riêng", "bưởi", "chè"
    ];

    private static readonly Regex CropLine = new(
        @"^\s*[-•*]?\s*(?:cây trồng áp dụng|cay trong ap dung|cây trồng|cay trong|đối tượng cây trồng|doi tuong cay trong|đối tượng áp dụng|doi tuong ap dung|áp dụng cho cây|ap dung cho cay|áp dụng cho|ap dung cho)\s*[:：]\s*(?<v>.+)$", Opts);
    private static readonly Regex CodeLine = new(
        @"^\s*[-•*]?\s*(?:mã số tiêu chuẩn|mã tiêu chuẩn|mã quy chuẩn|số hiệu tiêu chuẩn|tiêu chuẩn áp dụng)\s*[:：]\s*(?<v>.+)$", Opts);
    private static readonly Regex CodeInline = new(
        @"\b(?:TCVN|QCVN)\s*[\d\-]+(?:\s*[-:]\s*[\d]+)*(?::\d{4})?(?:/[A-ZĐ]+)?", Opts);
    private static readonly Regex AuthorLine = new(
        @"^\s*[-•*]?\s*(?:đơn vị ban hành|cơ quan ban hành|ban hành bởi|cơ quan thẩm định|tổ chức ban hành|đơn vị biên soạn)\s*[:：]\s*(?<v>.+)$", Opts);
    private static readonly Regex VersionLine = new(
        @"^\s*[-•*]?\s*(?:phiên bản|version|lần ban hành|thời hạn hiệu lực|năm ban hành)\s*[:：]\s*(?<v>.+)$", Opts);
    private static readonly Regex EffectiveDateLine = new(
        @"(?:ngày (?:ban hành|có hiệu lực|hiệu lực)|có hiệu lực từ(?: ngày)?)\s*[:：]?\s*(?<v>\d{1,2}[/\-.]\d{1,2}[/\-.]\d{4})", Opts);
    private static readonly Regex GeneralScopePhrase = new(
        @"áp dụng (?:chung )?(?:cho )?(?:(?:tất cả|mọi|toàn bộ)\s+(?:các\s+)?|(?:nhiều|các)\s+)(?:loại\s+)?(?:cây trồng|rau màu|rau|cây rau|cây ăn quả)", Opts);
    private static readonly Regex SourceAttribution = new(
        @"ghi rõ nguồn\s*[""“”]\s*(?<v>[^""“”]{5,160}?)\s*[""“”]", Opts);
    private static readonly Regex PageMarker = new(@"\[TRANG\s*(?<n>\d+)\]", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    private static readonly Regex StandardMarker = new(@"tiêu chuẩn|quy chuẩn|\bTCVN\b|\bQCVN\b", Opts);
    private static readonly Regex GuideMarker = new(@"quy trình|hướng dẫn|cẩm nang|kỹ thuật (?:trồng|canh tác|sản xuất)|canh tác", Opts);
    private static readonly Regex ThematicMarker = new(
        @"phòng trừ|quản lý dịch hại|\bIPM\b|sâu bệnh|nước tưới|tưới nhỏ giọt|bón phân|dinh dưỡng|thu hoạch|truy xuất|ghi chép|vi khí hậu|chuyên đề", Opts);

    public static DocumentMetadataDetection Detect(string text, string? fileName)
    {
        var normalized = (text ?? string.Empty).Replace("\r\n", "\n").Replace('\r', '\n');
        var pages = PageMarker.Matches(normalized).Select(m => (m.Index, Page: int.Parse(m.Groups["n"].Value))).ToList();
        int? PageAt(int index)
        {
            int? page = null;
            foreach (var p in pages) { if (p.Index <= index) page = p.Page; else break; }
            return page;
        }
        MetadataEvidence Evidence(string quote, int index) => new(Truncate(quote.Trim(), 240), PageAt(index));
        static DetectedMetadataField NotFound() => new(DocumentMetadataDetection.NotFound, null, null, 0);
        static DetectedMetadataField Field(string status, string value, MetadataEvidence? evidence, double confidence, IReadOnlyList<string>? candidates = null) =>
            new(status, value, evidence, confidence, candidates);

        // ── Tiêu đề ────────────────────────────────────────────────────────
        var (titleLine, titleIsStrong, titleIndex) = FirstMeaningfulLine(normalized);
        var fromName = FileNameTitle(fileName);
        if (titleLine != null && fromName != null && fromName.Length > titleLine.Length &&
            VietnameseText.Fold(fromName).StartsWith(VietnameseText.Fold(titleLine)))
        {
            titleLine = fromName;
            titleIsStrong = true;
        }

        DetectedMetadataField title;
        if (titleLine is not null)
            title = Field(titleIsStrong ? DocumentMetadataDetection.Detected : DocumentMetadataDetection.Uncertain, Truncate(titleLine, 300),
                Evidence(titleLine, titleIndex), titleIsStrong ? 0.9 : 0.5);
        else
        {
            title = fromName is null ? NotFound() : Field(DocumentMetadataDetection.Uncertain, fromName, new MetadataEvidence("Tên file: " + fileName, null), 0.3);
        }

        // ── Cây áp dụng ────────────────────────────────────────────────────
        DetectedMetadataField crops;
        var cropLine = CropLine.Match(normalized);
        var cropText = Clean(cropLine.Groups["v"].Value, 500, stripParentheses: true);
        if (cropLine.Success && cropText.Length > 0)
            crops = Field(DocumentMetadataDetection.Detected, cropText, Evidence(cropLine.Value, cropLine.Index), 0.95);
        else
        {
            var inTitle = titleLine is null ? [] : CropsIn(titleLine);
            if (inTitle.Count > 0)
                crops = Field(DocumentMetadataDetection.Detected, string.Join(", ", inTitle), Evidence(titleLine!, titleIndex), 0.85);
            else
            {
                var inFileName = string.IsNullOrWhiteSpace(fileName) ? [] : CropsIn(fileName);
                var counts = CropMentions(normalized);

                if (inFileName.Count > 0)
                {
                    var matchedCrop = inFileName[0];
                    crops = Field(DocumentMetadataDetection.Detected, string.Join(", ", inFileName),
                        Evidence(FirstMentionContext(normalized, matchedCrop, out var at), at), 0.9,
                        counts.Select(c => $"{c.Crop} ({c.Count})").ToList());
                }
                else if (counts.Count == 1 && counts[0].Count >= 3)
                {
                    crops = Field(DocumentMetadataDetection.Uncertain, counts[0].Crop,
                        Evidence(FirstMentionContext(normalized, counts[0].Crop, out var at), at), 0.5,
                        counts.Select(c => $"{c.Crop} ({c.Count})").ToList());
                }
                else if (counts.Count > 1 && counts[0].Count >= 5 && counts[0].Count >= counts[1].Count * 3)
                {
                    crops = Field(DocumentMetadataDetection.Uncertain, counts[0].Crop,
                        Evidence(FirstMentionContext(normalized, counts[0].Crop, out var at), at), 0.6,
                        counts.Select(c => $"{c.Crop} ({c.Count})").ToList());
                }
                else if (counts.Count > 0)
                {
                    crops = new(DocumentMetadataDetection.NotFound, null, null, 0, counts.Select(c => $"{c.Crop} ({c.Count})").ToList());
                }
                else
                {
                    crops = NotFound();
                }
            }
        }

        var generalMatch = GeneralScopePhrase.Match(normalized);
        var generalScope = generalMatch.Success
            ? Field(DocumentMetadataDetection.Detected, "general", Evidence(LineAround(normalized, generalMatch.Index), generalMatch.Index), 0.8)
            : NotFound();

        // ── Đơn vị ban hành ────────────────────────────────────────────────
        DetectedMetadataField publisher;
        var authorLine = AuthorLine.Match(normalized);
        var authorText = Clean(authorLine.Groups["v"].Value, 200);
        if (authorLine.Success && authorText.Length > 0)
            publisher = Field(DocumentMetadataDetection.Detected, authorText, Evidence(authorLine.Value, authorLine.Index), 0.95);
        else
        {
            // Câu "Ghi rõ nguồn "<đơn vị>" khi phát hành lại" ở chân trang cổng thông tin nêu đúng đơn vị đăng tải.
            var attribution = SourceAttribution.Match(normalized);
            var attributed = Clean(Regex.Replace(attribution.Groups["v"].Value, @"\s+", " "), 200);
            if (attribution.Success && attributed.Length >= 5)
                publisher = Field(DocumentMetadataDetection.Detected, SentenceCaseAgency(attributed),
                    Evidence(Regex.Replace(attribution.Value, @"\s+", " "), attribution.Index), 0.8);
            else
            {
                var org = OrganizationName.Match(normalized);
                publisher = org.Success
                    ? Field(DocumentMetadataDetection.Uncertain, Clean(org.Value, 200), Evidence(LineAround(normalized, org.Index), org.Index), 0.5)
                    : NotFound();
            }
        }

        // ── Mã tiêu chuẩn ──────────────────────────────────────────────────
        DetectedMetadataField code;
        var codeLine = CodeLine.Match(normalized);
        var codeText = Clean(codeLine.Groups["v"].Value, 100);
        if (codeLine.Success && codeText.Length > 0)
            code = Field(DocumentMetadataDetection.Detected, codeText, Evidence(codeLine.Value, codeLine.Index), 0.95);
        else
        {
            var inline = CodeInline.Match(normalized);
            if (!inline.Success) code = NotFound();
            else
            {
                // Mã trong tiêu đề là mã của chính tài liệu; mã nằm trong thân bài có thể chỉ là tài liệu được tham chiếu.
                var inTitleCode = titleLine is not null && titleLine.Contains(inline.Value, StringComparison.OrdinalIgnoreCase);
                code = Field(inTitleCode ? DocumentMetadataDetection.Detected : DocumentMetadataDetection.Uncertain, Clean(inline.Value, 100),
                    Evidence(LineAround(normalized, inline.Index), inline.Index), inTitleCode ? 0.9 : 0.5);
            }
        }

        // ── Phiên bản / hiệu lực ───────────────────────────────────────────
        var versionLine = VersionLine.Match(normalized);
        var versionText = Clean(versionLine.Groups["v"].Value, 50);
        var version = versionLine.Success && versionText.Length > 0
            ? Field(DocumentMetadataDetection.Detected, versionText, Evidence(versionLine.Value, versionLine.Index), 0.95)
            : NotFound();

        DetectedMetadataField effective;
        var dateMatch = EffectiveDateLine.Match(normalized);
        if (dateMatch.Success)
            effective = Field(DocumentMetadataDetection.Detected, dateMatch.Groups["v"].Value, Evidence(dateMatch.Value, dateMatch.Index), 0.9);
        else if (code.Value is { } c && Regex.Match(c, @":(?<y>(?:19|20)\d{2})\b") is { Success: true } year)
            effective = Field(DocumentMetadataDetection.Uncertain, year.Groups["y"].Value, code.Evidence, 0.5);
        else
            effective = NotFound();

        // ── Loại tài liệu ──────────────────────────────────────────────────
        var documentType = DetectDocumentType(titleLine, titleIndex, code, Evidence);

        return new DocumentMetadataDetection(
            DocumentMetadataDetection.CurrentRulesVersion, title, crops, generalScope, publisher, code, version, effective,
            documentType, Topics: []);
    }

    /// <summary>Phiên bản đơn giản (giá trị không kèm bằng chứng): chỉ lấy trường có bằng chứng, không suy đoán.</summary>
    public static VietGapDocumentMetadata Extract(string text, string? fileName)
    {
        var d = Detect(text, fileName);
        static string? Value(DetectedMetadataField f) => f.Status == DocumentMetadataDetection.NotFound ? null : f.Value;
        return new VietGapDocumentMetadata(
            Value(d.Title) ?? "Tài liệu VietGAP",
            Value(d.Crops) ?? string.Empty,
            Value(d.StandardCode),
            Value(d.Publisher),
            // Năm suy ra từ mã tiêu chuẩn (uncertain) là năm của tiêu chuẩn được nhắc, không dùng làm phiên bản của tài liệu.
            Value(d.Version) ?? (d.EffectiveDate.Status == DocumentMetadataDetection.Detected ? d.EffectiveDate.Value : null),
            "general");
    }

    private static DetectedMetadataField DetectDocumentType(
        string? titleLine, int titleIndex, DetectedMetadataField code, Func<string, int, MetadataEvidence> evidence)
    {
        var unspecified = new DetectedMetadataField(DocumentMetadataDetection.NotFound, nameof(AgricultureDocumentType.Unspecified), null, 0);
        if (titleLine is null) return unspecified;
        var ev = evidence(titleLine, titleIndex);
        var standard = StandardMarker.IsMatch(titleLine) ||
                       (code.Status == DocumentMetadataDetection.Detected && CodeInline.IsMatch(titleLine));
        var guide = GuideMarker.IsMatch(titleLine);
        var thematic = ThematicMarker.IsMatch(titleLine);

        // Tiêu đề nhắc cả tiêu chuẩn lẫn hướng dẫn (ví dụ "Quy trình ... theo tiêu chuẩn VietGAP") không đủ để phân biệt.
        if (standard && guide) return new(DocumentMetadataDetection.Uncertain, nameof(AgricultureDocumentType.Unspecified), ev, 0.3,
            ["OfficialStandard", "TechnicalGuide"]);
        if (standard) return new(DocumentMetadataDetection.Detected, nameof(AgricultureDocumentType.OfficialStandard), ev, 0.8);
        if (guide && !thematic) return new(DocumentMetadataDetection.Detected, nameof(AgricultureDocumentType.TechnicalGuide), ev, 0.8);
        if (thematic && !guide) return new(DocumentMetadataDetection.Uncertain, nameof(AgricultureDocumentType.Thematic), ev, 0.5);
        if (guide && thematic) return new(DocumentMetadataDetection.Uncertain, nameof(AgricultureDocumentType.Unspecified), ev, 0.3,
            ["TechnicalGuide", "Thematic"]);
        return unspecified;
    }

    // Dòng tên tài liệu kỹ thuật thường chứa một trong các cụm này.
    private static readonly Regex TitleKeywords = new(
        @"kỹ thuật|quy trình|hướng dẫn|tiêu chuẩn|quy chuẩn|viet\s?gap|thực hành nông nghiệp", Opts);

    // Phần khung của trang web in ra PDF (menu, ngày giờ, lượt xem...) không phải tiêu đề.
    private static readonly Regex WebChromeLine = new(
        @"\||^>>|^(?:thứ\s+\S+|chủ nhật)\s*-|tin đăng|lượt xem|\bxem:\s*\d|^bản in$|^tìm kiếm$|^chia sẻ$|^\d+\s*/\s*\d+$", Opts);

    private static (string? Line, bool Strong, int Index) FirstMeaningfulLine(string text)
    {
        string? firstCandidate = null;
        var firstIndex = 0;
        var offset = 0;
        var rawLines = text.Split('\n').Take(40).ToList();
        for (var rawIndex = 0; rawIndex < rawLines.Count; rawIndex++)
        {
            var raw = rawLines[rawIndex];
            var lineStart = offset;
            offset += raw.Length + 1;
            var line = raw.Trim().Trim('#', '*', '=', '-', '_', ' ').Trim();
            if (line.StartsWith("[OCR bằng AI", StringComparison.OrdinalIgnoreCase)) continue;
            if (Regex.IsMatch(line, @"^\[?TRANG\s*\d+\]?$", Opts)) continue;
            if (line.Length < 8 || !line.Any(char.IsLetter)) continue;
            if (WebChromeLine.IsMatch(line)) continue;
            // Bỏ qua dòng dạng "Nhãn: giá trị" (mã số, đơn vị...) để tiêu đề là dòng tên tài liệu.
            if (Regex.IsMatch(line, @"^[^:：]{1,40}[:：]\s*\S")) continue;
            // Mục đánh số ("1. Thời vụ:") là nội dung, không phải tiêu đề.
            if (Regex.IsMatch(line, @"^(?:\d{1,2}|[IVX]{1,4})[.)]\s")) continue;
            if (line.Length <= 200 && TitleKeywords.IsMatch(line))
            {
                // Tiêu đề in từ trang web hay bị xuống dòng giữa chừng ("...SX cà" / "chua an toàn"): ghép dòng tiếp theo
                // khi nó ngắn, bắt đầu bằng chữ thường và dòng trước chưa kết thúc câu.
                if (rawIndex + 1 < rawLines.Count && !Regex.IsMatch(line, @"[.:;!?]$"))
                {
                    var next = rawLines[rawIndex + 1].Trim();
                    if (next.Length is > 0 and <= 40 && char.IsLower(next[0]) && !WebChromeLine.IsMatch(next)
                        && !Regex.IsMatch(next, @"^[^:：]{1,40}[:：]\s*\S") && line.Length + 1 + next.Length <= 200)
                        line = $"{line} {next}";
                }
                return (line, true, lineStart);
            }
            if (firstCandidate is null) { firstCandidate = line; firstIndex = lineStart; }
        }
        return (firstCandidate, false, firstIndex);
    }

    // Tên cơ quan nông nghiệp thường gặp; phần địa danh viết hoa chữ cái đầu, không vượt qua xuống dòng.
    private static readonly Regex OrganizationName = new(
        @"(?:Trung tâm Khuyến nông|Chi cục Trồng trọt và Bảo vệ thực vật|Chi cục Bảo vệ thực vật|Sở Nông nghiệp(?: và (?:Phát triển nông thôn|Môi trường))?|Cục Trồng trọt|Cục Bảo vệ thực vật|Bộ Nông nghiệp(?: và (?:Phát triển nông thôn|Môi trường))?|Viện (?:Khoa học|Nghiên cứu|Cây)[^\n,.;]{0,60})(?:[ \t]+(?:tỉnh|thành phố|TP\.?)?[ \t]*(?:\p{Lu}\p{Ll}+)(?:[ \t]+\p{Lu}\p{Ll}+){0,2})?",
        RegexOptions.CultureInvariant);

    private static string? FileNameTitle(string? fileName)
    {
        var name = Path.GetFileNameWithoutExtension(fileName ?? string.Empty);
        name = Regex.Replace(name, @"[_\-]+", " ").Trim();
        return name.Length >= 3 ? name : null;
    }

    // Cây xuất hiện nguyên từ trong đoạn văn (hỗ trợ cả có dấu và không dấu); ưu tiên tên dài ("ớt chuông" trước "ớt") và không đếm lại phần đã khớp.
    private static List<string> CropsIn(string text)
    {
        var folded = VietnameseText.Fold(text);
        var found = new List<(int Index, string Crop)>();
        var taken = new bool[folded.Length];
        foreach (var crop in KnownCrops.OrderByDescending(c => c.Length))
        {
            var foldedCrop = VietnameseText.Fold(crop);
            foreach (Match m in Regex.Matches(folded, $@"(?<![\p{{L}}\p{{N}}]){Regex.Escape(foldedCrop)}(?![\p{{L}}\p{{N}}])"))
            {
                if (Enumerable.Range(m.Index, m.Length).Any(i => taken[i])) continue;
                for (var i = m.Index; i < m.Index + m.Length; i++) taken[i] = true;
                found.Add((m.Index, crop));
            }
        }
        return found.OrderBy(f => f.Index).Select(f => f.Crop).Distinct().ToList();
    }

    private static List<(string Crop, int Count)> CropMentions(string text)
    {
        var lower = text.ToLowerInvariant();
        var counts = new Dictionary<string, int>();
        var taken = new bool[lower.Length];
        foreach (var crop in KnownCrops.OrderByDescending(c => c.Length))
            foreach (Match m in Regex.Matches(lower, $@"(?<![\p{{L}}\p{{N}}]){Regex.Escape(crop)}(?![\p{{L}}\p{{N}}])"))
            {
                if (Enumerable.Range(m.Index, m.Length).Any(i => taken[i])) continue;
                for (var i = m.Index; i < m.Index + m.Length; i++) taken[i] = true;
                counts[crop] = counts.GetValueOrDefault(crop) + 1;
            }
        return counts.Select(kv => (kv.Key, kv.Value)).OrderByDescending(x => x.Value).ToList();
    }

    private static string FirstMentionContext(string text, string crop, out int index)
    {
        index = text.IndexOf(crop, StringComparison.OrdinalIgnoreCase);
        return index < 0 ? crop : LineAround(text, index);
    }

    private static string LineAround(string text, int index)
    {
        var start = text.LastIndexOf('\n', Math.Max(0, Math.Min(index, text.Length - 1))) + 1;
        var end = text.IndexOf('\n', index);
        if (end < 0) end = text.Length;
        return text[start..end];
    }

    private static string Clean(string value, int max, bool stripParentheses = false)
    {
        var result = value.Trim().TrimEnd('.', ';', ',').Trim();
        if (stripParentheses) result = Regex.Replace(result, @"\s*\([^)]*\)", string.Empty).Trim();
        return Truncate(result, max);
    }

    // Tên cơ quan viết hoa toàn bộ ("SỞ NÔNG NGHIỆP VÀ MÔI TRƯỜNG TỈNH HƯNG YÊN") đổi sang viết hoa chữ cái đầu mỗi từ.
    private static string SentenceCaseAgency(string value)
    {
        if (value != value.ToUpperInvariant()) return value;
        var title = System.Globalization.CultureInfo.GetCultureInfo("vi-VN").TextInfo.ToTitleCase(value.ToLowerInvariant());
        return Regex.Replace(title, @"\b(Và|Của)\b", m => m.Value.ToLowerInvariant());
    }

    private static string Truncate(string value, int max) => value.Length <= max ? value : value[..max].Trim();
}
