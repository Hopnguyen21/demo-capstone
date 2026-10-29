using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace SmartFarm.Infrastructure.Ai.Knowledge;

/// <summary>
/// So khớp tiếng Việt không phụ thuộc dấu: nhiều tài liệu (bản gõ không dấu, file xuất từ hệ thống cũ, OCR)
/// viết "ngay", "thu hoach" thay cho "ngày", "thu hoạch". Mọi từ khóa và văn bản được bỏ dấu trước khi so.
/// </summary>
public static class VietnameseText
{
    /// <summary>Bỏ dấu, đổi đ→d và về chữ thường. Ký tự ASCII (gồm cú pháp regex) giữ nguyên.</summary>
    public static string Fold(string? text)
    {
        if (string.IsNullOrEmpty(text)) return string.Empty;
        var decomposed = text.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(decomposed.Length);
        foreach (var ch in decomposed)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) == UnicodeCategory.NonSpacingMark) continue;
            sb.Append(ch switch { 'đ' => 'd', 'Đ' => 'd', _ => char.ToLowerInvariant(ch) });
        }
        return sb.ToString().Normalize(NormalizationForm.FormC);
    }

    /// <summary>Regex viết bằng tiếng Việt có dấu, so trên văn bản đã <see cref="Fold"/>.</summary>
    public static Regex FoldedRegex(string pattern) =>
        new(Fold(pattern), RegexOptions.CultureInvariant | RegexOptions.Compiled);

    private static readonly Regex DayRange = new(@"(\d+)\s*[-–]\s*(\d+)\s*(?:ngay|days?)\b", RegexOptions.CultureInvariant);

    /// <summary>
    /// Câu trích nêu số ngày: "7 ngày"/"7 ngay", một đầu của khoảng "7 - 10 ngày", hoặc thời lượng của khoảng
    /// ngày trong chu kỳ ("21 - 50 ngày" = giai đoạn 30 ngày).
    /// </summary>
    public static bool DaysStated(string evidence, int days)
    {
        var folded = Fold(evidence);
        if (Regex.IsMatch(folded, $@"(?<![\d.,]){days}(?:\s*[-–]\s*\d+)?\s*(?:ngay|days?)\b|\d+\s*[-–]\s*{days}\s*(?:ngay|days?)\b"))
            return true;
        foreach (Match m in DayRange.Matches(folded))
        {
            var start = int.Parse(m.Groups[1].Value, CultureInfo.InvariantCulture);
            var end = int.Parse(m.Groups[2].Value, CultureInfo.InvariantCulture);
            if (end > start && (end - start + 1 == days || end - start == days)) return true;
        }
        return false;
    }
}
