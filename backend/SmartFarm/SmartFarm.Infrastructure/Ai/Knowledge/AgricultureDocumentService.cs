using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Pgvector;
using SmartFarm.Application.Common.Exceptions;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Domain.Entities;
using SmartFarm.Infrastructure.Ai;
using SmartFarm.Infrastructure.Persistence;

namespace SmartFarm.Infrastructure.Ai.Knowledge;

public sealed class AgricultureDocumentService(
    SmartFarmDbContext db,
    GeminiEmbeddingProvider embedding,
    IAgricultureKnowledgeRetriever retriever,
    HttpClient httpClient,
    IOptions<GeminiOptions> geminiOptions,
    VietGapDocumentVerifier verifier,
    ILogger<AgricultureDocumentService> logger) : IAgricultureDocumentService
{
    internal const int MinNotesForIncompleteApproval = 20;

    private static readonly HashSet<string> Categories =
        ["general", "irrigation", "pest", "nutrition", "climate", "harvest", "record"];

    private static Task<string> ExtractDocumentTextAsync(byte[] fileBytes, string fileType, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();
        // Chỉ đọc lớp văn bản có sẵn; không dùng AI/OCR để tạo nội dung tài liệu.
        return Task.FromResult(DocumentTextExtractor.Extract(fileBytes, fileType));
    }

    private static readonly string[] KnownCrops =
        ["cà chua", "dưa leo", "dưa chuột", "ớt", "xà lách", "rau muống", "cải", "dưa lưới", "dâu tây", "lúa", "cà phê", "hồ tiêu"];

    public async Task<IReadOnlyList<AgricultureDocumentSummaryView>> GetDocumentsAsync(
        Guid? tenantId, string? category, CancellationToken ct)
    {
        var q = db.AgricultureDocuments.AsNoTracking();
        if (tenantId.HasValue)
        {
            q = q.Where(d => d.IsPublic || d.TenantId == tenantId.Value);
        }
        if (!string.IsNullOrWhiteSpace(category)) q = q.Where(d => d.Category == category);

        var documents = await q.OrderByDescending(d => d.CreatedAtUtc)
            .Select(d => new
            {
                d.Id, d.Title, d.FileName, d.FileType, d.AuthorOrganization, d.Category,
                d.CropScope, d.Version, d.IsPublic, d.TenantId, ChunkCount = d.Chunks.Count,
                d.CreatedAtUtc, d.ReviewStatus, d.ReviewNotes, d.ReviewedAtUtc, d.DocumentType, d.Topics, d.VerificationStatus,
                HasOriginalFile = d.OriginalFileBytes != null
            })
            .ToListAsync(ct);

        // Chủ đề thật của nội dung (mỗi đoạn đã được gán chủ đề khi chia), để độ phủ không chỉ dựa vào khai báo.
        var ids = documents.Select(d => d.Id).ToList();
        var detected = (await db.AgricultureKnowledgeChunks.AsNoTracking()
                .Where(c => ids.Contains(c.DocumentId) && c.Topic != "general")
                .Select(c => new { c.DocumentId, c.Topic })
                .Distinct()
                .ToListAsync(ct))
            .GroupBy(x => x.DocumentId)
            .ToDictionary(g => g.Key, g => string.Join(',', g.Select(x => x.Topic).OrderBy(t => t)));

        return documents.Select(d => new AgricultureDocumentSummaryView(
            d.Id, d.Title, d.FileName, d.FileType, d.AuthorOrganization, d.Category,
            d.CropScope, d.Version, d.IsPublic, d.TenantId, d.ChunkCount, d.CreatedAtUtc,
            d.ReviewStatus.ToString(), d.ReviewNotes, d.ReviewedAtUtc, d.HasOriginalFile, d.DocumentType.ToString(), d.Topics,
            detected.GetValueOrDefault(d.Id, string.Empty), d.VerificationStatus)).ToList();
    }

    public async Task<AgricultureDocumentDetailView?> GetDocumentByIdAsync(Guid documentId, Guid? tenantId, CancellationToken ct)
    {
        var q = db.AgricultureDocuments.AsNoTracking().Where(x => x.Id == documentId);
        if (tenantId.HasValue)
        {
            q = q.Where(x => x.IsPublic || x.TenantId == tenantId.Value);
        }
        var d = await q
            .Select(x => new
            {
                x.Id, x.Title, x.FileName, x.FileType, x.AuthorOrganization, x.Category,
                x.CropScope, x.Version, x.IsPublic, x.TenantId, x.ContentText, x.CreatedAtUtc,
                x.ReviewStatus, x.ReviewNotes, x.ReviewedAtUtc, x.VerificationJson, x.VerificationStatus, x.DocumentType, x.Topics,
                x.MetadataDetectionJson,
                HasOriginalFile = x.OriginalFileBytes != null
            })
            .FirstOrDefaultAsync(ct);
        if (d is null) return null;

        // Không kéo cột embedding về, chỉ kiểm tra IS NOT NULL
        var chunks = await db.AgricultureKnowledgeChunks.AsNoTracking()
            .Where(c => c.DocumentId == documentId)
            .OrderBy(c => c.ChunkIndex)
            .Select(c => new AgricultureChunkView(c.Id, c.ChunkIndex, c.Content, c.CropTags, c.Keywords, c.Embedding != null, c.PageNumber, c.SectionTitle, c.Topic))
            .ToListAsync(ct);

        return new AgricultureDocumentDetailView(d.Id, d.Title, d.FileName, d.FileType, d.AuthorOrganization,
            d.Category, d.CropScope, d.Version, d.IsPublic, d.TenantId, d.ContentText, chunks, d.CreatedAtUtc,
            d.ReviewStatus.ToString(), d.ReviewNotes, d.ReviewedAtUtc, d.HasOriginalFile,
            DeserializeVerification(d.VerificationJson), d.DocumentType.ToString(), d.Topics, DeserializeDetection(d.MetadataDetectionJson), d.VerificationStatus);
    }

    public async Task<AgricultureOriginalFileView?> GetOriginalFileAsync(
        Guid documentId, Guid? tenantId, bool isPlatformAdmin, CancellationToken ct)
    {
        var query = db.AgricultureDocuments.AsNoTracking().Where(d => d.Id == documentId);
        if (!isPlatformAdmin)
        {
            if (tenantId is null) return null;
            query = query.Where(d => d.IsPublic || d.TenantId == tenantId.Value);
        }

        return await query
            .Where(d => d.OriginalFileBytes != null)
            .Select(d => new AgricultureOriginalFileView(
                d.OriginalFileBytes!, d.FileName ?? "tai-lieu", d.OriginalFileContentType ?? "application/octet-stream"))
            .FirstOrDefaultAsync(ct);
    }

    public async Task<Guid> IngestDocumentAsync(
        string title, string fileName, string fileType, byte[] fileBytes,
        string? authorOrganization, string category, string cropScope, string? version,
        AgricultureDocumentType documentType, IReadOnlyList<string>? topics,
        Guid? tenantId, bool isPublic, CancellationToken ct)
    {
        var text = await ExtractDocumentTextAsync(fileBytes, fileType, ct);
        if (string.IsNullOrWhiteSpace(text) || StructuredChunker.Chunk(text).Count == 0)
            throw new InvalidOperationException("Không tìm thấy nội dung văn bản có thể lưu trong tài liệu.");

        // Admin chỉ cần chọn file: metadata do người tải khai báo (nếu có) được giữ; còn lại nhận diện từ nội dung, kèm bằng chứng.
        var detection = VietGapMetadataExtractor.Detect(text, fileName);
        (title, authorOrganization, cropScope, version, documentType) =
            ApplyDetection(detection, title, authorOrganization, cropScope, version, documentType);
        category = Categories.Contains(category?.ToLowerInvariant() ?? "") ? category!.ToLowerInvariant() : "general";

        var verification = ManualReviewRequired(documentType);
        return await CreateDocumentAsync(title, fileName, fileType, text, authorOrganization, category,
            cropScope, version, documentType, topics, tenantId, isPublic, verification, ct, fileBytes, GetContentType(fileType), detection);
    }

    /// <summary>
    /// Giá trị người tải khai báo được giữ nguyên; trường bỏ trống lấy từ kết quả nhận diện khi có bằng chứng.
    /// Không có bằng chứng thì để trống / chưa xác định, không đoán (không mặc định "áp dụng chung" hay OfficialStandard).
    /// </summary>
    private static (string Title, string? Author, string CropScope, string? Version, AgricultureDocumentType Type) ApplyDetection(
        DocumentMetadataDetection detection, string? title, string? author, string? cropScope, string? version, AgricultureDocumentType type)
    {
        static string? Found(DetectedMetadataField f) => f.Status == DocumentMetadataDetection.NotFound ? null : f.Value;
        var resolvedTitle = string.IsNullOrWhiteSpace(title) ? (Found(detection.Title) ?? string.Empty) : title.Trim();
        if (resolvedTitle.Length is < 3 or > 300) throw new ArgumentException("Không đọc được tiêu đề từ nội dung file; hãy nhập tiêu đề (3-300 ký tự).");
        var resolvedAuthor = string.IsNullOrWhiteSpace(author) ? Found(detection.Publisher) : author.Trim();
        var resolvedCrops = string.IsNullOrWhiteSpace(cropScope) ? (Found(detection.Crops) ?? string.Empty) : cropScope;
        var resolvedVersion = string.IsNullOrWhiteSpace(version) ? (Found(detection.Version) ?? (detection.EffectiveDate.Status == DocumentMetadataDetection.Detected ? detection.EffectiveDate.Value : null)) : version.Trim();
        if (resolvedVersion is { Length: > 50 }) resolvedVersion = resolvedVersion[..50].Trim();
        var resolvedType = type != AgricultureDocumentType.Unspecified ? type
            : Enum.TryParse<AgricultureDocumentType>(detection.DocumentType.Value, out var detected) ? detected : AgricultureDocumentType.Unspecified;
        return (resolvedTitle, resolvedAuthor, resolvedCrops, resolvedVersion, resolvedType);
    }

    /// <summary>Chủ đề thực tế trong nội dung (gợi ý): số đoạn mỗi chủ đề và đoạn đầu tiên làm bằng chứng.</summary>
    private static List<DetectedTopic> DetectTopics(IEnumerable<AgricultureKnowledgeChunk> chunks)
    {
        // Một đoạn có thể bàn nhiều chủ đề: lấy chủ đề chính của đoạn cộng mọi chủ đề có từ khóa trong nội dung.
        var byTopic = new Dictionary<string, List<AgricultureKnowledgeChunk>>();
        foreach (var chunk in chunks.OrderBy(c => c.ChunkIndex))
        {
            var topics = new HashSet<string>(TopicClassifier.ClassifyQuestion(chunk.Content));
            if (!string.IsNullOrWhiteSpace(chunk.Topic) && chunk.Topic != "general") topics.Add(chunk.Topic);
            foreach (var topic in topics)
            {
                if (!byTopic.TryGetValue(topic, out var list)) byTopic[topic] = list = [];
                list.Add(chunk);
            }
        }
        return byTopic
            .Select(kv =>
            {
                var first = kv.Value[0];
                var quote = first.Content.Length <= 200 ? first.Content : first.Content[..200];
                return new DetectedTopic(kv.Key, kv.Value.Count, new MetadataEvidence(quote.Trim(), first.PageNumber));
            })
            .OrderByDescending(t => t.ChunkCount).ThenBy(t => t.Topic).ToList();
    }

    private static readonly JsonSerializerOptions DetectionJsonOptions = new(JsonSerializerDefaults.Web);

    private static DocumentMetadataDetection? DeserializeDetection(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try { return JsonSerializer.Deserialize<DocumentMetadataDetection>(json, DetectionJsonOptions); }
        catch (JsonException) { return null; }
    }

    private static DocumentSufficiencyResult ManualReviewRequired(AgricultureDocumentType documentType) =>
        new(false, documentType.ToString(), [], [],
            "Tài liệu được lưu độc lập với Growth Profile. Cần người quản trị rà soát nguồn, nội dung và cây trồng áp dụng.",
            "manual-review");

    public async Task<bool> UpdateDocumentAsync(
        Guid documentId, string title, string? fileName, string? fileType, byte[]? fileBytes, string? contentText,
        string? authorOrganization, string category, string cropScope, string? version,
        Guid? tenantId, bool isPlatformAdmin, CancellationToken ct)
    {
        var q = db.AgricultureDocuments.Where(d => d.Id == documentId);
        if (!isPlatformAdmin)
        {
            if (tenantId is null) return false;
            q = q.Where(d => d.TenantId == tenantId.Value);
        }

        var doc = await q.FirstOrDefaultAsync(ct);
        if (doc is null) return false;

        title = (title ?? string.Empty).Trim();
        if (title.Length is < 3 or > 300) throw new ArgumentException("Tiêu đề phải từ 3 đến 300 ký tự.");
        category = Categories.Contains(category?.ToLowerInvariant() ?? "") ? category!.ToLowerInvariant() : "general";

        string? newText = null;
        if (fileBytes is { Length: > 0 } && !string.IsNullOrWhiteSpace(fileType))
        {
            newText = await ExtractDocumentTextAsync(fileBytes, fileType, ct);
        }
        else if (!string.IsNullOrWhiteSpace(contentText))
        {
            newText = contentText.Trim();
        }

        if (newText is { Length: < 50 })
            throw new InvalidOperationException("Nội dung tài liệu sau khi cập nhật phải có ít nhất 50 ký tự; nội dung và chunks cũ chưa bị thay đổi.");

        if (fileBytes is { Length: > 0 } && !string.IsNullOrWhiteSpace(fileType))
        {
            doc.FileName = fileName ?? doc.FileName;
            doc.FileType = fileType;
            doc.OriginalFileBytes = fileBytes;
            doc.OriginalFileContentType = GetContentType(fileType);
        }
        else if (!string.IsNullOrWhiteSpace(contentText))
        {
            // Keep the source format when a reviewer edits extracted text for an uploaded file.
            if (fileName != null) doc.FileName = fileName;
        }

        doc.Title = title;
        doc.AuthorOrganization = authorOrganization;
        doc.Category = category;
        doc.CropScope = CropNames.NormalizeScope(cropScope);
        if (!string.IsNullOrWhiteSpace(version)) doc.Version = version.Trim();
        doc.UpdatedAtUtc = DateTime.UtcNow;

        if (newText != null)
        {
            var sourceFileReplaced = fileBytes is { Length: > 0 };
            var extractedTextChanged = !string.Equals(doc.ContentText, newText, StringComparison.Ordinal);
            if (sourceFileReplaced || extractedTextChanged)
            {
                using var tx = await db.Database.BeginTransactionAsync(ct);
                try
                {
                    doc.ContentText = newText;
                    doc.ContentHash = TopicClassifier.ContentHash(newText);
                    await QueueVerificationAsync(doc, ct); // Kết quả rà soát cũ không còn khớp toàn văn mới.
                    doc.ReviewStatus = AgricultureDocumentReviewStatus.PendingReview;
                    doc.ReviewNotes = null;
                    doc.ReviewedAtUtc = null;
                    await db.SaveChangesAsync(ct);

                    // Xóa triệt để toàn bộ chunks và vector cũ bằng bulk delete
                    await db.AgricultureKnowledgeChunks
                        .Where(c => c.DocumentId == doc.Id)
                        .ExecuteDeleteAsync(ct);

                    // Cắt nhỏ văn bản mới và nạp vào DB
                    db.AgricultureKnowledgeChunks.AddRange(BuildChunks(doc.Id, newText, doc.CropScope));
                    doc.ChunkerVersion = StructuredChunker.Version;
                    await db.SaveChangesAsync(ct);

                    await tx.CommitAsync(ct);
                }
                catch
                {
                    await tx.RollbackAsync(ct);
                    throw;
                }
            }
            else
            {
                // Metadata-only edit that resubmits the same text preserves the prior review and vectors.
                await db.SaveChangesAsync(ct);
            }
        }
        else
        {
            await db.SaveChangesAsync(ct);
        }

        return true;
    }

    public async Task<bool> ReviewDocumentAsync(
        Guid documentId, string? contentText, bool approve, string? reviewNotes,
        Guid? tenantId, bool isPlatformAdmin, DocumentMetadataOverrides? overrides, CancellationToken ct)
    {
        var query = db.AgricultureDocuments.Where(d => d.Id == documentId);
        if (!isPlatformAdmin)
        {
            if (tenantId is null) return false;
            query = query.Where(d => d.TenantId == tenantId.Value);
        }

        var document = await query.FirstOrDefaultAsync(ct);
        if (document is null) return false;

        var reviewedText = string.IsNullOrWhiteSpace(contentText) ? document.ContentText : contentText.Trim();
        if (reviewedText.Length < 50)
            throw new RequestValidationException("contentText", "Nội dung đã rà soát phải có ít nhất 50 ký tự.");
        if (reviewedText.Length > 200_000)
            throw new RequestValidationException("contentText", "Nội dung vượt giới hạn 200.000 ký tự.");
        if (approve && string.IsNullOrWhiteSpace(contentText))
            throw new RequestValidationException("contentText", "Hãy xem và xác nhận toàn văn tài liệu trước khi duyệt.");
        if (reviewNotes?.Length > 2000)
            throw new RequestValidationException("reviewNotes", "Ghi chú rà soát không được vượt quá 2.000 ký tự.");

        // Metadata do người duyệt chỉnh sau khi đối chiếu file gốc (trường null = giữ nguyên).
        var detection = DeserializeDetection(document.MetadataDetectionJson);
        var newTitle = string.IsNullOrWhiteSpace(overrides?.Title) ? document.Title : overrides!.Title!.Trim();
        if (newTitle.Length is < 3 or > 300) throw new RequestValidationException("title", "Tiêu đề phải từ 3 đến 300 ký tự.");
        var newCropScope = overrides?.CropScope is null ? document.CropScope : CropNames.NormalizeScope(overrides.CropScope);
        var newType = overrides?.DocumentType ?? document.DocumentType;
        if (detection is not null && overrides?.ConfirmGeneralScope == true && string.IsNullOrWhiteSpace(newCropScope))
            detection = detection with { GeneralScopeConfirmed = true };

        // AI nhận định tài liệu có thể không thuộc nông nghiệp: chỉ người duyệt mới được quyết định, và phải ghi lý do.
        if (approve && document.VerificationStatus == DocumentVerificationResult.NotAgricultural &&
            (reviewNotes?.Trim().Length ?? 0) < MinNotesForIncompleteApproval)
            throw new RequestValidationException("reviewNotes",
                $"AI nhận định tài liệu có thể không thuộc lĩnh vực nông nghiệp. Hãy xem file gốc và ghi chú lý do vẫn duyệt (tối thiểu {MinNotesForIncompleteApproval} ký tự).");

        if (approve)
        {
            // Loại tài liệu và phạm vi cây ảnh hưởng đến phân loại và truy xuất: phải được xác định trước khi vào RAG.
            if (newType == AgricultureDocumentType.Unspecified)
                throw new RequestValidationException("documentType", "Chưa xác định loại tài liệu (tiêu chuẩn, hướng dẫn kỹ thuật hoặc chuyên đề); hãy chọn trước khi duyệt.");
            if (detection is not null && !detection.ScopeResolved(newCropScope))
                throw new RequestValidationException("cropScope",
                    "Chưa xác định cây áp dụng: hãy chọn cây, hoặc xác nhận tài liệu áp dụng chung sau khi đối chiếu file gốc.");
        }

        // Duyệt tài liệu thiếu mục cốt lõi phải có ghi chú giải thích (ví dụ: tài liệu chuyên đề chỉ nói về IPM).
        if (approve)
        {
            var missing = VietGapCompletenessChecker.MissingCritical(reviewedText, newType, document.Topics,
                !string.IsNullOrWhiteSpace(overrides?.AuthorOrganization) || !string.IsNullOrWhiteSpace(document.AuthorOrganization));
            if (missing.Count > 0 && (reviewNotes?.Trim().Length ?? 0) < MinNotesForIncompleteApproval)
                throw new RequestValidationException("reviewNotes",
                    $"Tài liệu chưa thấy các mục: {string.Join(", ", missing.Select(m => m.Label))}. " +
                    $"Bổ sung nội dung hoặc ghi chú lý do duyệt (tối thiểu {MinNotesForIncompleteApproval} ký tự).");
        }

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        try
        {
            if (!string.Equals(document.ContentText, reviewedText, StringComparison.Ordinal))
            {
                document.ContentText = reviewedText;
                document.ContentHash = TopicClassifier.ContentHash(reviewedText);
                await QueueVerificationAsync(document, ct); // Kết quả rà soát cũ không còn khớp toàn văn đã sửa.
                await db.AgricultureKnowledgeChunks.Where(c => c.DocumentId == document.Id).ExecuteDeleteAsync(ct);
                db.AgricultureKnowledgeChunks.AddRange(BuildChunks(document.Id, reviewedText, document.CropScope));
                document.ChunkerVersion = StructuredChunker.Version;
            }

            document.Title = newTitle;
            if (overrides?.AuthorOrganization is { } author) document.AuthorOrganization = string.IsNullOrWhiteSpace(author) ? null : author.Trim();
            if (overrides?.Version is { } ver) document.Version = string.IsNullOrWhiteSpace(ver) ? null : (ver.Trim().Length > 50 ? ver.Trim()[..50] : ver.Trim());
            document.DocumentType = newType;
            if (!string.Equals(document.CropScope, newCropScope, StringComparison.Ordinal))
            {
                document.CropScope = newCropScope;
                // Nhãn cây của chunk kế thừa từ phạm vi tài liệu.
                await foreach (var c in db.AgricultureKnowledgeChunks.Where(c => c.DocumentId == document.Id).AsAsyncEnumerable().WithCancellation(ct))
                    c.CropTags = DetectCrops(c.Content, newCropScope);
            }
            if (detection is not null) document.MetadataDetectionJson = JsonSerializer.Serialize(detection, DetectionJsonOptions);

            document.ReviewStatus = approve
                ? AgricultureDocumentReviewStatus.Approved
                : AgricultureDocumentReviewStatus.NeedsCorrection;
            document.ReviewNotes = string.IsNullOrWhiteSpace(reviewNotes) ? null : reviewNotes.Trim();
            document.ReviewedAtUtc = DateTime.UtcNow;
            document.UpdatedAtUtc = DateTime.UtcNow;
            document.SupersededByDocumentId = null;
            if (approve) await SupersedeOlderVersionsAsync(document, ct);
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return true;
        }
        catch
        {
            await tx.RollbackAsync(ct);
            throw;
        }
    }

    internal const string NearDuplicateNotePrefix = "[Có thể trùng với tài liệu đã có]";
    // Tỉ lệ cụm 5 từ chung tối thiểu để coi là bản gần giống (phiên bản sửa vài chỗ hoặc cùng bài khác định dạng).
    internal const double NearDuplicateThreshold = 0.8;

    /// <summary>
    /// Tìm tài liệu gần giống trong phạm vi tenant/kho công khai: so cụm 5 từ liên tiếp (Jaccard) với tài liệu
    /// cùng cây trồng (hoặc mọi tài liệu khi chưa có cây trồng). Chỉ cảnh báo, không chặn.
    /// </summary>
    private async Task<List<(Guid Id, string Title, double Similarity)>> FindNearDuplicatesAsync(
        string text, string? cropScope, Guid? tenantId, CancellationToken ct)
    {
        var firstCrop = (cropScope ?? string.Empty).Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .FirstOrDefault()?.ToLower();
        var candidates = await db.AgricultureDocuments.AsNoTracking()
            .Where(d => d.IsPublic || d.TenantId == tenantId)
            .Where(d => firstCrop == null || d.CropScope.ToLower().Contains(firstCrop))
            .OrderByDescending(d => d.CreatedAtUtc)
            .Take(200)
            .Select(d => new { d.Id, d.Title, d.ContentText })
            .ToListAsync(ct);

        var shingles = Shingles(text);
        if (shingles.Count == 0) return [];
        return candidates
            .Select(c => (c.Id, c.Title, Similarity: Jaccard(shingles, Shingles(c.ContentText))))
            .Where(x => x.Similarity >= NearDuplicateThreshold)
            .OrderByDescending(x => x.Similarity)
            .Take(3)
            .ToList();
    }

    internal static HashSet<string> Shingles(string text)
    {
        var words = Regex.Matches(text.Normalize(NormalizationForm.FormC).ToLowerInvariant(), @"[\p{L}\p{N}]+")
            .Select(m => m.Value).ToArray();
        var set = new HashSet<string>();
        for (var i = 0; i + 5 <= words.Length; i++) set.Add(string.Join(' ', words, i, 5));
        return set;
    }

    internal static double Jaccard(HashSet<string> a, HashSet<string> b)
    {
        if (a.Count == 0 || b.Count == 0) return 0;
        var intersection = a.Count(b.Contains);
        return (double)intersection / (a.Count + b.Count - intersection);
    }

    /// <summary>
    /// Khi duyệt phiên bản mới, bản cũ đã duyệt cùng tên và cùng đơn vị ban hành (cùng phạm vi tenant) chuyển sang
    /// Superseded: không còn được embedding/truy xuất, để AI không trích số liệu của bản cũ.
    /// </summary>
    private async Task SupersedeOlderVersionsAsync(AgricultureDocument document, CancellationToken ct)
    {
        var title = document.Title.Trim().ToLower();
        var author = (document.AuthorOrganization ?? string.Empty).Trim().ToLower();
        var older = await db.AgricultureDocuments
            .Where(d => d.Id != document.Id && d.ReviewStatus == AgricultureDocumentReviewStatus.Approved
                && d.TenantId == document.TenantId && d.CreatedAtUtc < document.CreatedAtUtc
                && d.Title.Trim().ToLower() == title && (d.AuthorOrganization ?? string.Empty).Trim().ToLower() == author)
            .ToListAsync(ct);
        foreach (var d in older)
        {
            d.ReviewStatus = AgricultureDocumentReviewStatus.Superseded;
            d.SupersededByDocumentId = document.Id;
            d.UpdatedAtUtc = DateTime.UtcNow;
        }
        if (older.Count > 0)
            logger.LogInformation("[RAG] Document {Id} supersedes {Count} older version(s).", document.Id, older.Count);
    }

    private async Task<Guid> CreateDocumentAsync(
        string title, string? fileName, string fileType, string text, string? author,
        string category, string cropScope, string? version, AgricultureDocumentType documentType, IReadOnlyList<string>? topics, Guid? tenantId, bool isPublic,
        DocumentSufficiencyResult verification, CancellationToken ct,
        byte[]? originalFileBytes = null, string? originalFileContentType = null, DocumentMetadataDetection? detection = null)
    {
        // Chặn tải trùng: cùng toàn văn (sau chuẩn hóa) trong phạm vi tenant hoặc kho công khai.
        var contentHash = TopicClassifier.ContentHash(text);
        var duplicate = await db.AgricultureDocuments.AsNoTracking()
            .Where(d => d.ContentHash == contentHash && (d.IsPublic || d.TenantId == tenantId))
            .Select(d => new { d.Id, d.Title, d.ReviewStatus })
            .FirstOrDefaultAsync(ct);
        if (duplicate is not null)
            throw new DuplicateDocumentException(duplicate.Id, duplicate.Title, duplicate.ReviewStatus.ToString());

        // Bản gần giống (phiên bản sửa vài chỗ, cùng bài khác định dạng): không chặn, nhưng ghi chú để người duyệt
        // quyết định giữ bản nào. Bản mới duyệt sẽ thay thế bản cũ nếu cùng tên và đơn vị ban hành.
        var similar = await FindNearDuplicatesAsync(text, cropScope, tenantId, ct);

        // Tài liệu được lưu độc lập với Growth Profile và không cần AI validator.
        // Chỉ tài liệu được người quản trị duyệt mới được truy xuất trong RAG.
        var reviewNote = verification.VerifiedBy == "manual-review"
            ? $"[Chờ người duyệt] {verification.Summary}"
            : verification.IsSufficient
            ? $"[AI xác nhận đủ thông tin: {verification.VerifiedBy}] {verification.Summary}".Trim()
            : $"[AI chưa xác nhận đủ thông tin: {verification.VerifiedBy}] {verification.Summary} " +
              $"Thiếu: {string.Join("; ", verification.MissingRequirements)}";
        if (similar.Count > 0)
            reviewNote = $"{NearDuplicateNotePrefix} {string.Join("; ", similar.Select(s => $"\"{s.Title}\" ({s.Similarity:P0})"))}. {reviewNote}";
        var doc = new AgricultureDocument
        {
            Title = title, FileName = fileName, FileType = fileType, ContentText = text,
            AuthorOrganization = author, Category = category, CropScope = CropNames.NormalizeScope(cropScope),
            Version = version, TenantId = tenantId, IsPublic = isPublic, DocumentType = documentType,
            // Chủ đề khai báo (nếu có). Chủ đề nhận diện từ nội dung nằm trong MetadataDetectionJson, chỉ là gợi ý.
            Topics = TopicClassifier.NormalizeTopics([category, .. topics ?? []]),
            ContentHash = contentHash,
            OriginalFileBytes = originalFileBytes,
            OriginalFileContentType = originalFileContentType,
            ReviewStatus = AgricultureDocumentReviewStatus.PendingReview,
            ReviewNotes = reviewNote.Length > 2000 ? reviewNote[..2000] : reviewNote,
        };
        // Kiểm tra chủ đề nông nghiệp bằng AI chạy nền (Pending) để upload trả về nhanh.
        await QueueVerificationAsync(doc, ct);

        foreach (var chunk in BuildChunks(null, text, doc.CropScope)) doc.Chunks.Add(chunk);
        doc.ChunkerVersion = StructuredChunker.Version;
        if (detection is not null)
            doc.MetadataDetectionJson = JsonSerializer.Serialize(detection with { Topics = DetectTopics(doc.Chunks) }, DetectionJsonOptions);

        db.AgricultureDocuments.Add(doc);
        await db.SaveChangesAsync(ct);
        // Embedding được worker xử lý nền để upload trả ngay sau khi toàn văn và chunks đã lưu.
        return doc.Id;
    }

    /// <summary>Chia theo mục/trang (StructuredChunker); mỗi chunk chờ embedding.</summary>
    private static List<AgricultureKnowledgeChunk> BuildChunks(Guid? documentId, string text, string cropScope) =>
        StructuredChunker.Chunk(text).Select((piece, index) => new AgricultureKnowledgeChunk
        {
            DocumentId = documentId ?? Guid.Empty,
            ChunkIndex = index,
            Content = piece.Content,
            PageNumber = piece.PageNumber,
            SectionTitle = piece.SectionTitle,
            Keywords = ExtractKeywords(piece.Content),
            CropTags = DetectCrops(piece.Content, cropScope),
            Topic = TopicClassifier.ClassifyChunk(piece.SectionTitle, piece.Content),
            Status = KnowledgeChunkStatus.Pending
        }).ToList();

    /// <summary>
    /// Chia lại toàn bộ tài liệu đã lưu bằng bộ chia theo cấu trúc (tài liệu nhập trước khi có trang/mục).
    /// Chunk cũ và vector cũ bị thay; tài liệu đã duyệt sẽ được worker nền embedding lại. Trạng thái duyệt giữ nguyên
    /// vì toàn văn không đổi.
    /// </summary>
    public async Task<int> RechunkAllDocumentsAsync(CancellationToken ct)
    {
        var ids = await db.AgricultureDocuments.Select(d => d.Id).ToListAsync(ct);
        var total = 0;
        foreach (var id in ids) total += await RechunkDocumentAsync(id, ct);
        logger.LogInformation("[RAG] Re-chunked {Documents} documents into {Chunks} chunks.", ids.Count, total);
        return total;
    }

    /// <summary>
    /// Worker nền: chia lại một tài liệu còn dùng bộ chia cũ (ChunkerVersion thấp hơn hiện hành), mỗi chu kỳ một tài liệu.
    /// Thay cho nút "Chia lại đoạn RAG": tài liệu cũ tự có trang, mục, chủ đề và bỏ rác trang web.
    /// </summary>
    public async Task<bool> ProcessLegacyChunksAsync(CancellationToken ct)
    {
        var id = await db.AgricultureDocuments
            .Where(d => d.ChunkerVersion < StructuredChunker.Version)
            .OrderBy(d => d.CreatedAtUtc)
            .Select(d => (Guid?)d.Id)
            .FirstOrDefaultAsync(ct);
        if (id is null) return false;
        await RechunkDocumentAsync(id.Value, ct);
        return true;
    }

    /// <summary>
    /// Worker nền: tính hash cho tài liệu nạp trước khi có chống trùng, để lần tải sau của cùng file bị chặn.
    /// Không xóa các bản trùng đã có sẵn: admin tự quyết định giữ bản nào.
    /// </summary>
    public async Task<int> ProcessMissingHashesAsync(CancellationToken ct)
    {
        var docs = await db.AgricultureDocuments.Where(d => d.ContentHash == null).Take(50).ToListAsync(ct);
        foreach (var d in docs) d.ContentHash = TopicClassifier.ContentHash(d.ContentText);
        // Tài liệu nạp trước khi chuẩn hóa tên cây: đưa phạm vi áp dụng về tên chuẩn (một lần, rồi không còn khác biệt).
        var scoped = await db.AgricultureDocuments.Where(d => d.CropScope != "").ToListAsync(ct);
        var renamed = scoped.Where(d => d.CropScope != CropNames.NormalizeScope(d.CropScope)).ToList();
        foreach (var d in renamed) d.CropScope = CropNames.NormalizeScope(d.CropScope);
        if (docs.Count + renamed.Count > 0) await db.SaveChangesAsync(ct);
        return docs.Count + renamed.Count;
    }

    private async Task<int> RechunkDocumentAsync(Guid documentId, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var doc = await db.AgricultureDocuments.FirstAsync(d => d.Id == documentId, ct);
        if (doc.FileType == "seed")
        {
            // Chunk của tài liệu seed do SeedVietGapKnowledgeAsync quản lý; không chia lại từ ContentText.
            doc.ChunkerVersion = StructuredChunker.Version;
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return await db.AgricultureKnowledgeChunks.CountAsync(c => c.DocumentId == documentId, ct);
        }
        await db.AgricultureKnowledgeChunks.Where(c => c.DocumentId == documentId).ExecuteDeleteAsync(ct);
        var chunks = BuildChunks(documentId, doc.ContentText, doc.CropScope);
        db.AgricultureKnowledgeChunks.AddRange(chunks);
        doc.ChunkerVersion = StructuredChunker.Version;
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        db.ChangeTracker.Clear();
        return chunks.Count;
    }



    private static readonly JsonSerializerOptions VerificationJsonOptions = new(JsonSerializerDefaults.Web);

    private static DocumentVerificationResult? DeserializeVerification(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try { return JsonSerializer.Deserialize<DocumentVerificationResult>(json, VerificationJsonOptions); }
        catch (JsonException) { return null; }
    }

    private static void StoreVerification(AgricultureDocument doc, DocumentVerificationResult result)
    {
        doc.VerificationStatus = result.Status;
        doc.VerificationJson = JsonSerializer.Serialize(result, VerificationJsonOptions);
        doc.VerificationAttemptedAtUtc = result.CheckedAtUtc;
    }

    /// <summary>
    /// Đánh dấu Pending để worker nền gọi AI kiểm tra tài liệu có thuộc lĩnh vực nông nghiệp hay không. Tài liệu vẫn ở trạng thái
    /// chờ duyệt dù kết quả thế nào; kết quả AI không bao giờ tự duyệt hay mở RAG.
    /// </summary>
    private Task QueueVerificationAsync(AgricultureDocument doc, CancellationToken ct)
    {
        doc.VerificationStatus = DocumentVerificationResult.Pending;
        doc.VerificationJson = null;
        doc.VerificationAttemptedAtUtc = null;
        return Task.CompletedTask;
    }

    public async Task<DocumentVerificationResult?> RequestVerificationAsync(Guid documentId, CancellationToken ct)
    {
        var doc = await db.AgricultureDocuments.FirstOrDefaultAsync(d => d.Id == documentId, ct)
            ?? throw new ResourceNotFoundException("Không tìm thấy tài liệu.");
        await QueueVerificationAsync(doc, ct);
        doc.UpdatedAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return DeserializeVerification(doc.VerificationJson);
    }

    /// <summary>
    /// Worker nền: AI kiểm tra chủ đề một tài liệu đang Pending mỗi chu kỳ (mỗi lần gọi AI mất vài chục giây). Lỗi AI ghi VerificationError,
    /// không tự thử lại liên tục; người quản trị yêu cầu rà soát lại khi cần. Không bao giờ đổi trạng thái duyệt.
    /// </summary>
    public async Task<bool> ProcessPendingVerificationAsync(CancellationToken ct)
    {
        var doc = await db.AgricultureDocuments
            .Where(d => d.VerificationStatus == DocumentVerificationResult.Pending)
            .OrderBy(d => d.CreatedAtUtc)
            .FirstOrDefaultAsync(ct);
        if (doc is null) return false;

        var result = await verifier.VerifyAsync(doc, ct);
        StoreVerification(doc, result);
        await db.SaveChangesAsync(ct);
        return true;
    }

    private static string GetContentType(string fileType) => fileType.ToLowerInvariant() switch
    {
        "pdf" => "application/pdf",
        "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "txt" => "text/plain; charset=utf-8",
        _ => "application/octet-stream"
    };


    /// <summary>Chunk lỗi embedding được xếp lại hàng sau khoảng nghỉ này; lỗi tạm thời (hết quota, mạng) không làm đoạn mất khỏi tìm kiếm vector mãi mãi.</summary>
    public const int FailedEmbeddingRetryMinutes = 15;

    public async Task<int> ProcessPendingEmbeddingsAsync(CancellationToken ct)
    {
        var retryBefore = DateTime.UtcNow.AddMinutes(-FailedEmbeddingRetryMinutes);
        var retry = await db.AgricultureKnowledgeChunks
            .Where(c => c.Status == KnowledgeChunkStatus.Failed && c.Document.ReviewStatus == AgricultureDocumentReviewStatus.Approved && (c.UpdatedAtUtc == null || c.UpdatedAtUtc < retryBefore))
            .OrderBy(c => c.UpdatedAtUtc).Take(20).ToListAsync(ct);
        if (retry.Count > 0)
        {
            foreach (var chunk in retry) chunk.Status = KnowledgeChunkStatus.Pending;
            await db.SaveChangesAsync(ct);
            db.ChangeTracker.Clear();
        }

        return await EmbedChunksAsync(db.AgricultureKnowledgeChunks.Where(c => c.Status == KnowledgeChunkStatus.Pending &&
            c.Document.ReviewStatus == AgricultureDocumentReviewStatus.Approved), ct, maxChunks: 20);
    }

    public async Task<bool> DeleteDocumentAsync(Guid documentId, Guid? tenantId, bool isPlatformAdmin, CancellationToken ct)
    {
        var q = db.AgricultureDocuments.Where(d => d.Id == documentId);
        if (!isPlatformAdmin)
        {
            if (tenantId is null) return false;
            q = q.Where(d => d.TenantId == tenantId.Value);
        }

        var doc = await q.FirstOrDefaultAsync(ct);
        if (doc is null) return false;
        db.AgricultureDocuments.Remove(doc); // cascade xóa chunks
        await db.SaveChangesAsync(ct);
        return true;
    }

    public Task<IReadOnlyList<KnowledgePassageView>> SearchAsync(string query, string? cropName, Guid? tenantId, int topK, CancellationToken ct) =>
        retriever.RetrievePassagesAsync(query, cropName, null, tenantId, topK, ct);

    public async Task<int> BackfillEmbeddingsAsync(CancellationToken ct)
    {
        var failed = await db.AgricultureKnowledgeChunks
            .Where(c => c.Status == KnowledgeChunkStatus.Failed && c.Document.ReviewStatus == AgricultureDocumentReviewStatus.Approved)
            .ToListAsync(ct);
        foreach (var f in failed) f.Status = KnowledgeChunkStatus.Pending;
        if (failed.Count > 0)
        {
            await db.SaveChangesAsync(ct);
            db.ChangeTracker.Clear();
        }

        return await EmbedChunksAsync(db.AgricultureKnowledgeChunks.Where(c => c.Document.ReviewStatus == AgricultureDocumentReviewStatus.Approved), ct);
    }

    private async Task<int> EmbedChunksAsync(IQueryable<AgricultureKnowledgeChunk> source, CancellationToken ct, int maxChunks = 0)
    {
        if (!embedding.IsAvailable) return 0;
        var done = 0;
        const int batch = 20;

        while (true)
        {
            var takeCount = (maxChunks > 0) ? Math.Min(batch, maxChunks - done) : batch;
            if (takeCount <= 0) break;

            var chunks = await source
                .Where(c => c.Status == KnowledgeChunkStatus.Pending)
                .OrderBy(c => c.DocumentId).ThenBy(c => c.ChunkIndex)
                .Take(takeCount).ToListAsync(ct);
            if (chunks.Count == 0) break;

            foreach (var c in chunks)
            {
                try
                {
                    // Ghép tiêu đề mục vào văn bản embedding để đoạn giữa mục vẫn mang ngữ cảnh của mục.
                    var embeddingText = string.IsNullOrWhiteSpace(c.SectionTitle) ? c.Content : $"{c.SectionTitle}\n{c.Content}";
                    c.Embedding = new Vector(await embedding.GenerateDocumentEmbeddingAsync(embeddingText, ct));
                    c.Status = KnowledgeChunkStatus.Completed;
                    done++;
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    c.Status = KnowledgeChunkStatus.Failed;
                    logger.LogWarning(ex, "[RAG] Embed chunk {Id} failed.", c.Id);
                }
                await Task.Delay(50, ct);
            }
            await db.SaveChangesAsync(ct);
            db.ChangeTracker.Clear();

            if (maxChunks > 0 && done >= maxChunks) break;
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
                    existing.ContentText != doc.ContentText ||
                    existing.ChunkerVersion != doc.ChunkerVersion)
                {
                    existing.ChunkerVersion = doc.ChunkerVersion;
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
            doc.ReviewStatus = AgricultureDocumentReviewStatus.Approved;
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
        if (!string.IsNullOrWhiteSpace(scope)) return scope.Trim();
        var lower = content.Normalize(NormalizationForm.FormC).ToLowerInvariant();
        var found = KnownCrops.Where(crop => CropMentioned(lower, crop)).ToList();
        return string.Join(',', found);
    }

    // Nguyên từ (không khớp "ớt" trong chữ khác) và bỏ cụm không phải tên cây: "cải cách hành chính" (menu trang web),
    // "cải thiện", "cải tạo đất"...
    private static readonly Regex NotACropAfterCai = new(@"^\s*(?:cách|thiện|tạo|tiến|tổ|biến)", RegexOptions.CultureInvariant);

    internal static bool CropMentioned(string lowerText, string crop)
    {
        foreach (Match m in Regex.Matches(lowerText, $@"(?<![\p{{L}}\p{{N}}]){Regex.Escape(crop)}(?![\p{{L}}\p{{N}}])"))
        {
            if (crop == "cải" && NotACropAfterCai.IsMatch(lowerText[(m.Index + m.Length)..])) continue;
            return true;
        }
        return false;
    }

    public async Task<Guid> IngestTextDocumentAsync(
        string title, string text, string? authorOrganization, string category,
        string cropScope, string? version, AgricultureDocumentType documentType, IReadOnlyList<string>? topics, Guid? tenantId, bool isPublic, CancellationToken ct)
    {
        category = Categories.Contains(category?.ToLowerInvariant() ?? "") ? category!.ToLowerInvariant() : "general";
        if (string.IsNullOrWhiteSpace(text) || text.Trim().Length < 50)
            throw new ArgumentException("Nội dung tài liệu phải có ít nhất 50 ký tự.");
        text = text.Trim();

        var detection = VietGapMetadataExtractor.Detect(text, null);
        (title, authorOrganization, cropScope, version, documentType) =
            ApplyDetection(detection, title, authorOrganization, cropScope, version, documentType);

        var verification = ManualReviewRequired(documentType);
        var safeFileName = $"vietgap_{title.Replace(' ', '_').ToLowerInvariant()}.txt";
        return await CreateDocumentAsync(title, safeFileName, "text", text, authorOrganization, category,
            cropScope, version, documentType, topics, tenantId, isPublic, verification, ct, detection: detection);
    }

    public async Task<VietGapDraftResult> GenerateVietGapDraftAsync(VietGapDraftRequest request, CancellationToken ct)
    {
        var cropName = request.CropName.Trim();
        var standardCode = string.IsNullOrWhiteSpace(request.StandardCode) ? "Chưa cung cấp mã tiêu chuẩn" : request.StandardCode.Trim();
        var category = Categories.Contains(request.Category?.ToLowerInvariant() ?? "") ? request.Category!.ToLowerInvariant() : "general";
        var model = string.IsNullOrWhiteSpace(request.CultivationModel) ? "Chưa xác định" : request.CultivationModel.Trim();
        var extra = request.AdditionalRequirements?.Trim() ?? string.Empty;

        var settings = geminiOptions.Value;
        var apiKeys = (settings.ApiKeys ?? [])
            .Append(settings.ApiKey)
            .Where(k => !string.IsNullOrWhiteSpace(k))
            .Select(k => k.Trim())
            .Distinct()
            .ToList();

        if (apiKeys.Count > 0 && !string.IsNullOrWhiteSpace(settings.Model))
        {
            try
            {
                var prompt = $@"Bạn là trợ lý soạn thảo bản nháp nội bộ về thực hành nông nghiệp.
Nhiệm vụ của bạn là tạo KHUNG BẢN NHÁP để chuyên gia rà soát, không phải tài liệu quy chuẩn hoặc chứng nhận tuân thủ.

THÔNG TIN ĐẦU VÀO:
- Tên giống cây trồng: {cropName}
- Tiêu chuẩn quy phạm: {standardCode}
- Chuyên mục: {category}
- Mô hình canh tác: {model}
- Yêu cầu kỹ thuật bổ sung: {extra}

Hãy tạo một BẢN NHÁP CẤU TRÚC để chuyên gia rà soát. Không giả danh cơ quan nhà nước, không khẳng định đây là quy chuẩn chính thức hoặc đã tuân thủ tiêu chuẩn.
Không có tài liệu tiêu chuẩn gốc trong đầu vào. Vì vậy KHÔNG được tự tạo số liệu, giới hạn, khoảng cách, thời gian cách ly, danh mục hoạt chất cấm, ngưỡng vi khí hậu hoặc yêu cầu pháp lý. Với dữ liệu không có căn cứ, ghi rõ [CẦN ĐỐI CHIẾU NGUỒN CHÍNH THỨC]. Chỉ nêu số liệu khi có trích dẫn rõ nguồn trong đầu vào.
Tổ chức bản nháp thành các mục để rà soát: phạm vi/căn cứ; đất và giá thể; nước; vật tư và phân bón; quản lý dịch hại; giai đoạn sinh trưởng; thu hoạch/sơ chế/truy xuất. Không biến các mục rà soát này thành yêu cầu bắt buộc của tiêu chuẩn.

YÊU CẦU ĐỊNH DẠNG ĐẦU RA:
Trả về DUY NHẤT một đối tượng JSON hợp lệ (không kèm markdown ```json bọc ngoài), có cấu trúc:
{{
  ""title"": ""Quy Chuẩn Kỹ Thuật Canh Tác {cropName} VietGAP ({standardCode})"",
  ""standardCode"": ""{standardCode}"",
  ""authorOrganization"": ""Hệ thống SmartFarm (Bản phác thảo tham khảo - Chưa thẩm định)"",
  ""category"": ""{category}"",
  ""cropScope"": ""{cropName}"",
  ""version"": ""V1.0"",
  ""content"": ""Toàn bộ nội dung văn bản quy chuẩn đầy đủ 7 phần (I đến VII), sử dụng xuống dòng \n và định dạng tiêu đề rõ ràng""
}}";

                var body = new
                {
                    systemInstruction = new { parts = new[] { new { text = "Bạn là chuyên gia soạn thảo quy chuẩn VietGAP. Trả về đúng định dạng JSON yêu cầu." } } },
                    contents = new[] { new { role = "user", parts = new[] { new { text = prompt } } } },
                    generationConfig = new
                    {
                        temperature = 0.2,
                        maxOutputTokens = 8192,
                        responseMimeType = "application/json"
                    }
                };

                var candidateModels = settings.CandidateModels();

                using var overallCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
                overallCts.CancelAfter(TimeSpan.FromSeconds(45));

                foreach (var m in candidateModels)
                {
                    if (overallCts.IsCancellationRequested) break;
                    foreach (var apiKey in apiKeys)
                    {
                        if (overallCts.IsCancellationRequested) break;
                        try
                        {
                            var endpoint = new Uri(new Uri(settings.BaseUrl, UriKind.Absolute), $"models/{m}:generateContent");
                            using var reqMsg = new HttpRequestMessage(HttpMethod.Post, endpoint)
                            {
                                Content = JsonContent.Create(body)
                            };
                            reqMsg.Headers.Add("x-goog-api-key", apiKey);

                            using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
                            timeoutCts.CancelAfter(TimeSpan.FromSeconds(Math.Min(settings.TimeoutSeconds, 45)));

                            using var resp = await httpClient.SendAsync(reqMsg, timeoutCts.Token);
                            if (!resp.IsSuccessStatusCode) continue;

                            var respJson = await resp.Content.ReadAsStringAsync(timeoutCts.Token);
                            using var doc = JsonDocument.Parse(respJson);
                            var root = doc.RootElement;
                            if (root.TryGetProperty("candidates", out var candidates) && candidates.GetArrayLength() > 0)
                            {
                                var textPart = ExtractFirstCandidateText(root);
                                if (!string.IsNullOrWhiteSpace(textPart))
                                {
                                    var cleanJson = textPart.Trim();
                                    if (cleanJson.StartsWith("```json", StringComparison.OrdinalIgnoreCase))
                                        cleanJson = cleanJson[7..];
                                    if (cleanJson.StartsWith("```"))
                                        cleanJson = cleanJson[3..];
                                    if (cleanJson.EndsWith("```"))
                                        cleanJson = cleanJson[..^3];
                                    cleanJson = cleanJson.Trim();

                                    using var parsedDoc = JsonDocument.Parse(cleanJson);
                                    var r = parsedDoc.RootElement;
                                    var title = r.TryGetProperty("title", out var pT) ? pT.GetString() ?? "" : $"Quy Chuẩn Kỹ Thuật Canh Tác {cropName} VietGAP";
                                    var std = standardCode;
                                    var rawAuth = r.TryGetProperty("authorOrganization", out var pA) ? pA.GetString() ?? "" : "";
                                    var auth = string.IsNullOrWhiteSpace(rawAuth) || rawAuth.Contains("Cục Trồng Trọt", StringComparison.OrdinalIgnoreCase) || rawAuth.Contains("Bộ Nông Nghiệp", StringComparison.OrdinalIgnoreCase)
                                        ? "Hệ thống SmartFarm (Bản phác thảo tham khảo - Chưa thẩm định)"
                                        : rawAuth;
                                    var cat = category;
                                    var scope = cropName;
                                    var ver = "V1.0";
                                    var content = r.TryGetProperty("content", out var pCnt) ? pCnt.GetString() ?? "" : "";

                                    if (content.Length >= 200)
                                    {
                                        title = $"Bản nháp rà soát VietGAP {cropName} ({standardCode})";
                                        auth = "Hệ thống SmartFarm (Bản phác thảo tham khảo - Chưa thẩm định)";
                                        logger.LogInformation("[AI Draft] Successfully generated VietGAP draft for {Crop} via model {Model}.", cropName, m);
                                        return new VietGapDraftResult(title, std, auth, cat, scope, ver, content, IsFallback: false, Source: "ai");
                                    }
                                }
                            }
                        }
                        catch (Exception ex) when (ex is not OperationCanceledException)
                        {
                            logger.LogWarning(ex, "[AI Draft] Error calling Gemini model {Model} for {Crop}.", m, cropName);
                        }
                    }
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogWarning(ex, "[AI Draft] Gemini drafting encountered an issue for {Crop}. Falling back to standard template.", cropName);
            }
        }

        // Dự phòng tiêu chuẩn chuyên sâu nếu Gemini bận hoặc không có kết nối
        return BuildFallbackVietGapDraft(request);
    }

    internal static string? ExtractFirstCandidateText(JsonElement response)
    {
        if (!response.TryGetProperty("candidates", out var candidates) || candidates.ValueKind != JsonValueKind.Array)
            return null;
        foreach (var candidate in candidates.EnumerateArray())
        {
            if (!candidate.TryGetProperty("content", out var content) ||
                !content.TryGetProperty("parts", out var parts) ||
                parts.ValueKind != JsonValueKind.Array)
                continue;
            var candidateText = new StringBuilder();
            foreach (var part in parts.EnumerateArray())
            {
                if (part.TryGetProperty("text", out var text) && text.ValueKind == JsonValueKind.String &&
                    !string.IsNullOrWhiteSpace(text.GetString()))
                    candidateText.Append(text.GetString());
            }
            if (candidateText.Length > 0) return candidateText.ToString();
        }
        return null;
    }

    private static VietGapDraftResult BuildFallbackVietGapDraft(VietGapDraftRequest req)
    {
        var crop = req.CropName.Trim();
        var std = string.IsNullOrWhiteSpace(req.StandardCode) ? "Chưa cung cấp mã tiêu chuẩn" : req.StandardCode.Trim();
        var title = $"Khung rà soát VietGAP {crop} ({std})";
        var content = $@"[BẢN NHÁP THAM KHẢO - CHƯA ĐƯỢC THẨM ĐỊNH]

Đối tượng: {crop}
Tiêu chuẩn tham chiếu do người dùng chọn: {std}

Đây chỉ là khung để chuyên gia điền và đối chiếu. Hệ thống chưa có bản tiêu chuẩn gốc đi kèm yêu cầu này, vì vậy không tự đưa ra ngưỡng định lượng, khoảng cách, thời gian cách ly, danh mục cấm hay tuyên bố tuân thủ.

1. Phạm vi áp dụng và căn cứ: [Đối chiếu bản tiêu chuẩn hiện hành và phạm vi áp dụng]
2. Địa điểm, đất/giá thể và đánh giá nguy cơ: [Bổ sung theo hồ sơ cơ sở và nguồn pháp quy áp dụng]
3. Nguồn nước và kiểm soát chất lượng: [Bổ sung chỉ tiêu, phương pháp thử và căn cứ]
4. Vật tư nông nghiệp, phân bón và ghi chép: [Bổ sung theo nhãn, hồ sơ và quy định hiện hành]
5. Quản lý dịch hại và thuốc bảo vệ thực vật: [Đối chiếu danh mục được phép, nhãn và thời gian cách ly của từng sản phẩm]
6. Giai đoạn sinh trưởng và thông số canh tác: [Cần quy trình kỹ thuật riêng cho cây trồng, giống và mô hình]
7. Thu hoạch, sơ chế, bảo quản và truy xuất: [Bổ sung quy trình và căn cứ áp dụng]

Mọi nội dung trong ngoặc vuông cần được người có chuyên môn xác minh trước khi sử dụng.";
        return new VietGapDraftResult(
            title, std, "Hệ thống SmartFarm (Khung tham khảo - Chưa thẩm định)",
            req.Category ?? "general", crop, "DRAFT-REF", content,
            IsFallback: true, Source: "fallback");
    }


}
