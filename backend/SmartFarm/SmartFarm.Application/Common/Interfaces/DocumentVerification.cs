namespace SmartFarm.Application.Common.Interfaces;

/// <summary>Câu trích nguyên văn từ file đang kiểm tra, kèm số trang nếu file có nhãn [TRANG n].</summary>
public sealed record VerificationQuote(string Quote, int? Page);

/// <summary>
/// Kết quả AI kiểm tra một tài liệu có thuộc lĩnh vực nông nghiệp hay không. Chỉ xác nhận CHỦ ĐỀ của tài liệu: không đối chiếu
/// quy chuẩn, không chứng nhận VietGAP và không quyết định việc duyệt.
/// Status: Pending, Agricultural, NotAgricultural, Uncertain (thiếu bằng chứng trích dẫn hoặc độ tin cậy thấp), VerificationError.
/// </summary>
public sealed record DocumentVerificationResult(
    string Status,
    DateTime CheckedAtUtc,
    string? Model,
    string PromptVersion,
    double Confidence,
    string? DocumentKind,
    string Reason,
    IReadOnlyList<VerificationQuote> Evidence,
    string Message,
    string? ScopeKind = null,
    IReadOnlyList<string>? ScopeCrops = null,
    IReadOnlyList<VerificationQuote>? ScopeEvidence = null,
    string? ScopeReason = null,
    /// <summary>Tên tài liệu AI gợi ý khi file không có dòng tiêu đề rõ; chỉ là gợi ý để người duyệt đối chiếu.</summary>
    string? SuggestedTitle = null)
{
    /// <summary>Phạm vi áp dụng AI gợi ý: chỉ là gợi ý có trích dẫn, người duyệt vẫn là người quyết định.</summary>
    public const string ScopeGeneral = "general";
    public const string ScopeSpecific = "specific";
    public const string ScopeUnknown = "unknown";

    public const string Pending = "Pending";
    public const string Agricultural = "Agricultural";
    public const string NotAgricultural = "NotAgricultural";
    public const string Uncertain = "Uncertain";
    public const string VerificationError = "VerificationError";
}
