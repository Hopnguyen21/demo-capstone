using System.Text;
using System.Text.RegularExpressions;

namespace SmartFarm.Infrastructure.Ai.Knowledge;

/// <summary>Một đoạn RAG kèm trang bắt đầu và mục chứa nó.</summary>
public sealed record ChunkPiece(string Content, int? PageNumber, string? SectionTitle);

/// <summary>
/// Chia tài liệu theo cấu trúc trước khi embedding:
/// 1. Bỏ khung trang web (menu, tin liên quan, bộ đếm...) của bản in trang web.
/// 2. Theo dõi trang qua nhãn [TRANG n].
/// 3. Cắt theo mục (Chương/Phần/Mục/Điều, "1.", "1.2.", "II.") để mỗi đoạn nằm trong một mục.
/// 4. Mục dài được chia tiếp bằng <see cref="TextChunker"/>; mục quá ngắn được gộp với mục sau.
/// Kích thước khoảng 1.800 ký tự (≈ 450–600 token tiếng Việt) thay vì 800 ký tự (≈ 200 token) trước đây.
/// </summary>
public static class StructuredChunker
{
    /// <summary>Tăng khi đổi cách chia; tài liệu có ChunkerVersion thấp hơn được worker nền chia lại.</summary>
    public const int Version = 5;

    public const int MaxChars = 1800;
    public const int OverlapChars = 200;
    public const int MinSectionChars = 400;

    private const RegexOptions Opts = RegexOptions.IgnoreCase | RegexOptions.CultureInvariant;

    private static readonly Regex PrivateUseGlyphs = new(@"[-]", RegexOptions.Compiled);

    private static readonly Regex PageMarker = new(@"^\s*\[TRANG\s*(\d+)\]\s*$", Opts);

    private static readonly Regex Heading = new(
        @"^\s*(?:(?:chương|phần|mục|điều)\s+[\dIVXLC]+\s*[.:\-–]?|\d{1,2}(?:\.\d{1,2}){0,2}\s*[.)]|[IVX]{1,5}\s*[.)])\s+\S.{1,120}$", Opts);

    private static readonly Regex WebChrome = new(
        @"\||^>>|^(?:video clips|tìm kiếm|bản in|chia sẻ|thư viện ảnh|thư viện video|thống kê truy cập|fanpage|văn bản mới|xem tin theo ngày|liên kết nhanh|-- liên kết)" +
        @"|^(?:hôm nay|tất cả|khách viếng thăm|máy chủ tìm kiếm|đang truy cập|đang online|tổng truy cập|theo dõi)\b" +
        @"|^\d{1,2}/\d{1,2}/\d{4}\s*-|^\d+\s*/\s*\d+$" +
        // Mảnh URL bị cắt dòng, lời chào cổng thông tin và dấu giờ trình duyệt in ở đầu/cuối mỗi trang.
        @"|://|\.html?\b|^\(/|^[\w\-]+-c\d+-|^chào mừng bạn đến|\b\d{1,2}:\d{2}\s+\d{1,2}/\d{1,2}/\d{2}\b", Opts);

    // Mảnh URL/slug bị cắt dòng ("duong-day-", "tac.htm"), nhãn giao diện cổng thông tin, thông tin liên hệ chân trang.
    // Không đụng đến câu văn: mọi mẫu đều khớp cả dòng hoặc đầu dòng.
    private static readonly Regex PortalChrome = new(
        @"^\(?https?:/|^url=|%2[fF]" +
        @"|^(?=[^\s]*[-.])[a-z0-9]+(?:[-./][a-z0-9]+)*(?:-|\.html?|\.ht)?\)?$" +
        @"|^[0-9a-f]{16,}$|=[^\s]*&" +
        @"|\(/[a-z0-9\-]" +
        // Tiêu đề tin ở thanh bên bị cắt bằng dấu ba chấm.
        // Tiêu đề tin ở thanh bên (văn bản hành chính, tin tức cổng thông tin) thường đứng ngay sau phần cuối bài bị cắt.
        @"|^(?:kế hoạch tổ chức|triển khai thực hiện nghị định|phát biểu của|nghị quyết số|về việc đăng ký|tuyên truyền, hướng dẫn)" +
        @"|…$" +
        @"|^(?:zalo|video|truy cập|đang|online|rất hài|không hài|gửi đánh|xem kết quả|đánh giá|bình|lòng|trực|tuyến|tiện|ích|hành|chính|& dvc|thông tin|tổng hợp|đường dây nóng|sở nn-mt|đã kết nối.*)$" +
        @"|^(?:địa chỉ|email|điện thoại|fax|chịu trách nhiệm|ghi rõ nguồn)\b" +
        @"|\S+@\S+\.\S+|;;|mailto:|phát hành lại thông tin từ website" +
        // Menu cổng thông tin bị chia nhiều dòng ("Cải cách Hành" / "chính", "Quyết định công" / "nhận lưu hành"...).
        @"|^(?:lịch tiếp công dân|cải cách hành?|phòng chống|tham nhũng|công khai ngân|đầu tư - đấu thầu|tuyển dụng viên|doanh nghiệp$|giống cây trồng$|quyết định công|nhận lưu hành|sản phẩm tự công|văn bản ban hành|thông báo chung|trang chủ)" +
        @"|^(?:bạn đánh giá thế|nào về chất|lượng dịch vụ|công trực tuyến|ý kiến của bạn|chúng tôi phục vụ|tốt hơn)", Opts);

