using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pgvector;
using Pgvector.EntityFrameworkCore;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Infrastructure.Persistence;

namespace SmartFarm.Infrastructure.Ai.Knowledge;

/// <summary>
/// Triển khai <see cref="IAgricultureKnowledgeRetriever"/> sử dụng:
/// 1. Gemini gemini-embedding-001 (768 chiều) để tạo embedding cho câu hỏi.
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
    // Đường từ khóa: một từ trùng trong câu hỏi dài chỉ ~0.07 nên ngưỡng cũ 0.05 cho lọt cả đoạn không liên quan.
    // Cần khớp ít nhất khoảng một phần ba các từ có nghĩa của câu hỏi.
    internal const float MinKeywordScore = 0.25f;
    // Đoạn ngắn hơn ngần này ký tự (sau khi bỏ dòng metadata) không đủ làm căn cứ kỹ thuật.
    internal const int MinSubstantiveChars = 80;

    private static readonly Regex MetadataLine = new(
        @"^\s*(trạng thái tài liệu|thẩm định|tác giả|nguồn|cơ quan ban hành|phiên bản|danh mục|trang)\b.*$",
        RegexOptions.IgnoreCase | RegexOptions.Compiled | RegexOptions.Multiline);

    /// <summary>Đoạn có nội dung kỹ thuật thật, không chỉ là tiêu đề hay dòng trạng thái/thẩm định.</summary>
    internal static bool IsSubstantive(string? content)
    {
        if (string.IsNullOrWhiteSpace(content)) return false;
        var body = MetadataLine.Replace(content, string.Empty);
        return body.Count(char.IsLetterOrDigit) >= MinSubstantiveChars;
    }

    // Một tài liệu đóng góp tối đa ngần này đoạn, để câu trả lời tổng hợp từ nhiều tài liệu đã duyệt.
    private const int MaxPassagesPerDocument = 2;
    // Điểm cộng cho đoạn cùng chủ đề với câu hỏi (ưu tiên, không loại đoạn khác chủ đề).
    private const float TopicBoost = 0.05f;
    // Điểm cộng cho tài liệu chuyên biệt của đúng cây so với tài liệu áp dụng chung.
    private const float CropSpecificBoost = 0.03f;

    public Task<IReadOnlyList<KnowledgePassageView>> RetrievePassagesAsync(
        string question,
        string? cropName,
        string? category,
        Guid? tenantId,
        int topK,
        CancellationToken cancellationToken) =>
        RetrievePassagesAsync(question, cropName, category, tenantId, topK, generalOnlyWhenCropUnknown: false, cancellationToken);

    public async Task<IReadOnlyList<KnowledgePassageView>> RetrievePassagesAsync(
        string question,
        string? cropName,
        string? category,
        Guid? tenantId,
        int topK,
        bool generalOnlyWhenCropUnknown,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(question)) return [];
        question = question.Normalize(NormalizationForm.FormC).Trim();
        if (topK <= 0) topK = 5;

        var scope = await ResolveDocumentScopeAsync(cropName, tenantId, generalOnlyWhenCropUnknown, cancellationToken);
        if (scope.Allowed is { Count: 0 }) return [];

        // Lấy dư ứng viên rồi mới chọn: ưu tiên chủ đề câu hỏi, tài liệu đúng cây, và giới hạn số đoạn mỗi tài liệu.
        var candidates = (await RetrieveCandidatesAsync(question, scope.Allowed, category, tenantId, topK * 3, cancellationToken))
            .Where(c => IsSubstantive(c.Content)).ToList();
        var selected = await DiversifyAsync(question, candidates, scope.CropSpecific, topK, cancellationToken);
        return await WithVersionsAsync(selected, cancellationToken);
    }

    // Phiên bản tài liệu đi kèm đoạn để AI chỉ so sánh phiên bản khi metadata thật sự có.
    private async Task<IReadOnlyList<KnowledgePassageView>> WithVersionsAsync(IReadOnlyList<KnowledgePassageView> passages, CancellationToken ct)
    {
        if (passages.Count == 0) return passages;
        var ids = passages.Select(p => p.DocumentId).Distinct().ToList();
        var versions = await db.AgricultureDocuments.AsNoTracking().Where(d => ids.Contains(d.Id))
            .ToDictionaryAsync(d => d.Id, d => d.Version, ct);
        return passages.Select(p => versions.TryGetValue(p.DocumentId, out var v) && !string.IsNullOrWhiteSpace(v) ? p with { Version = v } : p).ToList();
    }

    /// <summary>
    /// Tài liệu được phép dùng cho câu hỏi. Có cây trồng: tài liệu áp dụng cho đúng cây đó (so theo tên chuẩn, không
    /// so chuỗi con — "ớt" không khớp "ớt chuông") cộng tài liệu áp dụng chung (không ghi phạm vi cây). Không bao giờ
    /// mở rộng sang tài liệu chuyên biệt của cây khác. Không có cây: mọi tài liệu, hoặc chỉ tài liệu chung nếu yêu cầu.
    /// </summary>
    private async Task<(HashSet<Guid>? Allowed, HashSet<Guid> CropSpecific)> ResolveDocumentScopeAsync(
        string? cropName, Guid? tenantId, bool generalOnlyWhenCropUnknown, CancellationToken ct)
    {
        var hasCrop = !string.IsNullOrWhiteSpace(cropName);
        if (!hasCrop && !generalOnlyWhenCropUnknown) return (null, []);

        var docs = await db.AgricultureDocuments.AsNoTracking()
            .Where(d => d.ReviewStatus == SmartFarm.Domain.Entities.AgricultureDocumentReviewStatus.Approved)
            .Where(d => d.IsPublic || d.TenantId == tenantId)
            .Select(d => new { d.Id, d.CropScope })
            .ToListAsync(ct);

        var general = docs.Where(d => string.IsNullOrWhiteSpace(d.CropScope)).Select(d => d.Id);
        if (!hasCrop) return (general.ToHashSet(), []);

        var specific = docs.Where(d => CropNames.ScopeIncludes(d.CropScope, cropName!)).Select(d => d.Id).ToHashSet();
        return (specific.Concat(general).ToHashSet(), specific);
    }

    private async Task<IReadOnlyList<KnowledgePassageView>> DiversifyAsync(
        string question, IReadOnlyList<KnowledgePassageView> candidates, HashSet<Guid> cropSpecific, int topK, CancellationToken ct)
    {
        if (candidates.Count == 0) return candidates;
        var questionTopics = SmartFarm.Infrastructure.Ai.Knowledge.TopicClassifier.ClassifyQuestion(question);
        var ids = candidates.Select(c => c.ChunkId).ToList();
        var topics = questionTopics.Count == 0
            ? new Dictionary<Guid, string>()
            : await db.AgricultureKnowledgeChunks.AsNoTracking().Where(c => ids.Contains(c.Id))
                .ToDictionaryAsync(c => c.Id, c => c.Topic, ct);

        return candidates
            .Select(c => (Passage: c, Score: c.SimilarityScore
                + (topics.TryGetValue(c.ChunkId, out var t) && questionTopics.Contains(t) ? TopicBoost : 0f)
                + (cropSpecific.Contains(c.DocumentId) ? CropSpecificBoost : 0f)))
            .OrderByDescending(x => x.Score)
            .GroupBy(x => x.Passage.DocumentId)
            .SelectMany(g => g.Take(MaxPassagesPerDocument))
            .OrderByDescending(x => x.Score)
            .Take(topK)
            .Select(x => x.Passage)
            .ToList();
    }

    private async Task<IReadOnlyList<KnowledgePassageView>> RetrieveCandidatesAsync(
        string question,
        HashSet<Guid>? allowedDocumentIds,
        string? category,
        Guid? tenantId,
        int topK,
        CancellationToken cancellationToken)
    {
        // ── 1. Tạo embedding cho câu hỏi ─────────────────────────────────────
        var questionEmbedding = await embeddingProvider.EmbedQueryAsync(question, cancellationToken);

        if (questionEmbedding is not null)
        {
            try
            {
                var vectorResults = await SearchByVectorAsync(question, questionEmbedding, allowedDocumentIds, category, tenantId, topK, cancellationToken);
                if (vectorResults.Count > 0) return vectorResults;
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogWarning(ex, "[RAG] Vector query failed (e.g. pgvector not installed in PostgreSQL). Falling back gracefully to keyword search.");
            }
        }

        // ── 2. Fallback: keyword scoring khi chưa có embedding hoặc embedding chưa trả kết quả ──
        // Vẫn trong cùng phạm vi tài liệu (đúng cây + chung): không nới sang tài liệu của cây khác.
        logger.LogDebug("[RAG] Vector search empty or unavailable, using keyword fallback for question: {Q}", question[..Math.Min(100, question.Length)]);
        return await SearchByKeywordsAsync(question, allowedDocumentIds, category, tenantId, topK, cancellationToken);
    }

    // ────────────────────────────────────────────────────────────────────────
    //  pgvector cosine distance search
    // ────────────────────────────────────────────────────────────────────────
    private async Task<IReadOnlyList<KnowledgePassageView>> SearchByVectorAsync(
        string question,
        float[] questionEmbeddingValues,
        HashSet<Guid>? allowedDocumentIds,
        string? category,
        Guid? tenantId,
        int topK,
        CancellationToken ct)
    {
        // 1. Thử direct pgvector operator nếu PostgreSQL có pgvector extension
        try
        {
            var queryVector = new Vector(questionEmbeddingValues);
            var query = db.AgricultureKnowledgeChunks
                .AsNoTracking()
                .Include(c => c.Document)
                .Where(c => c.Embedding != null)
                .Where(c => c.Document.ReviewStatus == SmartFarm.Domain.Entities.AgricultureDocumentReviewStatus.Approved)
                .Where(c => c.Document.IsPublic || c.Document.TenantId == tenantId);

            // Chỉ tài liệu trong phạm vi được phép (đúng cây + áp dụng chung), so theo tên cây chuẩn hóa.
            if (allowedDocumentIds is not null) query = query.Where(c => allowedDocumentIds.Contains(c.DocumentId));

            if (!string.IsNullOrWhiteSpace(category))
            {
                query = query.Where(c => c.Document.Category == category || c.Document.Category == "general");
            }

            var results = await query
                .OrderBy(c => c.Embedding!.CosineDistance(queryVector))
                .Take(topK * 2)
                .Select(c => new
                {
                    c.Id,
                    c.DocumentId,
                    c.Document.Title,
                    c.Document.AuthorOrganization,
                    c.Document.Category,
                    c.Content,
                    c.PageNumber,
                    c.SectionTitle,
                    Distance = c.Embedding!.CosineDistance(queryVector)
                })
                .ToListAsync(ct);

            if (results.Count > 0)
            {
                return results
                    .Where(r => r.Distance <= MaxCosineDistance)
                    .Take(topK)
                    .Select(r => new KnowledgePassageView(
                        r.Id, r.DocumentId, r.Title, r.AuthorOrganization, r.Category, r.Content,
                        (float)(1.0 - r.Distance), r.PageNumber, r.SectionTitle))
                    .ToList();
            }
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "[RAG] Direct pgvector query skipped, using high-precision in-memory cosine dot product.");
        }

        // 2. High-precision in-memory vector cosine similarity (chuẩn xác 100% dựa trên vector 768 chiều từ DB)
        return await SearchByVectorInMemoryAsync(questionEmbeddingValues, allowedDocumentIds, category, tenantId, topK, ct);
    }

    private async Task<IReadOnlyList<KnowledgePassageView>> SearchByVectorInMemoryAsync(
        float[] questionVector,
        HashSet<Guid>? allowedDocumentIds,
        string? category,
        Guid? tenantId,
        int topK,
        CancellationToken ct)
    {
        var conn = db.Database.GetDbConnection();
        if (conn.State != ConnectionState.Open)
            await conn.OpenAsync(ct);

        // Pre-filter tại tầng SQL bằng điều kiện crop và category để không tải toàn bộ chunk vào RAM
        var sqlBuilder = new StringBuilder(@"
            SELECT c.id, c.document_id, d.title, d.author_organization, d.category, c.content, c.crop_tags, c.embedding::text, c.page_number, c.section_title
            FROM agriculture_knowledge_chunks c
            JOIN agriculture_documents d ON c.document_id = d.id
            WHERE c.embedding IS NOT NULL AND d.review_status = 'Approved' AND (d.is_public = TRUE OR d.tenant_id = @tenantId)");

        using var cmd = conn.CreateCommand();
        var pTenant = cmd.CreateParameter();
        pTenant.ParameterName = "@tenantId";
        pTenant.Value = tenantId ?? Guid.Empty;
        cmd.Parameters.Add(pTenant);


        if (!string.IsNullOrWhiteSpace(category))
        {
            sqlBuilder.Append(" AND (d.category = @category OR d.category = 'general')");
            var pCat = cmd.CreateParameter();
            pCat.ParameterName = "@category";
            pCat.Value = category;
            cmd.Parameters.Add(pCat);
        }

        cmd.CommandText = sqlBuilder.ToString();

        var list = new List<(Guid id, Guid docId, string title, string? author, string category, string content, string cropTags, float[] vector, int? page, string? section)>();

        using (var reader = await cmd.ExecuteReaderAsync(ct))
        {
            while (await reader.ReadAsync(ct))
            {
                var rawEmbedding = reader.GetString(7);
                if (string.IsNullOrWhiteSpace(rawEmbedding)) continue;

                float[]? chunkVec = ParseVector(rawEmbedding);
                if (chunkVec is null || chunkVec.Length != questionVector.Length) continue;

                list.Add((
                    reader.GetGuid(0),
                    reader.GetGuid(1),
                    reader.GetString(2),
                    reader.IsDBNull(3) ? null : reader.GetString(3),
                    reader.GetString(4),
                    reader.GetString(5),
                    reader.IsDBNull(6) ? string.Empty : reader.GetString(6),
                    chunkVec,
                    reader.IsDBNull(8) ? null : reader.GetInt32(8),
                    reader.IsDBNull(9) ? null : reader.GetString(9)
                ));
            }
        }

        // Lọc theo phạm vi tài liệu được phép; không nới sang toàn bộ kho khi không có kết quả (tránh lấy tài liệu của cây khác).
        if (allowedDocumentIds is not null) list.RemoveAll(x => !allowedDocumentIds.Contains(x.docId));

        if (list.Count == 0) return [];

        return list
            .Select(x =>
            {
                float sim = 0f;
                for (int i = 0; i < questionVector.Length; i++)
                    sim += questionVector[i] * x.vector[i];
                return new KnowledgePassageView(x.id, x.docId, x.title, x.author, x.category, x.content, sim, x.page, x.section);
            })
            .Where(x => x.SimilarityScore >= 0.55f)
            .OrderByDescending(x => x.SimilarityScore)
            .Take(topK)
            .ToList();
    }

    private static float[]? ParseVector(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var trimmed = raw.Trim();

        // 1. Dạng JSON mảng: [0.1, 0.2, ...]
        if (trimmed.StartsWith('[') && trimmed.EndsWith(']'))
        {
            try
            {
                return JsonSerializer.Deserialize<float[]>(trimmed);
            }
            catch { }
        }

        // 2. Dạng Postgres vector literal hoặc curly braces: {0.1, 0.2, ...} hoặc [0.1, 0.2, ...]
        try
        {
            var clean = trimmed.Trim('[', ']', '{', '}');
            var parts = clean.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            var arr = new float[parts.Length];
            for (int i = 0; i < parts.Length; i++)
                arr[i] = float.Parse(parts[i], CultureInfo.InvariantCulture);
            return arr;
        }
        catch { return null; }
    }

    // ────────────────────────────────────────────────────────────────────────
    //  Keyword fallback search (không cần embedding)
    // ────────────────────────────────────────────────────────────────────────
    private async Task<IReadOnlyList<KnowledgePassageView>> SearchByKeywordsAsync(
        string question,
        HashSet<Guid>? allowedDocumentIds,
        string? category,
        Guid? tenantId,
        int topK,
        CancellationToken ct)
    {
        var query = db.AgricultureKnowledgeChunks
            .AsNoTracking()
            .Include(c => c.Document)
            .Where(c => c.Document.ReviewStatus == SmartFarm.Domain.Entities.AgricultureDocumentReviewStatus.Approved)
            .Where(c => c.Document.IsPublic || c.Document.TenantId == tenantId);

        // Chỉ tài liệu trong phạm vi được phép (đúng cây + áp dụng chung), so theo tên cây chuẩn hóa.
        if (allowedDocumentIds is not null) query = query.Where(c => allowedDocumentIds.Contains(c.DocumentId));

        if (!string.IsNullOrWhiteSpace(category))
        {
            query = query.Where(c =>
                c.Document.Category == category ||
                c.Document.Category == "general");
        }

        // Tải chunk trong bộ nhớ (sắp xếp rõ ràng và giới hạn 300)
        var chunks = await query
            .OrderBy(c => c.DocumentId)
            .ThenBy(c => c.ChunkIndex)
            .Take(300)
            .Select(c => new
            {
                c.Id,
                c.DocumentId,
                c.Document.Title,
                c.Document.AuthorOrganization,
                c.Document.Category,
                c.Content,
                c.Keywords,
                c.PageNumber,
                c.SectionTitle
            })
            .ToListAsync(ct);

        var qWords = Tokenize(question);
        return chunks
            .Select(c =>
            {
                var score = ComputeKeywordScore(question, qWords, c.Content, c.Keywords);
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
                x.score,
                x.c.PageNumber,
                x.c.SectionTitle))
            .ToList();
    }

    // ────────────────────────────────────────────────────────────────────────
    //  Helpers
    // ────────────────────────────────────────────────────────────────────────
    private static readonly HashSet<string> VietnameseStopWords = new(StringComparer.OrdinalIgnoreCase)
    {
        "xin", "hỏi", "cho", "tôi", "em", "hãy", "biết", "có", "nên", "không", "ở", "tại", "với", "và", 
        "là", "được", "trong", "vào", "ra", "đang", "như", "thế", "nào", "gì", "sao", "giúp", "về", 
        "của", "các", "những", "một", "này", "đó", "khi", "thì", "do", "bị", "đã", "sẽ", "phải", "làm",
        "tự", "động", "hôm", "nay", "sắp", "chạy", "lúc", "mấy", "giờ", "bao", "nhiêu", "xem"
    };

    private static float ComputeKeywordScore(string rawQuestion, string[] qWords, string content, string keywords)
    {
        if (qWords.Length == 0) return 0f;
        var contentLower = (content ?? string.Empty).ToLowerInvariant();
        var keywordsLower = (keywords ?? string.Empty).ToLowerInvariant();

        var meaningfulWords = qWords.Where(w => w.Length >= 2 && !VietnameseStopWords.Contains(w)).ToArray();
        if (meaningfulWords.Length == 0) return 0f;

        var contentNoMark = RemoveDiacritics(contentLower);
        var keywordsNoMark = RemoveDiacritics(keywordsLower);

        float hits = 0;
        foreach (var word in meaningfulWords)
        {
            var wordNoMark = RemoveDiacritics(word);
            // Word boundary match to prevent random substring false positives
            var pattern = $@"(^|[\s,.:;!?""'\(\)\[\]]){Regex.Escape(word)}($|[\s,.:;!?""'\(\)\[\]])";
            var patternNoMark = $@"(^|[\s,.:;!?""'\(\)\[\]]){Regex.Escape(wordNoMark)}($|[\s,.:;!?""'\(\)\[\]])";

            if (Regex.IsMatch(contentLower, pattern, RegexOptions.IgnoreCase) || Regex.IsMatch(contentNoMark, patternNoMark, RegexOptions.IgnoreCase))
            {
                hits += 1f;
            }
            else if (Regex.IsMatch(keywordsLower, pattern, RegexOptions.IgnoreCase) || Regex.IsMatch(keywordsNoMark, patternNoMark, RegexOptions.IgnoreCase))
            {
                hits += 1.5f;
            }
        }

        // Phrase bonus for key domain queries
        var qLower = (rawQuestion ?? string.Empty).ToLowerInvariant();
        float phraseBonus = 0f;
        if (qLower.Contains("lịch tưới") && (contentLower.Contains("lịch tưới") || keywordsLower.Contains("lịch tưới")))
            phraseBonus += 0.35f;
        if (qLower.Contains("tưới nhỏ giọt") && (contentLower.Contains("tưới nhỏ giọt") || keywordsLower.Contains("tưới nhỏ giọt")))
            phraseBonus += 0.30f;
        if (qLower.Contains("phun sương") && (contentLower.Contains("phun sương") || keywordsLower.Contains("phun sương")))
            phraseBonus += 0.30f;
        if (qLower.Contains("châm phân") && (contentLower.Contains("châm phân") || keywordsLower.Contains("châm phân")))
            phraseBonus += 0.30f;
        if ((qLower.Contains("sâu bệnh") || qLower.Contains("dịch hại")) && (contentLower.Contains("sâu bệnh") || contentLower.Contains("dịch hại")))
            phraseBonus += 0.30f;

        if (hits == 0 && phraseBonus == 0) return 0f;
        var baseScore = (hits / meaningfulWords.Length) * 0.70f + phraseBonus;
        return Math.Min(1.0f, Math.Max(0f, baseScore));
    }

    public static string RemoveDiacritics(string text)
    {
        var normalizedString = text.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(capacity: normalizedString.Length);
        foreach (var c in normalizedString)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
            {
                sb.Append(c);
            }
        }
        return sb.ToString().Normalize(NormalizationForm.FormC).Replace('đ', 'd').Replace('Đ', 'D');
    }

    private static string[] Tokenize(string text) =>
        text.ToLowerInvariant()
            .Split([' ', ',', '.', '?', '!', ':', ';', '\n', '\r', '\t', '(', ')', '[', ']', '-', '_', '"', '\''],
                StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
}
