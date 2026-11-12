namespace SmartFarm.Infrastructure.Ai.Location;

/// <summary>
/// Văn bản ĐÃ được che dữ liệu cá nhân. Không có hàm khởi tạo công khai nhận chuỗi thô: cách duy nhất để có giá trị này là đi qua
/// bộ che (<see cref="Question"/>, <see cref="FreeText"/>, <see cref="Document"/>). Các hàm ghi bản chụp vào DB và gọi AI nhận kiểu này,
/// nên muốn dùng nhầm câu hỏi gốc thì không biên dịch được.
/// </summary>
public readonly struct SanitizedText
{
    private readonly string? value;
    private SanitizedText(string clean) => value = clean;

    public string Value => value ?? string.Empty;

    public static SanitizedText Question(string? raw) => new(AiPrivacySanitizer.SanitizeUserQuestion(raw));
    public static SanitizedText FreeText(string? raw) => new(AiPrivacySanitizer.SanitizeFreeText(raw));
    public static SanitizedText Document(string? raw) => new(AiPrivacySanitizer.SanitizeDocumentText(raw));

    public override string ToString() => Value;
}