    // Sau dòng này là phần "tin liên quan" của trang web: bỏ đến hết trang hiện tại.
    private static readonly Regex ArticleEnd = new(
        @"^\s*(?:từ khóa|tin liên quan|bài viết liên quan|các tin khác|tin cùng chuyên mục)\b|khác:\s*$", Opts);

    public static IReadOnlyList<ChunkPiece> Chunk(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return [];
        var sections = ReadSections(text);
        return Pack(sections);
    }

    /// <summary>
    /// Văn bản đã bỏ khung trang web (menu, mảnh URL, chân trang liên hệ) nhưng giữ nhãn [TRANG n] và thứ tự dòng.
    /// Dùng làm đầu vào cho trích xuất AI để trường không lấy giá trị từ rác trang web; câu trích nằm trong chính văn bản này.
    /// </summary>
    public static string CleanedText(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return string.Empty;
        var sb = new StringBuilder();
        int? lastPage = null;
        foreach (var section in ReadSections(text))
            foreach (var (line, page) in section.Lines)
            {
                if (page != lastPage && page is not null) { sb.Append("[TRANG ").Append(page).Append("]\n"); lastPage = page; }
                sb.Append(line).Append('\n');
            }
        return sb.ToString().TrimEnd();
    }

    private sealed class Section
    {
        public string? Title;
        public readonly List<(string Line, int? Page)> Lines = [];
        public int Length => Lines.Sum(l => l.Line.Length + 1);
    }

    private static List<Section> ReadSections(string text)
    {
        // PdfPig có thể trả chữ tiếng Việt dạng tổ hợp (NFD); chuẩn hóa để các mẫu nhận diện khớp.
        var lines = RemoveTableFragmentRuns(RemoveRepeatedPageLines(text.Normalize(NormalizationForm.FormC).Replace("\r\n", "\n").Replace('\r', '\n').Split('\n')));
        var sections = new List<Section> { new() };
        int? page = null;
        var skippingToNextPage = false;
        string? previous = null; // dòng nội dung gần nhất đã giữ lại

        for (var i = 0; i < lines.Length; i++)
        {
            // Ký tự vùng dùng riêng (U+E000–U+F8FF) là icon font của trang web, không phải chữ.
            var line = PrivateUseGlyphs.Replace(lines[i], string.Empty).Trim();
            var pageMatch = PageMarker.Match(line);
            if (pageMatch.Success)
            {
                page = int.Parse(pageMatch.Groups[1].Value);
                skippingToNextPage = false;
                continue;
            }
            if (line.Length == 0 || skippingToNextPage) continue;
            if (line.StartsWith("[OCR bằng AI", StringComparison.OrdinalIgnoreCase)) continue;
            if (IsTableOfContentsLine(line)) continue;
            if (ArticleEnd.IsMatch(line)) { skippingToNextPage = true; continue; }
            if (IsWebChrome(line, i + 1 < lines.Length ? lines[i + 1].Trim() : string.Empty)) continue;

            // Chỉ là đề mục khi dòng trước đã kết thúc câu: "…đến giữa tháng\n12. Nguồn giống" là "tháng 12" bị xuống dòng.
            if (Heading.IsMatch(line) && (line.EndsWith(':') || previous is null || Regex.IsMatch(previous, @"[.:;!?)]$") || Heading.IsMatch(previous)))
                sections.Add(new Section { Title = Truncate(line.TrimEnd(':', ' '), 300) });
            sections[^1].Lines.Add((line, page));
            previous = line;
        }

        return sections.Where(s => s.Lines.Count > 0).ToList();
    }

