namespace SmartFarm.Infrastructure.Ai.Knowledge;

/// <summary>
/// Chuẩn hóa tên cây trồng ghi trong phạm vi áp dụng của tài liệu (khớp frontend/src/pages/admin/cropNames.ts).
/// Tài liệu ghi cùng một cây theo nhiều cách: có/không dấu, tiếng Anh, tên giống, kèm nhóm trong ngoặc.
/// </summary>
public static class CropNames
{
    private static readonly Dictionary<string, string[]> Aliases = new()
    {
        ["Cà chua"] = ["ca chua", "tomato", "ca chua beefsteak", "ca chua cherry"],
        ["Xà lách"] = ["xa lach", "lettuce", "batavia", "lolo", "xa lach cuon", "xa lach thuy canh", "xa lach lolo"],
        ["Dưa leo"] = ["dua leo", "dua chuot", "cucumber", "dua leo mau", "dua leo baby"],
        ["Ớt chuông"] = ["ot chuong", "ot ngot", "capsicum", "sweet pepper", "bell pepper"],
        ["Ớt"] = ["ot", "ot cay", "chili"],
        ["Dâu tây"] = ["dau tay", "strawberry", "hana", "tochiotome"],
        ["Dưa lưới"] = ["dua luoi", "melon", "cantaloupe"],
        ["Cải bẹ xanh"] = ["cai be xanh", "mustard green", "mustard"]
    };

    private static readonly Dictionary<string, string> AliasToCrop = Aliases
        .SelectMany(kv => kv.Value.Append(VietnameseText.Fold(kv.Key)).Select(a => (Alias: a, Crop: kv.Key)))
        .GroupBy(x => x.Alias).ToDictionary(g => g.Key, g => g.First().Crop);

    /// <summary>Tên chuẩn của một mục cây trồng, hoặc chính tên đó (bỏ ngoặc, bỏ dấu khi so) nếu không có trong bảng.</summary>
    public static string Canonical(string raw)
    {
        var cleaned = System.Text.RegularExpressions.Regex.Replace(raw ?? string.Empty, @"\([^)]*\)", " ").Trim();
        var key = VietnameseText.Fold(System.Text.RegularExpressions.Regex.Replace(cleaned, @"\s+", " "));
        return AliasToCrop.TryGetValue(key, out var crop) ? crop : cleaned;
    }

    /// <summary>Phạm vi áp dụng (danh sách phân tách bằng dấu phẩy) có chứa cây này không, theo tên chuẩn.</summary>
    public static bool ScopeIncludes(string? cropScope, string cropName)
    {
        var target = VietnameseText.Fold(Canonical(cropName));
        return (cropScope ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Any(c => VietnameseText.Fold(Canonical(c)) == target);
    }
}
