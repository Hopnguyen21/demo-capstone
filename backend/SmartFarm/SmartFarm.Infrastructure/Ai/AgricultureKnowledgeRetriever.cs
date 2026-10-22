using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pgvector;
using Pgvector.EntityFrameworkCore;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Infrastructure.Persistence;

namespace SmartFarm.Infrastructure.Ai.Knowledge;

/// <summary>
/// Triển khai <see cref="IAgricultureKnowledgeRetriever"/> sử dụng:
/// 1. Gemini text-embedding-004 để tạo embedding cho câu hỏi.
/// 2. pgvector cosine distance query trong PostgreSQL để tìm chunks gần nhất.
/// 3. Keyword-based scoring làm fallback khi không có embedding API key.
/// </summary>
public sealed class AgricultureKnowledgeRetriever(
    SmartFarmDbContext db,
    GeminiEmbeddingProvider embeddingProvider,
    ILogger<AgricultureKnowledgeRetriever> logger) : IAgricultureKnowledgeRetriever
{
    // Ngưỡng similarity tối thiểu (cosine similarity, 0-1)
    // Cosine distance trong pgvector = 1 - cosine_similarity
    // Ngưỡng distance < 0.60 ≈ similarity > 0.40
    private const float MaxCosineDistance = 0.60f;
    private const float MinKeywordScore = 0.10f;

    private static readonly string[] KnownCrops =
        ["cà chua", "ca chua", "dưa leo", "dua leo", "dưa chuột", "ớt", "ot", "xà lách", "xa lach", "rau muống", "cải", "dưa lưới", "dua luoi", "dâu tây", "dau tay", "lúa", "cà phê", "hồ tiêu"];

    private static string NormalizeCrop(string cropName)
    {
        var lower = cropName.ToLowerInvariant();
        return KnownCrops.FirstOrDefault(k => lower.Contains(k)) ?? lower.Split(' ')[0];
    }

    public async Task<IReadOnlyList<KnowledgePassageView>> RetrievePassagesAsync(
        string question,
        string? cropName,
        string? category,
        Guid? tenantId,
        int topK,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(question)) return [];
        if (topK <= 0) topK = 5;

        // ── 1. Tạo embedding cho câu hỏi ─────────────────────────────────────
        var questionEmbedding = await embeddingProvider.EmbedQueryAsync(question, cancellationToken);

        if (questionEmbedding is not null)
        {
            var vectorResults = await SearchByVectorAsync(question, questionEmbedding, cropName, category, tenantId, topK, cancellationToken);
            if (vectorResults.Count > 0) return vectorResults;

            // Nếu lọc theo cropName không ra kết quả, mở rộng tìm kiếm toàn bộ tài liệu VietGAP
            if (!string.IsNullOrWhiteSpace(cropName))
            {
                vectorResults = await SearchByVectorAsync(question, questionEmbedding, null, category, tenantId, topK, cancellationToken);
                if (vectorResults.Count > 0) return vectorResults;
            }
        }

        // ── 2b. Fallback: keyword scoring khi chưa có embedding hoặc embedding chưa trả kết quả ──
        logger.LogDebug("[RAG] Vector search empty or unavailable, using keyword fallback for question: {Q}", question[..Math.Min(100, question.Length)]);
        var keywordResults = await SearchByKeywordsAsync(question, cropName, category, tenantId, topK, cancellationToken);
        if (keywordResults.Count > 0) return keywordResults;

        // Fallback keyword không lọc crop
        if (!string.IsNullOrWhiteSpace(cropName))
        {
            return await SearchByKeywordsAsync(question, null, category, tenantId, topK, cancellationToken);
        }

        return [];
    }

    // ────────────────────────────────────────────────────────────────────────
    //  pgvector cosine distance search
    // ────────────────────────────────────────────────────────────────────────
    private async Task<IReadOnlyList<KnowledgePassageView>> SearchByVectorAsync(
        string question,
        float[] questionEmbeddingValues,
        string? cropName,
        string? category,
        Guid? tenantId,
        int topK,
        CancellationToken ct)
    {
        var queryVector = new Vector(questionEmbeddingValues);

        // Bắt đầu query với điều kiện quyền truy cập
        var query = db.AgricultureKnowledgeChunks
            .AsNoTracking()
            .Include(c => c.Document)
            .Where(c => c.Embedding != null)
            .Where(c => c.Document.IsPublic || c.Document.TenantId == tenantId);

        // Tiền lọc theo cây trồng
        if (!string.IsNullOrWhiteSpace(cropName))
        {
            var normalizedCrop = NormalizeCrop(cropName);
            query = query.Where(c =>
                c.CropTags == string.Empty ||
                EF.Functions.ILike(c.CropTags, $"%{normalizedCrop}%"));
        }

        // Tiền lọc theo danh mục
        if (!string.IsNullOrWhiteSpace(category))
        {
            query = query.Where(c =>
                c.Document.Category == category ||
                c.Document.Category == "general");
        }

        // pgvector cosine distance (<=> operator)
        var results = await query
            .OrderBy(c => c.Embedding!.CosineDistance(queryVector))
            .Take(topK * 2) // Lấy nhiều hơn để lọc theo ngưỡng
            .Select(c => new
            {
                c.Id,
                c.DocumentId,
                c.Document.Title,
                c.Document.AuthorOrganization,
                c.Document.Category,
                c.Content,
                Distance = c.Embedding!.CosineDistance(queryVector)
            })
            .ToListAsync(ct);

        return results
            .Where(r => r.Distance <= MaxCosineDistance)
            .Take(topK)
            .Select(r => new KnowledgePassageView(
                r.Id,
                r.DocumentId,
                r.Title,
                r.AuthorOrganization,
                r.Category,
                r.Content,
                (float)(1.0 - r.Distance))) // Chuyển distance → similarity
            .ToList();
    }

    // ────────────────────────────────────────────────────────────────────────
    //  Keyword fallback search (không cần embedding)
    // ────────────────────────────────────────────────────────────────────────
    private async Task<IReadOnlyList<KnowledgePassageView>> SearchByKeywordsAsync(
        string question,
        string? cropName,
        string? category,
        Guid? tenantId,
        int topK,
        CancellationToken ct)
    {
        var query = db.AgricultureKnowledgeChunks
            .AsNoTracking()
            .Include(c => c.Document)
            .Where(c => c.Document.IsPublic || c.Document.TenantId == tenantId);

        if (!string.IsNullOrWhiteSpace(cropName))
        {
            var normalizedCrop = NormalizeCrop(cropName);
            query = query.Where(c =>
                c.CropTags == string.Empty ||
                EF.Functions.ILike(c.CropTags, $"%{normalizedCrop}%"));
        }

        if (!string.IsNullOrWhiteSpace(category))
        {
            query = query.Where(c =>
                c.Document.Category == category ||
                c.Document.Category == "general");
        }

        // Tải chunk trong bộ nhớ (giới hạn 300 để tránh OOM)
        var chunks = await query
            .Take(300)
            .Select(c => new
            {
                c.Id,
                c.DocumentId,
                c.Document.Title,
                c.Document.AuthorOrganization,
                c.Document.Category,
                c.Content,
                c.Keywords
            })
            .ToListAsync(ct);

        var qWords = Tokenize(question);
        return chunks
            .Select(c =>
            {
                var score = ComputeKeywordScore(qWords, c.Content, c.Keywords);
                return (c, score);
            })
            .Where(x => x.score >= MinKeywordScore)
            .OrderByDescending(x => x.score)
            .Take(topK)
            .Select(x => new KnowledgePassageView(
                x.c.Id,
                x.c.DocumentId,
                x.c.Title,
                x.c.AuthorOrganization,
                x.c.Category,
                x.c.Content,
                x.score))
            .ToList();
    }

    // ────────────────────────────────────────────────────────────────────────
    //  Helpers
    // ────────────────────────────────────────────────────────────────────────
    private static float ComputeKeywordScore(string[] qWords, string content, string keywords)
    {
        if (qWords.Length == 0) return 0f;
        var contentLower = content.ToLowerInvariant();
        var keywordsLower = keywords.ToLowerInvariant();

        int hits = 0;
        foreach (var word in qWords)
        {
            if (word.Length < 2) continue;
            if (contentLower.Contains(word, StringComparison.Ordinal)) hits++;
            // Keyword field có trọng số 2x
            else if (keywordsLower.Contains(word, StringComparison.Ordinal)) hits += 2;
        }
        return Math.Min(1f, hits / (float)Math.Max(qWords.Length, 1));
    }

    private static string[] Tokenize(string text) =>
        text.ToLowerInvariant()
            .Split([' ', ',', '.', '?', '!', ':', ';', '\n', '\r', '\t', '(', ')', '[', ']'],
                StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
}
