using System.Text.RegularExpressions;

namespace SmartFarm.Infrastructure.Ai.Location;

/// <summary>
/// Bộ chuẩn hóa và giảm thiểu dữ liệu nhạy cảm (PII / Vị trí / Định danh cá nhân)
/// được áp dụng tập trung trước MỌI lời gọi ra mô hình Gemini (Intent Classifier, Prompt Builder, v.v.).
/// Giữ nguyên các số đo kỹ thuật, thông số nông học chuyên môn và đơn vị đo.
/// </summary>
public static class AiPrivacySanitizer
{
    private static readonly Regex EmailPattern = new(
        @"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}",
        RegexOptions.Compiled);

    // CCCD (12 chữ số) hoặc CMND (9 chữ số) khi có từ khóa
    private static readonly Regex NationalIdPattern = new(
        @"\b\d{12}\b|(?i)\b(?:cccd|cmnd|căn cước|chứng minh)\s*:?\s*\d{9}\b",
        RegexOptions.Compiled);

    // Số điện thoại Việt Nam (10 chữ số bắt đầu bằng 0 hoặc +84)
    private static readonly Regex PhonePattern = new(
        @"(?:\+84|0)(?:3[2-9]|5[689]|7[06-9]|8[1-9]|9[0-9])[0-9]{7}\b|(?:\+84|0)(?:[0-9][ -.]?){8}[0-9]\b",
        RegexOptions.Compiled);

    // Mã số hợp đồng hoặc văn bản hợp đồng (HD-xxx, HĐ-xxx)
    private static readonly Regex ContractCodePattern = new(
        @"(?i)\b(?:hđ|hd|hợp đồng|hop dong)\s*[:#-]?\s*[a-z0-9_\/-]{3,25}\b",
        RegexOptions.Compiled);

    // Tự xưng danh tính cá nhân ("Tôi là Tuấn", "Tên tôi là Nguyễn Văn A")
    private static readonly Regex PersonalNameIntroPattern = new(
        @"(?i)\b(tôi là|tên tôi là|mình là|chúng tôi là|em là)\s+([A-ZÀ-Ỹa-zà-ỹ]+(?:\s+[A-ZÀ-Ỹa-zà-ỹ]+){0,3})\b",
        RegexOptions.Compiled);

    // Địa chỉ nhà chi tiết (số nhà, ngõ ngách, tên đường cụ thể)
    private static readonly Regex SpecificAddressPattern = new(
        @"(?i)\b(?:số\s*\d+[a-zA-Z]?(?:\s*\/\s*\d+)*|ngõ\s*\d+|ngách\s*\d+|hẻm\s*\d+)\s*(?:đường|phố)?\s*([a-zA-Zà-ỹÀ-Ỹ0-9\s]{2,35})?(?=,|\.|\b)",
        RegexOptions.Compiled);

    /// <summary>
    /// Làm sạch câu hỏi người dùng trước khi gửi cho Gemini (bao gồm cả bước Intent Classification).
    /// Thay thế các thông tin nhạy cảm bằng các placeholder tiêu chuẩn: [email], [sđt], [cccd], [hợp đồng], [tên], [địa chỉ].
    /// </summary>
    public static string SanitizeUserQuestion(string? question)
    {
        if (string.IsNullOrWhiteSpace(question)) return string.Empty;

        var clean = question;
        clean = EmailPattern.Replace(clean, "[email]");
        // Chạy National ID trước Phone để không bị Phone bắt nhầm 10 số đầu của dãy 12 số
        clean = NationalIdPattern.Replace(clean, "[cccd]");
        clean = PhonePattern.Replace(clean, "[sđt]");
        clean = ContractCodePattern.Replace(clean, "[hợp đồng]");
        clean = PersonalNameIntroPattern.Replace(clean, "$1 [tên]");
        clean = SpecificAddressPattern.Replace(clean, "[địa chỉ]");

        return clean;
    }

    /// <summary>
    /// Làm sạch các trường tự do do người dùng nhập (Tên Zone, Nhãn thiết bị, Tiêu đề cảnh báo, Quy tắc, Công việc, Vụ mùa)
    /// trước khi đưa vào ngữ cảnh gửi cho AI.
    /// </summary>
    public static string SanitizeFreeText(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return string.Empty;

        var clean = text;
        clean = EmailPattern.Replace(clean, "[email]");
        clean = NationalIdPattern.Replace(clean, "[cccd]");
        clean = PhonePattern.Replace(clean, "[sđt]");
        clean = ContractCodePattern.Replace(clean, "[hợp đồng]");
        clean = SpecificAddressPattern.Replace(clean, "[địa chỉ]");

        return clean.Trim();
    }
}
