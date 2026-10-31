using SmartFarm.Domain.Entities;

namespace SmartFarm.Application.Common.Interfaces;

public sealed record AgricultureDocumentSummaryView(
    Guid Id,
    string Title,
    string? FileName,
    string FileType,
    string? AuthorOrganization,
    string Category,
    string CropScope,
    string? Version,
    bool IsPublic,
    Guid? TenantId,
    int ChunkCount,
    DateTime CreatedAtUtc,
    string ReviewStatus,
    string? ReviewNotes,
    DateTime? ReviewedAtUtc,
    bool HasOriginalFile,
    string DocumentType = "Unspecified",
    string Topics = "",
    /// <summary>Chủ đề hệ thống tự nhận diện từ nội dung các đoạn (khác với Topics do người tải lên khai báo).</summary>
    string DetectedTopics = "",
    /// <summary>Trạng thái AI kiểm tra chủ đề nông nghiệp (null = chưa có).</summary>
    string? VerificationStatus = null);

public sealed record AgricultureChunkView(
    Guid Id,
    int ChunkIndex,
    string Content,
    string CropTags,
    string Keywords,
    bool HasEmbedding,
    int? PageNumber = null,
    string? SectionTitle = null,
    string Topic = "general");

public sealed record AgricultureDocumentDetailView(
    Guid Id,
    string Title,
    string? FileName,
    string FileType,
    string? AuthorOrganization,
    string Category,
    string CropScope,
    string? Version,
    bool IsPublic,
    Guid? TenantId,
    string ContentText,
    IReadOnlyList<AgricultureChunkView> Chunks,
    DateTime CreatedAtUtc,
    string ReviewStatus,
    string? ReviewNotes,
    DateTime? ReviewedAtUtc,
    bool HasOriginalFile,
    DocumentVerificationResult? Verification = null,
    string DocumentType = "Unspecified",
    string Topics = "",
    DocumentMetadataDetection? MetadataDetection = null,
    /// <summary>Trạng thái rà soát (kể cả Pending khi AI chưa có kết quả).</summary>
    string? VerificationStatus = null);

/// <summary>Bằng chứng nguồn của một giá trị nhận diện: câu trích nguyên văn và số trang nếu file có đánh dấu trang.</summary>
public sealed record MetadataEvidence(string Quote, int? Page);

/// <summary>
/// Một metadata nhận diện từ nội dung. Status: "detected" (có bằng chứng rõ), "uncertain" (suy ra từ bằng chứng gián tiếp,
/// cần người duyệt đối chiếu) hoặc "not_found" (file không có bằng chứng; Value = null, không đoán).
/// </summary>
public sealed record DetectedMetadataField(
    string Status, string? Value, MetadataEvidence? Evidence, double Confidence, IReadOnlyList<string>? Candidates = null);

public sealed record DetectedTopic(string Topic, int ChunkCount, MetadataEvidence Evidence);

/// <summary>
/// Kết quả nhận diện metadata của một tài liệu. Chủ đề là gợi ý để tìm kiếm, không đòi tài liệu có đủ mọi chủ đề.
/// GeneralScopeConfirmed: người duyệt xác nhận tài liệu áp dụng chung (không ghi cây) sau khi đối chiếu file gốc.
/// </summary>
public sealed record DocumentMetadataDetection(
    int RulesVersion,
    DetectedMetadataField Title,
    DetectedMetadataField Crops,
    DetectedMetadataField GeneralScope,
    DetectedMetadataField Publisher,
    DetectedMetadataField StandardCode,
    DetectedMetadataField Version,
    DetectedMetadataField EffectiveDate,
    DetectedMetadataField DocumentType,
    IReadOnlyList<DetectedTopic> Topics,
    bool GeneralScopeConfirmed = false)
{
    public const string Detected = "detected";
    public const string Uncertain = "uncertain";
    public const string NotFound = "not_found";
    public const int CurrentRulesVersion = 1;

    /// <summary>Phạm vi cây đã có căn cứ: có cây nhận diện/được người duyệt chọn, hoặc áp dụng chung có bằng chứng/xác nhận.</summary>
    public bool ScopeResolved(string cropScope) =>
        !string.IsNullOrWhiteSpace(cropScope) || GeneralScopeConfirmed || GeneralScope.Status == Detected;
}

/// <summary>Chỉnh sửa metadata của người duyệt sau khi đối chiếu file gốc; trường null = giữ nguyên.</summary>
public sealed record DocumentMetadataOverrides(
    string? Title, string? CropScope, string? AuthorOrganization, string? Version,
    AgricultureDocumentType? DocumentType, bool ConfirmGeneralScope);

public sealed record AgricultureOriginalFileView(byte[] Content, string FileName, string ContentType);

