using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace SmartFarm.Infrastructure.Ai.Knowledge;

/// <summary>
/// Gán chủ đề cho đoạn RAG và câu hỏi bằng từ khóa tiếng Việt. Chủ đề trùng với Category của tài liệu
/// (irrigation, pest, nutrition, harvest, record, climate) cộng thêm "soil"; không khớp gì là "general".
/// </summary>
public static class TopicClassifier
{
    private const RegexOptions Opts = RegexOptions.IgnoreCase | RegexOptions.CultureInvariant;

    public static readonly IReadOnlyList<string> Topics = ["irrigation", "pest", "nutrition", "harvest", "record", "climate", "soil"];

    private static readonly (string Topic, Regex Pattern)[] Rules =
    [
        // So trên văn bản bỏ dấu: tránh từ ngắn trùng nghĩa khác ("sâu"→"sau khi", "nấm"→"năm", "đạm"→"đảm bảo", "lân"→"lan").
        ("pest", VietnameseText.FoldedRegex(@"sâu (?:bệnh|hại|đục|xanh|khoang|non|vẽ bùa)|bệnh|dịch hại|\bIPM\b|BVTV|thuốc bảo vệ thực vật|phòng trừ|nấm (?:bệnh|hại)|bệnh nấm|\brầy\b|\brệp\b|thiên địch")),
        ("nutrition", VietnameseText.FoldedRegex(@"phân bón|bón phân|bón lót|bón thúc|dinh dưỡng|\bNPK\b|phân đạm|đạm urê|\bure\b|\bkali\b|phân lân|supe lân|hữu cơ vi sinh")),
        ("irrigation", VietnameseText.FoldedRegex(@"tưới (?:nước|nhỏ|phun|ẩm|gốc|rãnh|tiêu|đẫm)|nước tưới|lượng nước|chế độ tưới|nguồn nước|chất lượng nước|nhỏ giọt|độ ẩm đất|ẩm đất")),
        ("harvest", VietnameseText.FoldedRegex(@"thu hoạch|thu hái|sau thu hoạch|sơ chế|bảo quản|đóng gói|bao bì")),
        ("record", VietnameseText.FoldedRegex(@"ghi chép|nhật ký|truy xuất|hồ sơ sản xuất|lưu hồ sơ")),
        ("climate", VietnameseText.FoldedRegex(@"nhiệt độ|độ ẩm không khí|ánh sáng|cường độ sáng|vi khí hậu|nhà màng|thời vụ")),
        ("soil", VietnameseText.FoldedRegex(@"làm đất|loại đất|đất trồng|giá thể|lên luống|chuẩn bị đất|đất thịt|đất cát|kim loại nặng"))
    ];

    /// <summary>Chủ đề của một đoạn: ưu tiên tiêu đề mục, nếu không rõ thì chủ đề có nhiều từ khóa nhất trong nội dung.</summary>
    public static string ClassifyChunk(string? sectionTitle, string content)
    {
        if (!string.IsNullOrWhiteSpace(sectionTitle))
        {
            var fromTitle = Rules.FirstOrDefault(r => r.Pattern.IsMatch(VietnameseText.Fold(sectionTitle)));
            if (fromTitle.Topic is not null) return fromTitle.Topic;
        }
        var foldedContent = VietnameseText.Fold(content);
        var best = Rules
            .Select(r => (r.Topic, Count: r.Pattern.Matches(foldedContent).Count))
            .Where(x => x.Count > 0)
            .OrderByDescending(x => x.Count)
            .FirstOrDefault();
        return best.Topic ?? "general";
    }

    /// <summary>Các chủ đề câu hỏi nhắc tới (có thể nhiều), dùng để ưu tiên đoạn cùng chủ đề khi truy xuất.</summary>
    public static IReadOnlySet<string> ClassifyQuestion(string question) =>
        Rules.Where(r => r.Pattern.IsMatch(VietnameseText.Fold(question))).Select(r => r.Topic).ToHashSet();

    /// <summary>Chuẩn hóa danh sách chủ đề người dùng khai báo (bỏ giá trị lạ, trùng, 'general').</summary>
    public static string NormalizeTopics(IEnumerable<string?> topics) =>
        string.Join(',', topics
            .SelectMany(t => (t ?? string.Empty).Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            .Select(t => t.ToLowerInvariant())
            .Where(Topics.Contains)
            .Distinct());

    /// <summary>Hash nội dung sau khi chuẩn hóa Unicode, khoảng trắng và chữ hoa/thường — hai lần tải cùng file cho cùng hash.</summary>
    public static string ContentHash(string text)
    {
        var normalized = Regex.Replace(text.Normalize(NormalizationForm.FormC), @"\s+", " ").Trim().ToLowerInvariant();
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(normalized))).ToLowerInvariant();
    }
}
