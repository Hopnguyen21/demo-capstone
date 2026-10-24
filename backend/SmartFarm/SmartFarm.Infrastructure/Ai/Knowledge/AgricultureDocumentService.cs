using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pgvector;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Domain.Entities;
using SmartFarm.Infrastructure.Persistence;

namespace SmartFarm.Infrastructure.Ai.Knowledge;

public sealed class AgricultureDocumentService(
    SmartFarmDbContext db,
    GeminiEmbeddingProvider embedding,
    IAgricultureKnowledgeRetriever retriever,
    ILogger<AgricultureDocumentService> logger) : IAgricultureDocumentService
{
    private static readonly HashSet<string> Categories =
        ["general", "irrigation", "pest", "nutrition", "climate", "harvest", "record"];

    private static readonly string[] KnownCrops =
        ["cà chua", "dưa leo", "dưa chuột", "ớt", "xà lách", "rau muống", "cải", "dưa lưới", "dâu tây", "lúa", "cà phê", "hồ tiêu"];

    public async Task<IReadOnlyList<AgricultureDocumentSummaryView>> GetDocumentsAsync(
        Guid? tenantId, string? category, CancellationToken ct)
    {
        var q = db.AgricultureDocuments.AsNoTracking()
            .Where(d => d.IsPublic || (tenantId != null && d.TenantId == tenantId));
        if (!string.IsNullOrWhiteSpace(category)) q = q.Where(d => d.Category == category);

        return await q.OrderByDescending(d => d.CreatedAtUtc)
            .Select(d => new AgricultureDocumentSummaryView(
                d.Id, d.Title, d.FileName, d.FileType, d.AuthorOrganization, d.Category,
                d.CropScope, d.Version, d.IsPublic, d.TenantId, d.Chunks.Count, d.CreatedAtUtc))
            .ToListAsync(ct);
    }

    public async Task<AgricultureDocumentDetailView?> GetDocumentByIdAsync(Guid documentId, Guid? tenantId, CancellationToken ct)
    {
        var d = await db.AgricultureDocuments.AsNoTracking()
            .Where(x => x.Id == documentId && (x.IsPublic || (tenantId != null && x.TenantId == tenantId)))
            .Select(x => new
            {
                x.Id, x.Title, x.FileName, x.FileType, x.AuthorOrganization, x.Category,
                x.CropScope, x.Version, x.IsPublic, x.TenantId, x.ContentText, x.CreatedAtUtc
            })
            .FirstOrDefaultAsync(ct);
        if (d is null) return null;

        // Không kéo cột embedding về, chỉ kiểm tra IS NOT NULL
        var chunks = await db.AgricultureKnowledgeChunks.AsNoTracking()
            .Where(c => c.DocumentId == documentId)
            .OrderBy(c => c.ChunkIndex)
            .Select(c => new AgricultureChunkView(c.Id, c.ChunkIndex, c.Content, c.CropTags, c.Keywords, c.Embedding != null))
            .ToListAsync(ct);

        return new AgricultureDocumentDetailView(d.Id, d.Title, d.FileName, d.FileType, d.AuthorOrganization,
            d.Category, d.CropScope, d.Version, d.IsPublic, d.TenantId, d.ContentText, chunks, d.CreatedAtUtc);
    }

    public async Task<Guid> IngestDocumentAsync(
        string title, string fileName, string fileType, byte[] fileBytes,
        string? authorOrganization, string category, string cropScope,
        Guid? tenantId, bool isPublic, CancellationToken ct)
    {
        title = (title ?? string.Empty).Trim();
        if (title.Length is < 3 or > 300) throw new ArgumentException("Tiêu đề phải từ 3 đến 300 ký tự.");
        category = Categories.Contains(category?.ToLowerInvariant() ?? "") ? category!.ToLowerInvariant() : "general";

        var text = DocumentTextExtractor.Extract(fileBytes, fileType);
        return await CreateDocumentAsync(title, fileName, fileType, text, authorOrganization, category,
            cropScope, null, tenantId, isPublic, ct);
    }

    private async Task<Guid> CreateDocumentAsync(
        string title, string? fileName, string fileType, string text, string? author,
        string category, string cropScope, string? version, Guid? tenantId, bool isPublic, CancellationToken ct)
    {
        var doc = new AgricultureDocument
        {
            Title = title, FileName = fileName, FileType = fileType, ContentText = text,
            AuthorOrganization = author, Category = category, CropScope = cropScope?.Trim() ?? string.Empty,
            Version = version, TenantId = tenantId, IsPublic = isPublic
        };

        var pieces = TextChunker.Chunk(text);
        for (var i = 0; i < pieces.Count; i++)
        {
            doc.Chunks.Add(new AgricultureKnowledgeChunk
            {
                ChunkIndex = i,
                Content = pieces[i],
                Keywords = ExtractKeywords(pieces[i]),
                CropTags = DetectCrops(pieces[i], doc.CropScope),
                Status = KnowledgeChunkStatus.Pending
            });
        }

        db.AgricultureDocuments.Add(doc);
        await db.SaveChangesAsync(ct);

        // Embedding lỗi không làm mất tài liệu: chunk để Pending/Failed, backfill sau.
        try { await EmbedChunksAsync(db.AgricultureKnowledgeChunks.Where(c => c.DocumentId == doc.Id), ct); }
        catch (Exception ex) when (ex is not OperationCanceledException)
        { logger.LogWarning(ex, "[RAG] Embedding failed for document {Id}; use backfill later.", doc.Id); }

        return doc.Id;
    }

    public async Task<bool> DeleteDocumentAsync(Guid documentId, Guid? tenantId, bool isPlatformAdmin, CancellationToken ct)
    {
        var q = db.AgricultureDocuments.Where(d => d.Id == documentId);
        if (!isPlatformAdmin)
        {
            if (tenantId is null) return false;
            q = q.Where(d => d.TenantId == tenantId);
        }

        var doc = await q.FirstOrDefaultAsync(ct);
        if (doc is null) return false;
        db.AgricultureDocuments.Remove(doc); // cascade xóa chunks
        await db.SaveChangesAsync(ct);
        return true;
    }

    public Task<IReadOnlyList<KnowledgePassageView>> SearchAsync(string query, string? cropName, Guid? tenantId, int topK, CancellationToken ct) =>
        retriever.RetrievePassagesAsync(query, cropName, null, tenantId, topK, ct);

    public async Task<int> BackfillEmbeddingsAsync(CancellationToken ct) =>
        await EmbedChunksAsync(db.AgricultureKnowledgeChunks
            .Where(c => c.Status == KnowledgeChunkStatus.Pending || c.Status == KnowledgeChunkStatus.Failed), ct);

    private async Task<int> EmbedChunksAsync(IQueryable<AgricultureKnowledgeChunk> source, CancellationToken ct)
    {
        if (!embedding.IsAvailable) return 0;
        var done = 0;
        const int batch = 20;

        while (true)
        {
            var chunks = await source
                .Where(c => c.Status != KnowledgeChunkStatus.Completed)
                .OrderBy(c => c.DocumentId).ThenBy(c => c.ChunkIndex)
                .Take(batch).ToListAsync(ct);
            if (chunks.Count == 0) break;

            var progressed = false;
            foreach (var c in chunks)
            {
                try
                {
                    c.Embedding = new Vector(await embedding.GenerateDocumentEmbeddingAsync(c.Content, ct));
                    c.Status = KnowledgeChunkStatus.Completed;
                    done++; progressed = true;
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    c.Status = KnowledgeChunkStatus.Failed;
                    logger.LogWarning(ex, "[RAG] Embed chunk {Id} failed.", c.Id);
                }
                await Task.Delay(100, ct); // tránh chạm rate limit
            }
            await db.SaveChangesAsync(ct);
            db.ChangeTracker.Clear();
            if (!progressed) break; // tránh vòng lặp vô hạn khi toàn bộ batch lỗi
        }
        return done;
    }

    public async Task SeedVietGapKnowledgeAsync(CancellationToken ct = default)
    {
        var seedDocs = KnowledgeBaseSeedData.GetSeedDocuments();
        var validSeedTitles = seedDocs.Select(x => x.Document.Title).ToHashSet(StringComparer.OrdinalIgnoreCase);

        // Xóa các tài liệu seed cũ trong DB không còn thuộc bộ KnowledgeBaseSeedData hiện hành
        var obsoleteOldSeedDocs = await db.AgricultureDocuments
            .Where(d => d.FileType == "seed" && !validSeedTitles.Contains(d.Title))
            .ToListAsync(ct);
        if (obsoleteOldSeedDocs.Count > 0)
        {
            db.AgricultureDocuments.RemoveRange(obsoleteOldSeedDocs);
            await db.SaveChangesAsync(ct);
            logger.LogInformation("[RAG] Removed {Count} obsolete seed documents from database.", obsoleteOldSeedDocs.Count);
        }

        foreach (var (doc, chunks) in seedDocs)
        {
            var existing = await db.AgricultureDocuments
                .Include(d => d.Chunks)
                .FirstOrDefaultAsync(d => d.Title == doc.Title, ct);

            if (existing is not null)
            {
                var changed = false;
                if (existing.CropScope != doc.CropScope ||
                    existing.AuthorOrganization != doc.AuthorOrganization ||
                    existing.Category != doc.Category ||
                    existing.ContentText != doc.ContentText)
                {
                    existing.CropScope = doc.CropScope;
                    existing.AuthorOrganization = doc.AuthorOrganization;
                    existing.Category = doc.Category;
                    existing.ContentText = doc.ContentText;
                    changed = true;
                }

                foreach (var ch in chunks)
                {
                    var targetChunk = existing.Chunks.FirstOrDefault(c => c.ChunkIndex == ch.ChunkIndex);
                    if (targetChunk is null)
                    {
                        existing.Chunks.Add(new AgricultureKnowledgeChunk
                        {
                            ChunkIndex = ch.ChunkIndex,
                            Content = ch.Content,
                            CropTags = ch.CropTags,
                            Keywords = ch.Keywords,
                            Status = KnowledgeChunkStatus.Pending
                        });
                        changed = true;
                        continue;
                    }

                    if (targetChunk.Content != ch.Content)
                    {
                        targetChunk.Content = ch.Content;
                        targetChunk.Embedding = null;
                        targetChunk.Status = KnowledgeChunkStatus.Pending;
                        changed = true;
                    }

                    if (targetChunk.CropTags != ch.CropTags || targetChunk.Keywords != ch.Keywords)
                    {
                        targetChunk.CropTags = ch.CropTags;
                        targetChunk.Keywords = ch.Keywords;
                        changed = true;
                    }
                }

                var staleChunks = existing.Chunks
                    .Where(c => chunks.All(x => x.ChunkIndex != c.ChunkIndex))
                    .ToList();
                foreach (var stale in staleChunks)
                {
                    db.AgricultureKnowledgeChunks.Remove(stale);
                    changed = true;
                }

                if (changed)
                {
                    await db.SaveChangesAsync(ct);
                    try
                    {
                        await EmbedChunksAsync(db.AgricultureKnowledgeChunks.Where(c => c.DocumentId == existing.Id && c.Status == KnowledgeChunkStatus.Pending), ct);
                    }
                    catch (Exception ex) when (ex is not OperationCanceledException)
                    {
                        logger.LogWarning(ex, "[RAG] Re-embedding failed for updated seed document {Title}.", doc.Title);
                    }
                }
                continue;
            }

            doc.ContentText = doc.ContentText ?? string.Empty;
            foreach (var ch in chunks)
            {
                doc.Chunks.Add(new AgricultureKnowledgeChunk
                {
                    ChunkIndex = ch.ChunkIndex,
                    Content = ch.Content,
                    CropTags = ch.CropTags,
                    Keywords = ch.Keywords,
                    Status = KnowledgeChunkStatus.Pending
                });
            }
            db.AgricultureDocuments.Add(doc);
            await db.SaveChangesAsync(ct);

            try { await EmbedChunksAsync(db.AgricultureKnowledgeChunks.Where(c => c.DocumentId == doc.Id), ct); }
            catch (Exception ex) when (ex is not OperationCanceledException)
            { logger.LogWarning(ex, "[RAG] Embedding failed for seed document {Title}.", doc.Title); }
        }
    }

    private static string ExtractKeywords(string content) =>
        string.Join(',', content.ToLowerInvariant()
            .Split([' ', ',', '.', ';', ':', '\n', '(', ')'], StringSplitOptions.RemoveEmptyEntries)
            .Where(w => w.Length >= 4).GroupBy(w => w)
            .OrderByDescending(g => g.Count()).Take(12).Select(g => g.Key));

    private static string DetectCrops(string content, string scope)
    {
        var lower = content.ToLowerInvariant();
        var found = KnownCrops.Where(lower.Contains).ToList();
        if (found.Count == 0 && !string.IsNullOrWhiteSpace(scope)) return scope;
        return string.Join(',', found);
    }
}