/// <summary>
/// Quản lý tài liệu nông học trong kho tri thức RAG.
/// </summary>
public interface IAgricultureDocumentService
{
    Task<IReadOnlyList<AgricultureDocumentSummaryView>> GetDocumentsAsync(Guid? tenantId, string? category, CancellationToken cancellationToken);
    Task<AgricultureDocumentDetailView?> GetDocumentByIdAsync(Guid documentId, Guid? tenantId, CancellationToken cancellationToken);
    Task<AgricultureOriginalFileView?> GetOriginalFileAsync(Guid documentId, Guid? tenantId, bool isPlatformAdmin, CancellationToken cancellationToken);
    Task<Guid> IngestDocumentAsync(string title, string fileName, string fileType, byte[] fileBytes, string? authorOrganization, string category, string cropScope, string? version, AgricultureDocumentType documentType, IReadOnlyList<string>? topics, Guid? tenantId, bool isPublic, CancellationToken cancellationToken);
    Task<bool> UpdateDocumentAsync(Guid documentId, string title, string? fileName, string? fileType, byte[]? fileBytes, string? contentText, string? authorOrganization, string category, string cropScope, string? version, Guid? tenantId, bool isPlatformAdmin, CancellationToken cancellationToken);
    Task<bool> ReviewDocumentAsync(Guid documentId, string? contentText, bool approve, string? reviewNotes, Guid? tenantId, bool isPlatformAdmin, DocumentMetadataOverrides? overrides, CancellationToken cancellationToken);
    /// <summary>
    /// Yêu cầu AI kiểm tra lại tài liệu có thuộc lĩnh vực nông nghiệp hay không (đánh dấu Pending, worker nền chạy).
    /// Không ảnh hưởng trạng thái duyệt.
    /// </summary>
    Task<DocumentVerificationResult?> RequestVerificationAsync(Guid documentId, CancellationToken cancellationToken);
    Task<bool> DeleteDocumentAsync(Guid documentId, Guid? tenantId, bool isPlatformAdmin, CancellationToken cancellationToken);
    Task<IReadOnlyList<KnowledgePassageView>> SearchAsync(string query, string? cropName, Guid? tenantId, int topK, CancellationToken cancellationToken);
    Task<int> BackfillEmbeddingsAsync(CancellationToken cancellationToken);
    /// <summary>Chia lại mọi tài liệu theo mục/trang; vector được tạo lại nền cho tài liệu đã duyệt.</summary>
    Task<int> RechunkAllDocumentsAsync(CancellationToken cancellationToken);
    Task SeedVietGapKnowledgeAsync(CancellationToken cancellationToken = default);
    Task<VietGapDraftResult> GenerateVietGapDraftAsync(VietGapDraftRequest request, CancellationToken cancellationToken);
    Task<Guid> IngestTextDocumentAsync(string title, string text, string? authorOrganization, string category, string cropScope, string? version, AgricultureDocumentType documentType, IReadOnlyList<string>? topics, Guid? tenantId, bool isPublic, CancellationToken cancellationToken);

}

/// <summary>Kết quả xác minh độ đầy đủ của tài liệu trước khi lưu vào kho tri thức.</summary>
public sealed record DocumentSufficiencyResult(
    bool IsSufficient,
    string DocumentType,
    IReadOnlyList<string> MissingRequirements,
    IReadOnlyList<string> Issues,
    string Summary,
    string VerifiedBy);

/// <summary>Loại tài liệu, chuyên đề (Category) và việc đã xác định được đơn vị ban hành — quyết định mục bắt buộc.</summary>
public sealed record DocumentValidationContext(AgricultureDocumentType DocumentType, string Category, bool HasSource);

/// <summary>Xác minh tài liệu đủ thông tin trước khi lưu vào kho tri thức RAG.</summary>
public interface IDocumentSufficiencyValidator
{
    Task<DocumentSufficiencyResult> ValidateAsync(string text, DocumentValidationContext context, CancellationToken cancellationToken);
}

/// <summary>Kết quả thẩm định không đạt. Giữ kiểu này để tương thích với các nơi xử lý phản hồi cũ.</summary>
public sealed class DocumentInsufficientException(DocumentSufficiencyResult result)
    : Exception("Tài liệu chưa đủ thông tin theo yêu cầu của hệ thống nên chưa được lưu.")
{
    public DocumentSufficiencyResult Result { get; } = result;
}

/// <summary>Không xác minh được tài liệu (AI không phản hồi); tài liệu không được lưu khi chưa xác minh.</summary>
public sealed class DocumentVerificationUnavailableException(string message, Exception? inner = null)
    : Exception(message, inner);

/// <summary>Đã có tài liệu cùng nội dung trong phạm vi tenant hoặc kho công khai; trả kèm tài liệu đó để mở và sửa tiếp.</summary>
public sealed class DuplicateDocumentException(Guid existingDocumentId, string existingTitle, string existingStatus)
    : Exception($"Tài liệu này đã có trong kho: \"{existingTitle}\" ({existingStatus}). Không lưu bản trùng; hãy mở tài liệu đó để sửa hoặc duyệt.")
{
    public Guid ExistingDocumentId { get; } = existingDocumentId;
    public string ExistingTitle { get; } = existingTitle;
    public string ExistingStatus { get; } = existingStatus;
}

public sealed record VietGapDraftRequest(
    string CropName,
    string StandardCode,
    string Category,
    string? CultivationModel,
    string? AdditionalRequirements);

public sealed record VietGapDraftResult(
    string Title,
    string StandardCode,
    string AuthorOrganization,
    string Category,
    string CropScope,
    string Version,
    string Content,
    bool IsFallback = false,
    string Source = "ai");
