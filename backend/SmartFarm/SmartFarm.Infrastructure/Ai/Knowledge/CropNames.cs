using System.Text.RegularExpressions;

namespace SmartFarm.Infrastructure.Ai.Knowledge;

/// <summary>
/// Nguồn chuẩn duy nhất cho tên cây trồng trong kho tri thức: phạm vi áp dụng của tài liệu được lưu theo tên chuẩn,
/// và truy xuất, nhóm theo cây, gom nguồn Growth Profile đều so theo tên chuẩn này (frontend dùng giá trị đã lưu).
/// Danh mục Crop ghi tên giống kèm tiếng Anh ("Cà Chua Beefsteak (Tomato)") nên được quy về cây.
/// So khớp nguyên tên/tiền tố từ, không so chuỗi con: "ớt" không khớp "ớt chuông".
/// </summary>
public static class CropNames
{
    private static readonly Dictionary<string, string[]> Aliases = new()
    {
        ["Cà chua"] = ["ca chua", "tomato", "ca chua beefsteak", "ca chua cherry"],
        ["Xà lách"] = ["xa lach", "lettuce", "batavia", "lolo", "xa lach cuon", "xa lach thuy canh", "batavia lettuce", "hydroponic lettuce"],
        ["Dưa leo"] = ["dua leo", "dua chuot", "cucumber", "dua leo mau", "dua leo baby"],
        // Danh mục có "Ca Chua Chuong (Sweet Pepper)": thực chất là ớt chuông, không phải cà chua.
        ["Ớt chuông"] = ["ot chuong", "ot ngot", "capsicum", "sweet pepper", "bell pepper", "ca chua chuong"],
        ["Ớt"] = ["ot", "ot cay", "chili"],
        ["Dâu tây"] = ["dau tay", "strawberry", "hana", "tochiotome"],
        ["Dưa lưới"] = ["dua luoi", "melon", "muskmelon", "cantaloupe"],
        ["Cải bẹ xanh"] = ["cai be xanh", "mustard green", "mustard greens", "mustard"]
    };

    private static readonly Dictionary<string, string> AliasToCrop = Aliases
        .SelectMany(kv => kv.Value.Append(VietnameseText.Fold(kv.Key)).Select(a => (Alias: a, Crop: kv.Key)))
        .GroupBy(x => x.Alias).ToDictionary(g => g.Key, g => g.First().Crop);

    // Dài trước để "ca chua chuong" thắng "ca chua", "dua leo baby" thắng "dua leo".
    private static readonly string[] AliasesLongestFirst = AliasToCrop.Keys.OrderByDescending(k => k.Length).ToArray();

    private static string Clean(string raw) =>
        Regex.Replace(Regex.Replace(raw ?? string.Empty, @"\([^)]*\)", " "), @"\s+", " ").Trim();

    /// <summary>
    /// Tên chuẩn của một mục cây trồng: khớp nguyên tên, rồi tiền tố từ dài nhất ("Dau Tay Hana" → Dâu tây);
    /// không khớp thì giữ tên đã làm sạch (cây nhập tay qua "Khác" không bị ghép vào cây khác).
    /// </summary>
    public static string Canonical(string raw)
    {
        var cleaned = Clean(raw);
        var key = VietnameseText.Fold(cleaned);
        if (key.Length == 0) return string.Empty;
        if (AliasToCrop.TryGetValue(key, out var exact)) return exact;
        var prefix = AliasesLongestFirst.FirstOrDefault(a => key.StartsWith(a + " ", StringComparison.Ordinal));
        if (prefix is not null) return AliasToCrop[prefix];
        // Cây nhập tay: viết hoa chữ đầu, giữ nguyên phần còn lại.
        return char.ToUpperInvariant(cleaned[0]) + cleaned[1..];
    }

    /// <summary>Chuẩn hóa chuỗi phạm vi áp dụng: tên chuẩn, bỏ trùng (không phân biệt dấu/hoa thường), ngăn cách ", ".</summary>
    public static string NormalizeScope(string? cropScope) =>
        string.Join(", ", (cropScope ?? string.Empty)
            .Split([',', ';', '\n'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(Canonical)
            .Where(c => c.Length > 0)
            .DistinctBy(VietnameseText.Fold));

    /// <summary>Phạm vi áp dụng (danh sách phân tách bằng dấu phẩy) có chứa cây này không, theo tên chuẩn.</summary>
    public static bool ScopeIncludes(string? cropScope, string cropName)
    {
        var target = VietnameseText.Fold(Canonical(cropName));
        if (target.Length == 0) return false;
        return (cropScope ?? string.Empty)
            .Split([',', ';', '\n'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Any(c => VietnameseText.Fold(Canonical(c)) == target);
    }

    /// <summary>
    /// Cây được nhắc rõ trong câu hỏi (theo bảng tên gọi và danh mục Crop, nguyên từ, không dấu), hoặc null.
    /// Dùng khi Zone chưa có vụ mùa: người hỏi nêu rõ tên cây là nguồn có cấu trúc, không đoán từ ghi chú tự do.
    /// </summary>
    public static string? MentionedIn(string text, IEnumerable<string> catalogNames)
    {
        var folded = " " + Regex.Replace(VietnameseText.Fold(text), @"[^\p{L}\p{N}]+", " ") + " ";
        var candidates = AliasesLongestFirst
            .Concat(catalogNames.Select(c => VietnameseText.Fold(Clean(c))).Where(c => c.Length > 1))
            .Distinct()
            .OrderByDescending(c => c.Length);
        var hit = candidates.FirstOrDefault(c => folded.Contains(" " + c + " ", StringComparison.Ordinal));
        return hit is null ? null : Canonical(hit);
    }
}
