namespace SmartFarm.Application.Common.Interfaces;

/// <summary>
/// View-model cho một đoạn tri thức nông học được truy xuất.
/// </summary>
public sealed record KnowledgePassageView(
    Guid ChunkId,
    Guid DocumentId,
    string DocumentTitle,
    string? AuthorOrganization,
    string Category,
    string Content,
    float SimilarityScore,
    int? PageNumber = null,
    string? SectionTitle = null);

/// <summary>
/// Tìm kiếm các đoạn tài liệu nông học phù hợp nhất với câu hỏi
/// bằng pgvector cosine similarity hoặc keyword fallback.
/// </summary>
public interface IAgricultureKnowledgeRetriever
{
    /// <summary>
    /// Nhận câu hỏi và thông tin cây trồng, trả về tối đa <paramref name="topK"/> đoạn tri thức liên quan nhất.
    /// </summary>
    /// <param name="question">Câu hỏi của người dùng (chưa được sanitize — retriever tự giới hạn độ dài).</param>
    /// <param name="cropName">Tên cây trồng để ưu tiên tài liệu phù hợp. Null = không lọc.</param>
    /// <param name="category">Danh mục kỹ thuật ("irrigation","pest","nutrition","climate","general"). Null = tất cả.</param>
    /// <param name="tenantId">Tenant của người dùng để bao gồm tài liệu riêng của tenant.</param>
    /// <param name="topK">Số lượng đoạn văn tối đa trả về (khuyến nghị 3-5).</param>
    /// <param name="cancellationToken">Token huỷ.</param>
    Task<IReadOnlyList<KnowledgePassageView>> RetrievePassagesAsync(
        string question,
        string? cropName,
        string? category,
        Guid? tenantId,
        int topK,
        CancellationToken cancellationToken);
}
