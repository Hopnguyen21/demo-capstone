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
    string DocumentType = "OfficialStandard",
    string Topics = "",
    /// <summary>Chủ đề hệ thống tự nhận diện từ nội dung các đoạn (khác với Topics do người tải lên khai báo).</summary>
    string DetectedTopics = "");

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
    VietGapStructuredExtraction? Extraction = null,
    string DocumentType = "OfficialStandard",
    string Topics = "");

/// <summary>
/// Một trường thông tin VietGAP do AI trích từ tài liệu. Value chỉ có khi Evidence là câu trích nguyên văn
/// tìm thấy trong toàn văn; không có trích dẫn khớp thì Value = null (không có trong tài liệu).
/// </summary>
public sealed record VietGapExtractedField(string Key, string Label, string? Value, string? Evidence, int? Page);

public sealed record VietGapExtractedStage(
    int StageOrder, string Name, int? DurationDays, string? TemperatureRange, string? MoistureRange,
    string? Ph, string? Ec, string? FertilizerAction, string? IpmAction, string Evidence, int? Page);

public sealed record VietGapStructuredExtraction(
    IReadOnlyList<VietGapExtractedField> Fields,
    IReadOnlyList<VietGapExtractedStage> Stages,
    string ExtractedBy,
    DateTime ExtractedAtUtc,
    /// <summary>Phiên bản quy tắc kiểm chứng đã tạo kết quả; thấp hơn bản hiện hành thì kết quả cần trích xuất lại.</summary>
    int RulesVersion = 0,
    /// <summary>Trường AI đề xuất nhưng bị loại vì câu trích không có trong tài liệu hoặc số liệu không khớp.</summary>
    IReadOnlyList<string>? RejectedFields = null,
    /// <summary>Số trường AI có đề xuất giá trị (trước khi kiểm chứng).</summary>
    int ProposedCount = 0);

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
    Task<bool> ReviewDocumentAsync(Guid documentId, string? contentText, bool approve, string? reviewNotes, Guid? tenantId, bool isPlatformAdmin, CancellationToken cancellationToken);
    /// <summary>Chạy lại trích xuất có trích dẫn cho tài liệu (ví dụ tài liệu cũ hoặc sau khi sửa toàn văn).</summary>
    Task<VietGapStructuredExtraction?> ReextractDocumentAsync(Guid documentId, CancellationToken cancellationToken);
    Task<bool> DeleteDocumentAsync(Guid documentId, Guid? tenantId, bool isPlatformAdmin, CancellationToken cancellationToken);
    Task<IReadOnlyList<KnowledgePassageView>> SearchAsync(string query, string? cropName, Guid? tenantId, int topK, CancellationToken cancellationToken);
    Task<int> BackfillEmbeddingsAsync(CancellationToken cancellationToken);
    /// <summary>Chia lại mọi tài liệu theo mục/trang; vector được tạo lại nền cho tài liệu đã duyệt.</summary>
    Task<int> RechunkAllDocumentsAsync(CancellationToken cancellationToken);
    Task SeedVietGapKnowledgeAsync(CancellationToken cancellationToken = default);
    Task<VietGapDraftResult> GenerateVietGapDraftAsync(VietGapDraftRequest request, CancellationToken cancellationToken);
    Task<VietGapGrowthProfileDraftResult> GenerateGrowthProfileDraftAsync(VietGapGrowthProfileDraftRequest request, CancellationToken cancellationToken);

    /// <summary>
    /// Gom toàn văn mọi tài liệu đã duyệt áp dụng cho một cây trồng (mỗi tài liệu có tiêu đề nguồn) làm đầu vào Growth Profile.
    /// Null nếu chưa có tài liệu đã duyệt nào cho cây đó.
    /// </summary>
    Task<CropSourceBundle?> BuildCropSourceBundleAsync(string cropName, Guid? tenantId, CancellationToken cancellationToken);
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

public sealed record VietGapGrowthProfileDraftRequest(
    string CropName,
    string? DocumentContent,
    string? CultivationModel,
    int StageCount);

public sealed record GrowthRequirementDraft(
    string ParameterCode,
    decimal MinValue,
    decimal MaxValue,
    decimal TargetValue,
    string Unit,
    string SourceEvidence);

public sealed record GrowthStageDraft(
    int StageOrder,
    string Name,
    int DurationDays,
    string DurationEvidence,
    string Description,
    string DescriptionEvidence,
    string FertilizerAction,
    string FertilizerEvidence,
    string IpmAction,
    string IpmEvidence,
    List<GrowthRequirementDraft> Requirements);

public sealed record VietGapGrowthProfileDraftResult(
    string ProfileName,
    string Description,
    int TotalCycleDays,
    List<GrowthStageDraft> Stages,
    bool IsFallback = false,
    string Source = "ai",
    IReadOnlyList<string>? SourceDocuments = null);

/// <summary>Toàn văn ghép từ nhiều tài liệu đã duyệt cho một cây trồng, kèm danh sách nguồn để gắn trích dẫn.</summary>
public sealed record CropSourceBundle(string CombinedContent, IReadOnlyList<CropSourceDocument> Documents);

public sealed record CropSourceDocument(Guid Id, string Title, string? AuthorOrganization, string ContentText);