    /// <summary>
    /// Dòng đầu/cuối trang lặp lại ở từ ba trang khác nhau trở lên (tên tài liệu in lại ở chân trang, kể cả khi lỗi mã hóa font như
    /// "Höôùng DAÃN GAP CÔ BAÛN") là khung trang, không phải nội dung; bỏ đi để không chiếm chỗ trong đoạn và kết quả tìm kiếm.
    /// Chỉ áp dụng cho dòng ngắn có từ hai từ trở lên và không phải đề mục; tài liệu không có nhãn trang thì giữ nguyên.
    /// </summary>
    internal static string[] RemoveRepeatedPageLines(string[] lines)
    {
        static string Key(string l) => Regex.Replace(l.Trim(), @"\s+", " ").ToLowerInvariant();
        var pagesByLine = new Dictionary<string, HashSet<int>>();
        int? page = null;
        foreach (var raw in lines)
        {
            var m = PageMarker.Match(raw.Trim());
            if (m.Success) { page = int.Parse(m.Groups[1].Value); continue; }
            var key = Key(raw);
            if (page is null || key.Length is < 8 or > 90 || !key.Any(char.IsLetter) || key.Split(' ').Length < 2 || Heading.IsMatch(raw.Trim())) continue;
            if (!pagesByLine.TryGetValue(key, out var set)) pagesByLine[key] = set = [];
            set.Add(page.Value);
        }
        var repeated = pagesByLine.Where(kv => kv.Value.Count >= 3).Select(kv => kv.Key).ToHashSet();
        return repeated.Count == 0 ? lines : lines.Where(l => PageMarker.IsMatch(l.Trim()) || !repeated.Contains(Key(l))).ToArray();
    }

    /// <summary>
    /// Bảng trong PDF thường được đọc ra mỗi ô/từ một dòng ("Đào", "Tuyên", "Số", "nông", "dân"...): chuỗi từ sáu dòng ngắn liên tiếp
    /// trở lên là phần vỡ của bảng, không đọc được thành câu, chỉ làm nhiễu đoạn và kết quả tìm kiếm nên bị bỏ.
    /// Dòng nhãn trang và đề mục luôn được giữ.
    /// </summary>
    internal static string[] RemoveTableFragmentRuns(string[] lines)
    {
        const int maxLineChars = 10, minRun = 6;
        bool IsFragment(string l)
        {
            var t = l.Trim();
            return t.Length > 0 && t.Length <= maxLineChars && !PageMarker.IsMatch(t) && !Heading.IsMatch(t);
        }

        var result = new List<string>(lines.Length);
        var i = 0;
        while (i < lines.Length)
        {
            if (!IsFragment(lines[i])) { result.Add(lines[i]); i++; continue; }
            var j = i;
            while (j < lines.Length && (IsFragment(lines[j]) || lines[j].Trim().Length == 0)) j++;
            var run = lines.Skip(i).Take(j - i).Count(l => l.Trim().Length > 0);
            if (run < minRun) result.AddRange(lines.Skip(i).Take(j - i));
            i = j;
        }
        return result.ToArray();
    }

    // Dòng mục lục ("2. Quản lý đất ........ 13"): tên mục kèm đường chấm và số trang, không phải nội dung kỹ thuật.
    private static readonly Regex TocLine = new(@"^.{2,}?(?:\.{5,}|…{3,})\s*\d{1,3}\s*$", RegexOptions.Compiled);

    internal static bool IsTableOfContentsLine(string line) => TocLine.IsMatch(line.Trim());

    private static readonly Regex DottedLeader = new(@"\.{5,}|…{3,}|_{4,}", RegexOptions.Compiled);

    /// <summary>
    /// Biểu mẫu/nhật ký để trống (đường chấm "........", bảng bị tách mỗi từ một dòng) không phải tri thức: đưa vào kho chỉ làm nhiễu tìm kiếm.
    /// </summary>
    internal static bool LooksLikeBlankForm(string content)
    {
        var leaders = DottedLeader.Matches(content);
        if (leaders.Count >= 4 && leaders.Sum(m => m.Length) * 100 / Math.Max(1, content.Length) >= 15) return true;
        var lines = content.Split('\n', StringSplitOptions.RemoveEmptyEntries);
        return lines.Length >= 12 && lines.Count(l => l.Trim().Length <= 5) * 100 / lines.Length >= 55;
    }

