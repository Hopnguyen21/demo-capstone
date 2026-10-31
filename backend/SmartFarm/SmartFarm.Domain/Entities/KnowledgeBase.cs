using Pgvector;
using SmartFarm.Domain.Common;

namespace SmartFarm.Domain.Entities;

/// <summary>
/// Đại diện một tài liệu nông học (VietGAP, hướng dẫn canh tác, phòng trừ sâu bệnh, quy trình tưới tiêu).
/// Tài liệu được lưu kèm toàn bộ nội dung trích xuất và phân quyền truy cập.
/// </summary>
public sealed class AgricultureDocument : AuditableEntity
{
    /// <summary>Tiêu đề tài liệu. VD: "Quy trình VietGAP cho cà chua nhà màng".</summary>
    public string Title { get; set; } = string.Empty;

    /// <summary>Tên file gốc (PDF/DOCX/TXT). Null nếu là nội dung nhập trực tiếp.</summary>
    public string? FileName { get; set; }

    /// <summary>File gốc lưu byte-for-byte để người dùng đối chiếu nội dung OCR/trích xuất.</summary>
    public byte[]? OriginalFileBytes { get; set; }

    public string? OriginalFileContentType { get; set; }

    /// <summary>Loại file: "pdf", "docx", "txt", "seed" (dữ liệu khởi tạo hệ thống).</summary>
    public string FileType { get; set; } = "seed";

    /// <summary>Toàn bộ nội dung văn bản đã trích xuất từ tài liệu.</summary>
    public string ContentText { get; set; } = string.Empty;

    /// <summary>Tác giả / tổ chức phát hành. VD: "Bộ NN&PTNT", "VietGAP".</summary>
    public string? AuthorOrganization { get; set; }

    /// <summary>Danh mục kỹ thuật. VD: "irrigation", "pest", "nutrition", "climate", "general".</summary>
    public string Category { get; set; } = "general";

    /// <summary>Phạm vi cây trồng, phân cách bởi dấu phẩy. Rỗng = áp dụng cho tất cả cây trồng.</summary>
    public string CropScope { get; set; } = string.Empty;

    /// <summary>Phiên bản hoặc năm ban hành tài liệu.</summary>
    public string? Version { get; set; }

    /// <summary>true = tài liệu cấp nền tảng dùng chung. false = chỉ tenant cụ thể.</summary>
    public bool IsPublic { get; set; } = true;

    // Không mặc định OfficialStandard: loại chưa phân biệt được từ nội dung thì để người duyệt quyết định.
    public AgricultureDocumentType DocumentType { get; set; } = AgricultureDocumentType.Unspecified;

    /// <summary>Chỉ tài liệu đã được người dùng rà soát mới được dùng làm nguồn cho RAG.</summary>
    public AgricultureDocumentReviewStatus ReviewStatus { get; set; } = AgricultureDocumentReviewStatus.PendingReview;

    /// <summary>Ghi chú của người rà soát, nếu có.</summary>
    public string? ReviewNotes { get; set; }

    public DateTime? ReviewedAtUtc { get; set; }

    /// <summary>
    /// Kết quả AI trích các trường VietGAP kèm câu trích nguyên văn (JSON). Null = chưa trích hoặc toàn văn đã đổi
    /// sau lần trích gần nhất, cần chạy lại.
    /// </summary>
    public string? StructuredExtractionJson { get; set; }

    /// <summary>
    /// Kết quả nhận diện metadata từ nội dung (JSON: giá trị, trạng thái detected/uncertain/not_found, bằng chứng, độ tin cậy).
    /// Null với tài liệu nạp trước khi có tính năng này.
    /// </summary>
    public string? MetadataDetectionJson { get; set; }

    /// <summary>
    /// Trạng thái AI kiểm tra tài liệu có thuộc lĩnh vực nông nghiệp hay không: Pending, Agricultural, NotAgricultural, Uncertain,
    /// VerificationError. Null với tài liệu nạp trước khi có tính năng. Chỉ xác nhận chủ đề, không phải chứng nhận VietGAP và
    /// không quyết định việc duyệt: chỉ người quản trị duyệt.
    /// </summary>
    public string? VerificationStatus { get; set; }

    /// <summary>Kết quả kiểm tra chủ đề (JSON): nhận định, độ tin cậy, lý do, câu trích nguyên văn từ file, model, thời điểm.</summary>
    public string? VerificationJson { get; set; }

    public DateTime? VerificationAttemptedAtUtc { get; set; }

    /// <summary>Thời điểm worker nền đã thử trích xuất (thành công hoặc lỗi). Null = chưa thử; worker sẽ xử lý.</summary>
    public DateTime? ExtractionAttemptedAtUtc { get; set; }

    /// <summary>Phiên bản quy tắc kiểm chứng của lần trích xuất gần nhất; thấp hơn bản hiện hành thì worker trích xuất lại.</summary>
    public int ExtractionRulesVersion { get; set; }

