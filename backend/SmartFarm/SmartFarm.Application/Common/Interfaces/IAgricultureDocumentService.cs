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
    DateTime CreatedAtUtc);

public sealed record AgricultureChunkView(
    Guid Id,
    int ChunkIndex,
    string Content,
    string CropTags,
    string Keywords,
    bool HasEmbedding);

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
    DateTime CreatedAtUtc);

/// <summary>
/// Quản lý tài liệu nông học trong kho tri thức RAG.
/// </summary>
public interface IAgricultureDocumentService
{
    Task<IReadOnlyList<AgricultureDocumentSummaryView>> GetDocumentsAsync(Guid? tenantId, string? category, CancellationToken cancellationToken);
    Task<AgricultureDocumentDetailView?> GetDocumentByIdAsync(Guid documentId, Guid? tenantId, CancellationToken cancellationToken);
    Task<Guid> IngestDocumentAsync(string title, string fileName, string fileType, byte[] fileBytes, string? authorOrganization, string category, string cropScope, Guid? tenantId, bool isPublic, CancellationToken cancellationToken);
    Task<bool> DeleteDocumentAsync(Guid documentId, Guid? tenantId, CancellationToken cancellationToken);
    Task<IReadOnlyList<KnowledgePassageView>> SearchAsync(string query, string? cropName, Guid? tenantId, int topK, CancellationToken cancellationToken);
    Task<int> BackfillEmbeddingsAsync(CancellationToken cancellationToken);
    Task SeedVietGapKnowledgeAsync(CancellationToken cancellationToken = default);
}
