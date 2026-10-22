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

    /// <summary>Tenant sở hữu. Null = tài liệu công khai toàn nền tảng.</summary>
    public Guid? TenantId { get; set; }

    public ICollection<AgricultureKnowledgeChunk> Chunks { get; } = new List<AgricultureKnowledgeChunk>();
}

/// <summary>
/// Một đoạn văn bản (chunk) được chia nhỏ từ AgricultureDocument.
/// Embedding được lưu dưới dạng pgvector <see cref="Vector"/> (768 chiều — text-embedding-004).
/// </summary>
public sealed class AgricultureKnowledgeChunk : AuditableEntity
{
    public Guid DocumentId { get; set; }
    public AgricultureDocument Document { get; set; } = null!;

    /// <summary>Thứ tự chunk trong tài liệu (0-based).</summary>
    public int ChunkIndex { get; set; }

    /// <summary>Nội dung đoạn văn bản.</summary>
    public string Content { get; set; } = string.Empty;

    /// <summary>
    /// Embedding vector 768 chiều (Gemini text-embedding-004).
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
