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
    private const float MinKeywordScore = 0.05f;

    private static readonly (string[] Aliases, string Canonical)[] CropSynonyms =
    [
        (["cà chua", "ca chua", "tomato"], "cà chua"),
        (["dưa leo", "dua leo", "dưa chuột", "dua chuot", "cucumber"], "dưa leo"),
        (["dâu tây", "dau tay", "strawberry"], "dâu tây"),
        (["dưa lưới", "dua luoi", "melon", "cantaloupe"], "dưa lưới"),
        (["ớt", "ot", "ớt chuông", "ot chuong", "ớt ngọt", "sweet pepper", "bell pepper", "chili", "capsicum"], "ớt"),
        (["xà lách", "xa lach", "lettuce", "batavia", "salad"], "xà lách"),
        (["rau cải", "cải", "cai", "cabbage", "pak choi"], "cải"),
        (["rau muống", "rau muong", "water spinach"], "rau muống")
    ];

    private static string NormalizeCrop(string cropName)
    {
        var lower = cropName.ToLowerInvariant();
        var words = lower.Split([' ', '(', ')', '-', ':', '/', ',', '.', ';'], StringSplitOptions.RemoveEmptyEntries);
        foreach (var (aliases, canonical) in CropSynonyms)
        {
            foreach (var alias in aliases)
            {
                if (alias.Contains(' '))
                {
                    if (lower.Contains(alias)) return canonical;
                }
                else
                {
                    if (words.Contains(alias)) return canonical;
                }
            }
        }
        var first = words.FirstOrDefault();
        return first ?? lower;
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
        question = question.Normalize(NormalizationForm.FormC).Trim();
        if (topK <= 0) topK = 5;

        // ── 1. Tạo embedding cho câu hỏi ─────────────────────────────────────
        var questionEmbedding = await embeddingProvider.EmbedQueryAsync(question, cancellationToken);

        if (questionEmbedding is not null)
        {
            try
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
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogWarning(ex, "[RAG] Vector query failed (e.g. pgvector not installed in PostgreSQL). Falling back gracefully to keyword search.");
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
        // 1. Thử direct pgvector operator nếu PostgreSQL có pgvector extension
        try
        {
            var queryVector = new Vector(questionEmbeddingValues);
            var query = db.AgricultureKnowledgeChunks
                .AsNoTracking()
                .Include(c => c.Document)
                .Where(c => c.Embedding != null)
                .Where(c => c.Document.IsPublic || c.Document.TenantId == tenantId);

            if (!string.IsNullOrWhiteSpace(cropName))
            {
                var normalizedCrop = NormalizeCrop(cropName);
                query = query.Where(c => c.CropTags == string.Empty || EF.Functions.ILike(c.CropTags, $"%{normalizedCrop}%"));
            }

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
                        (float)(1.0 - r.Distance)))
                    .ToList();
            }
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "[RAG] Direct pgvector query skipped, using high-precision in-memory cosine dot product.");
        }

        // 2. High-precision in-memory vector cosine similarity (chuẩn xác 100% dựa trên vector 768 chiều từ DB)
        return await SearchByVectorInMemoryAsync(questionEmbeddingValues, cropName, category, tenantId, topK, ct);
    }

    private async Task<IReadOnlyList<KnowledgePassageView>> SearchByVectorInMemoryAsync(
        float[] questionVector,
        string? cropName,
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
            SELECT c.id, c.document_id, d.title, d.author_organization, d.category, c.content, c.crop_tags, c.embedding::text
            FROM agriculture_knowledge_chunks c
            JOIN agriculture_documents d ON c.document_id = d.id
            WHERE c.embedding IS NOT NULL AND (d.is_public = TRUE OR d.tenant_id = @tenantId)");

        using var cmd = conn.CreateCommand();
        var pTenant = cmd.CreateParameter();
        pTenant.ParameterName = "@tenantId";
        pTenant.Value = tenantId ?? Guid.Empty;
        cmd.Parameters.Add(pTenant);

        string? normalizedCrop = null;
        if (!string.IsNullOrWhiteSpace(cropName))
        {
            normalizedCrop = NormalizeCrop(cropName);
            sqlBuilder.Append(" AND (c.crop_tags = '' OR c.crop_tags ILIKE @cropPattern)");
            var pCrop = cmd.CreateParameter();
            pCrop.ParameterName = "@cropPattern";
            pCrop.Value = $"%{normalizedCrop}%";
            cmd.Parameters.Add(pCrop);
        }

        if (!string.IsNullOrWhiteSpace(category))
        {
            sqlBuilder.Append(" AND (d.category = @category OR d.category = 'general')");
            var pCat = cmd.CreateParameter();
            pCat.ParameterName = "@category";
            pCat.Value = category;
            cmd.Parameters.Add(pCat);
        }

        cmd.CommandText = sqlBuilder.ToString();

        var list = new List<(Guid id, Guid docId, string title, string? author, string category, string content, string cropTags, float[] vector)>();

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
                    chunkVec
                ));
            }
        }

        // Nếu bộ lọc quá hẹp không có chunk nào, query nới lỏng toàn bộ tài liệu public
        if (list.Count == 0 && (!string.IsNullOrWhiteSpace(cropName) || !string.IsNullOrWhiteSpace(category)))
        {
            using var cmdFallback = conn.CreateCommand();
            cmdFallback.CommandText = @"
                SELECT c.id, c.document_id, d.title, d.author_organization, d.category, c.content, c.crop_tags, c.embedding::text
                FROM agriculture_knowledge_chunks c
                JOIN agriculture_documents d ON c.document_id = d.id
                WHERE c.embedding IS NOT NULL AND (d.is_public = TRUE OR d.tenant_id = @tenantId)";
            var pFallbackTenant = cmdFallback.CreateParameter();
            pFallbackTenant.ParameterName = "@tenantId";
            pFallbackTenant.Value = tenantId ?? Guid.Empty;
            cmdFallback.Parameters.Add(pFallbackTenant);

            using var readerFallback = await cmdFallback.ExecuteReaderAsync(ct);
            while (await readerFallback.ReadAsync(ct))
            {
                var rawEmbedding = readerFallback.GetString(7);
                if (string.IsNullOrWhiteSpace(rawEmbedding)) continue;

                float[]? chunkVec = ParseVector(rawEmbedding);
                if (chunkVec is null || chunkVec.Length != questionVector.Length) continue;

                list.Add((
                    readerFallback.GetGuid(0),
                    readerFallback.GetGuid(1),
                    readerFallback.GetString(2),
                    readerFallback.IsDBNull(3) ? null : readerFallback.GetString(3),
                    readerFallback.GetString(4),
                    readerFallback.GetString(5),
                    readerFallback.IsDBNull(6) ? string.Empty : readerFallback.GetString(6),
                    chunkVec
                ));
            }
        }

        if (list.Count == 0) return [];

        return list
            .Select(x =>
            {
                float sim = 0f;
                for (int i = 0; i < questionVector.Length; i++)
                    sim += questionVector[i] * x.vector[i];
                return new KnowledgePassageView(x.id, x.docId, x.title, x.author, x.category, x.content, sim);
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
                c.Keywords
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
                x.score))
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