    /// <summary>
    /// Phiên bản bộ chia đoạn đã tạo chunk hiện tại. Thấp hơn phiên bản hiện hành thì worker nền tự chia lại
    /// (tài liệu nạp trước khi có chia theo mục/trang/chủ đề).
    /// </summary>
    public int ChunkerVersion { get; set; }

    /// <summary>SHA-256 của toàn văn đã chuẩn hóa, dùng để chặn tải trùng cùng một tài liệu.</summary>
    public string? ContentHash { get; set; }

    /// <summary>Các chủ đề tài liệu bao quát (irrigation, pest, nutrition, harvest, record, climate, soil), phân tách bằng dấu phẩy.</summary>
    public string Topics { get; set; } = string.Empty;

    /// <summary>Bản mới đã duyệt thay thế tài liệu này (cùng tên và đơn vị ban hành). Tài liệu bị thay thế không còn dùng cho RAG.</summary>
    public Guid? SupersededByDocumentId { get; set; }

    /// <summary>Tenant sở hữu. Null = tài liệu công khai toàn nền tảng.</summary>
    public Guid? TenantId { get; set; }

    public ICollection<AgricultureKnowledgeChunk> Chunks { get; } = new List<AgricultureKnowledgeChunk>();
}

/// <summary>
/// Loại tài liệu quyết định danh sách mục bắt buộc khi kiểm tra độ đầy đủ (SDD: kho chứa cả VietGAP,
/// hướng dẫn kỹ thuật và tài liệu chuyên đề như tưới, phòng trừ sâu bệnh).
/// </summary>
public enum AgricultureDocumentType
{
    // Non-zero vì cùng lý do với ReviewStatus: EF không nhầm giá trị đầu tiên là "chưa gán".
    /// <summary>Tiêu chuẩn/quy chuẩn chính thức (TCVN, QCVN, VietGAP): phải có đủ các mục VietGAP cốt lõi.</summary>
    OfficialStandard = 1,
    /// <summary>Hướng dẫn/quy trình kỹ thuật canh tác (khuyến nông, sở nông nghiệp): cần nguồn và nội dung canh tác.</summary>
    TechnicalGuide = 2,
    /// <summary>Tài liệu chuyên đề (tưới, IPM, dinh dưỡng...): chỉ cần nguồn và mục của đúng chuyên đề (theo Category).</summary>
    Thematic = 3,
    /// <summary>Chưa phân biệt được từ nội dung; người duyệt phải chọn loại trước khi duyệt.</summary>
    Unspecified = 4
}

public enum AgricultureDocumentReviewStatus
{
    // Use non-zero values so EF does not mistake PendingReview for an unset CLR default
    // and omit it in favor of the database default (Approved for migrated legacy rows).
    PendingReview = 1,
    Approved = 2,
    NeedsCorrection = 3,
    /// <summary>Đã có phiên bản mới được duyệt; giữ lại để truy vết, không dùng cho RAG.</summary>
    Superseded = 4
}

/// <summary>
/// Một đoạn văn bản (chunk) được chia nhỏ từ AgricultureDocument.
/// Embedding được lưu dưới dạng pgvector <see cref="Vector"/> (768 chiều — gemini-embedding-001).
/// </summary>
public sealed class AgricultureKnowledgeChunk : AuditableEntity
{
    public Guid DocumentId { get; set; }
    public AgricultureDocument Document { get; set; } = null!;

    /// <summary>Thứ tự chunk trong tài liệu (0-based).</summary>
    public int ChunkIndex { get; set; }

    /// <summary>Nội dung đoạn văn bản.</summary>
    public string Content { get; set; } = string.Empty;

    /// <summary>Trang đầu tiên của đoạn (theo nhãn [TRANG n]); null nếu tài liệu không có thông tin trang.</summary>
    public int? PageNumber { get; set; }

    /// <summary>Tiêu đề mục chứa đoạn (VD "7. Thu hoạch"), để trích nguồn tới mục theo SRS 3.4.</summary>
    public string? SectionTitle { get; set; }

    /// <summary>Chủ đề của đoạn (suy ra từ tiêu đề mục/nội dung), để ưu tiên đoạn đúng chủ đề câu hỏi.</summary>
    public string Topic { get; set; } = "general";

    /// <summary>
    /// Embedding vector 768 chiều (Gemini gemini-embedding-001).
    /// Null khi chưa được tạo embedding.
    /// </summary>
    public Vector? Embedding { get; set; }

    /// <summary>Tag cây trồng để tiền lọc trước vector search. VD: "cà chua,dâu tây".</summary>
    public string CropTags { get; set; } = string.Empty;

    /// <summary>Từ khóa chính của đoạn văn, hỗ trợ keyword-based scoring khi embedding chưa có.</summary>
    public string Keywords { get; set; } = string.Empty;

    /// <summary>Trạng thái vector hóa của chunk.</summary>
    public KnowledgeChunkStatus Status { get; set; } = KnowledgeChunkStatus.Pending;
}

public enum KnowledgeChunkStatus
{
    Pending = 0,
    Completed = 1,
    Failed = 2
}