    // Dòng ngắn không kết thúc câu đứng trước một dòng viết hoa: tiêu đề tin ở sidebar chen vào giữa bài.
    // Không áp dụng cho dòng là đề mục.
    private static bool IsWebChrome(string line, string next) =>
        WebChrome.IsMatch(line) || PortalChrome.IsMatch(line) ||
        (line.Length <= 30 && !Heading.IsMatch(line) && !Regex.IsMatch(line, @"[.,:;)!?%]$")
         && next.Length > 0 && char.IsUpper(next[0]) && !line.StartsWith('-') && !line.StartsWith('+') && !line.StartsWith('–'));

    // Đoạn ngắn gần như không có từ vựng canh tác (tiêu đề tin ở thanh bên, địa chỉ chân trang còn sót sau khi lọc
    // theo mẫu) không phải tri thức kỹ thuật. Chỉ áp dụng cho đoạn ngắn không thuộc mục có tiêu đề và chỉ khi tài liệu còn đoạn khác để giữ.
    private static readonly Regex AgronomyTerms = new(
        @"\b(?:cây|đất|phân|tưới|thuốc|sâu|bệnh|thu hoạch|gieo|trồng|bón|giống|quả|rễ|ẩm|nhiệt|vụ|ruộng|luống|nước|ghi chép|nhật ký|truy xuất|hồ sơ|vệ sinh|an toàn|vietgap|tiêu chuẩn|dụng cụ|bao bì|kho|lá|hoa|dinh dưỡng|ph|ec)\b", Opts);
    private const int ShortChunkChars = 600;
    private const int MinAgronomyTerms = 3;

    private static List<ChunkPiece> DropNonTechnical(List<ChunkPiece> pieces)
    {
        var kept = pieces.Where(p => p.SectionTitle is not null || p.Content.Length >= ShortChunkChars || AgronomyTerms.Matches(p.Content).Count >= MinAgronomyTerms).ToList();
        kept = kept.Where(p => !LooksLikeBlankForm(p.Content)).ToList();
        return kept.Count > 0 ? kept : pieces;
    }

    private static List<ChunkPiece> Pack(List<Section> sections)
    {
        // Gộp mục quá ngắn vào mục kế tiếp để đoạn không bị vụn (giữ tiêu đề của mục đầu).
        var merged = new List<Section>();
        foreach (var section in sections)
        {
            if (merged.Count > 0 && merged[^1].Length < MinSectionChars && merged[^1].Length + section.Length <= MaxChars)
            {
                merged[^1].Lines.AddRange(section.Lines);
                merged[^1].Title ??= section.Title;
                continue;
            }
            merged.Add(section);
        }

        var pieces = new List<ChunkPiece>();
        foreach (var section in merged)
        {
            var sb = new StringBuilder();
            var pageAtOffset = new List<(int Offset, int? Page)>();
            foreach (var (line, page) in section.Lines)
            {
                pageAtOffset.Add((sb.Length, page));
                sb.Append(line).Append('\n');
            }
            var body = sb.ToString().TrimEnd();
            if (body.Length < 20) continue;

            if (body.Length <= MaxChars)
            {
                pieces.Add(new ChunkPiece(body, section.Lines[0].Page, section.Title));
                continue;
            }

            var searchFrom = 0;
            foreach (var part in TextChunker.Split(body, MaxChars, OverlapChars))
            {
                var probe = part.Length > 40 ? part[..40] : part;
                var offset = body.IndexOf(probe, searchFrom, StringComparison.Ordinal);
                if (offset < 0) offset = searchFrom;
                else searchFrom = offset + 1;
                pieces.Add(new ChunkPiece(part, PageAt(pageAtOffset, offset), section.Title));
            }
        }
        return DropNonTechnical(pieces);
    }

    private static int? PageAt(List<(int Offset, int? Page)> pages, int offset)
    {
        int? page = pages.Count > 0 ? pages[0].Page : null;
        foreach (var p in pages)
        {
            if (p.Offset > offset) break;
            page = p.Page;
        }
        return page;
    }

    private static string Truncate(string value, int max) => value.Length <= max ? value : value[..max].Trim();
}
