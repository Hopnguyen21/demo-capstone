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
        @"(?i)\b(tôi là|ôi là|toi la|tui là|tên tôi là|tên tui là|mình là|chúng tôi là|em là)\s+([A-ZÀ-Ỹa-zà-ỹ]+(?:\s+[A-ZÀ-Ỹa-zà-ỹ]+){0,3})\b",
        RegexOptions.Compiled);

    // Họ tên người Việt bắt đầu bằng họ phổ biến + 1-3 từ viết hoa ("Nguyễn Văn An"), kể cả khi người dùng gõ sai/không có cụm tự xưng.
    private static readonly Regex SurnameNamePattern = new(
        @"\b(?:Nguyễn|Trần|Lê|Phạm|Hoàng|Huỳnh|Phan|Vũ|Võ|Đặng|Bùi|Đỗ|Hồ|Ngô|Dương|Lý)(?:\s+[A-ZÀ-Ỹ][a-zà-ỹ]+){1,3}\b",
        RegexOptions.Compiled);

    // Xưng hô + họ tên ("ông Nguyễn Văn A", "chị Lan"), hoặc nhãn "họ tên:" / "tên:" / "liên hệ:"
    private static readonly Regex HonorificNamePattern = new(
        @"\b(ông|bà|anh|chị|cô|chú|bác|thầy|cậu)\s+([A-ZÀ-Ỹ][a-zà-ỹ]+(?:\s+[A-ZÀ-Ỹ][a-zà-ỹ]+){0,3})",
        RegexOptions.Compiled);

    private static readonly Regex LabeledNamePattern = new(
        @"(?i)\b(họ\s*(?:và\s*)?tên|tên|liên hệ|người liên hệ)\s*:\s*([A-ZÀ-Ỹa-zà-ỹ]+(?:\s+[A-ZÀ-Ỹa-zà-ỹ]+){0,3})",
        RegexOptions.Compiled);

    // Địa chỉ có nhãn ("địa chỉ: ...") hoặc đơn vị hành chính cấp cơ sở (xã/phường/thôn/ấp/xóm/khu phố + tên)
    private static readonly Regex LabeledAddressPattern = new(
        @"(?i)\b(địa chỉ|đ/c|ở tại|sống tại)\s*:?\s*[^.;\n]{3,80}|\b(?:xã|phường|thị trấn|thôn|ấp|xóm|khu phố|tổ dân phố)\s+[A-ZÀ-Ỹa-zà-ỹ0-9]+(?:\s+[A-ZÀ-Ỹa-zà-ỹ0-9]+){0,2}",
        RegexOptions.Compiled);

    // Số điện thoại viết kèm nhãn ("sđt", "điện thoại", "zalo") với khoảng trắng/dấu chấm tuỳ ý
    private static readonly Regex LabeledPhonePattern = new(
        @"(?i)\b(?:sđt|sdt|điện thoại|dt|zalo|hotline)\s*:?\s*[+0-9][0-9 .\-]{6,16}[0-9]",
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
        clean = LabeledPhonePattern.Replace(clean, "[sđt]");
        clean = LabeledNamePattern.Replace(clean, "$1: [tên]");
        clean = HonorificNamePattern.Replace(clean, "$1 [tên]");
        clean = LabeledAddressPattern.Replace(clean, "[địa chỉ]");
        clean = SpecificAddressPattern.Replace(clean, "[địa chỉ]");
        clean = SurnameNamePattern.Replace(clean, "[tên]");

        return clean;
    }

    // Chỉ nhãn địa chỉ tường minh ("địa chỉ: ..."), không đụng các từ hành chính thường gặp trong tài liệu nông nghiệp (hợp tác xã...).
    private static readonly Regex ExplicitAddressLabelPattern = new(
        @"(?i)\b(địa chỉ|đ/c|ở tại|sống tại)\s*:\s*[^.;\n]{3,80}",
        RegexOptions.Compiled);

    /// <summary>
    /// Làm sạch nội dung TÀI LIỆU (đoạn văn, văn bản trích) trước khi gửi ra dịch vụ AI bên thứ ba (embedding, kiểm tra, trích xuất).
    /// Thận trọng hơn với câu hỏi: không che xưng hô + chữ hoa hay từ hành chính chung để không phá nội dung kỹ thuật
    /// (vd. "Bà Rịa - Vũng Tàu", "hợp tác xã"). Chỉ che dữ liệu định danh rõ ràng: email, CCCD, điện thoại, họ tên/địa chỉ có nhãn.
    /// </summary>
    public static string SanitizeDocumentText(string? text)
    {
        if (string.IsNullOrEmpty(text)) return string.Empty;
        var clean = EmailPattern.Replace(text, "[email]");
        clean = NationalIdPattern.Replace(clean, "[cccd]");
        clean = PhonePattern.Replace(clean, "[sđt]");
        clean = LabeledPhonePattern.Replace(clean, "[sđt]");
        clean = LabeledNamePattern.Replace(clean, "$1: [tên]");
        clean = ExplicitAddressLabelPattern.Replace(clean, "[địa chỉ]");
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
        clean = LabeledPhonePattern.Replace(clean, "[sđt]");
        clean = LabeledNamePattern.Replace(clean, "$1: [tên]");
        clean = HonorificNamePattern.Replace(clean, "$1 [tên]");
        clean = LabeledAddressPattern.Replace(clean, "[địa chỉ]");
        clean = SpecificAddressPattern.Replace(clean, "[địa chỉ]");
        clean = SurnameNamePattern.Replace(clean, "[tên]");

        return clean.Trim();
    }
}
