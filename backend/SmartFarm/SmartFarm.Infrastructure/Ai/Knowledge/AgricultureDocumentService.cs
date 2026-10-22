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

    public async Task<bool> DeleteDocumentAsync(Guid documentId, Guid? tenantId, CancellationToken ct)
    {
        // Chỉ xóa tài liệu thuộc đúng tenant. Tài liệu nền tảng (TenantId null) cần luồng admin riêng.
        if (tenantId is null) return false;
        var doc = await db.AgricultureDocuments.FirstOrDefaultAsync(d => d.Id == documentId && d.TenantId == tenantId, ct);
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
        foreach (var (title, category, body) in SeedData.Documents)
        {
            if (await db.AgricultureDocuments.AnyAsync(d => d.Title == title, ct)) continue;

            await CreateDocumentAsync(title, null, "seed", body, "SmartFarm Platform (Chuẩn hóa VietGAP TCVN 11892-1:2017)",
                category, string.Empty, "v1", null, true, ct);
        }

        foreach (var (doc, chunks) in KnowledgeBaseSeedData.GetSeedDocuments())
        {
            if (await db.AgricultureDocuments.AnyAsync(d => d.Title == doc.Title, ct)) continue;

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

internal static class SeedData
{
    public static readonly (string Title, string Category, string Body)[] Documents =
    [
        ("Nguyên tắc tưới nước theo VietGAP", "irrigation",
         "Nguồn nước tưới phải được kiểm tra định kỳ để bảo đảm không bị ô nhiễm theo quy chuẩn QCVN 08-MT:2015/BTNMT.\n\nNên tưới vào sáng sớm hoặc chiều mát, tránh tưới lúc nắng gắt. Điều chỉnh lượng nước theo giai đoạn sinh trưởng và độ ẩm đất thực tế thay vì tưới theo thói quen.\n\nHạn chế để lá ướt kéo dài vào ban đêm vì làm tăng nguy cơ nấm bệnh. Tưới nhỏ giọt bù áp tự động giúp tiết kiệm nước, tối ưu phân bón và giảm thiểu tối đa các bệnh nấm hại rễ lá."),

        ("Quản lý dịch hại tổng hợp (IPM)", "pest",
         "Ưu tiên các biện pháp phòng ngừa sinh học và canh tác: vệ sinh đồng ruộng, chọn giống kháng bệnh, luân canh hợp lý, dùng bẫy dính màu vàng và lưới chắn côn trùng 50 mesh.\n\nThường xuyên thăm đồng phát hiện sớm. Chỉ dùng thuốc bảo vệ thực vật khi thật sự cần thiết và mật độ dịch hại vượt ngưỡng gây hại kinh tế. Dùng thuốc sinh học (Bt, Trichoderma, dầu khoáng), tuyệt đối tuân thủ thời gian cách ly (PHI) ghi trên nhãn.\n\nGhi chép đầy đủ tên hoạt chất, liều lượng, ngày phun và người thực hiện vào nhật ký số."),

        ("Quản lý phân bón và dinh dưỡng an toàn VietGAP", "nutrition",
         "Chỉ sử dụng phân bón thuộc danh mục được phép lưu hành tại Việt Nam. Ưu tiên phân hữu cơ đã ủ hoai mục bằng chế phẩm vi sinh đối kháng.\n\nCân đối tỷ lệ N-P-K theo từng thời kỳ sinh trưởng: giai đoạn cây con cần lân và humic kích rễ, giai đoạn thân lá cần đạm và trung lượng, giai đoạn ra hoa đậu trái cần tăng cường kali và canxi bo chống rụng hoa trái.\n\nNgừng bón phân hóa học và đạm trước thu hoạch tối thiểu 14 ngày để kiểm soát dư lượng nitrat (NO3-) an toàn cho người tiêu dùng."),

        ("Kiểm soát vi khí hậu và thông gió nhà màng", "climate",
         "Duy trì dải nhiệt độ và ẩm độ không khí thích hợp theo yêu cầu sinh lý của cây trồng. Khi nhiệt độ vượt ngưỡng, kích hoạt lưới cắt nắng và quạt đối lưu hoặc phun sương giảm nhiệt.\n\nTránh để độ ẩm không khí vượt quá 85% trong thời gian dài vì tạo điều kiện cho nấm mốc phát triển (phấn trắng, sương mai, thán thư). Mở quạt thông gió để trao đổi không khí và giảm ẩm mặt luống."),

        ("Quy trình thu hoạch và an toàn vệ sinh sản phẩm", "harvest",
         "Thu hoạch vào thời điểm mát trong ngày (sáng sớm hoặc chiều muộn), tránh thu hái lúc trời mưa hoặc nắng gắt.\n\nDụng cụ thu hái (kéo, dao, giỏ đựng) phải được làm sạch và khử trùng bằng cồn hoặc dung dịch sát khuẩn. Nước rửa sơ chế phải đạt quy chuẩn nước sinh hoạt QCVN 01-1:2018/BYT.\n\nSản phẩm đóng gói bằng bao bì chuyên dụng có tem nhãn mã QR truy xuất nguồn gốc đầy đủ lịch sử canh tác."),

        ("Ghi chép nhật ký và truy xuất nguồn gốc", "record",
         "VietGAP bắt buộc ghi chép minh bạch tất cả các hoạt động nông nghiệp: hạt giống, phân bón, thuốc bảo vệ thực vật, tưới tiêu, theo dõi sinh trưởng và thu hoạch.\n\nHồ sơ số hóa lưu trữ phục vụ truy xuất nguồn gốc khi có kiểm tra đánh giá. Mỗi lô sản phẩm phải xác định chính xác khu vực canh tác (Zone), ngày gieo trồng và ngày xuất kho.")
    ];
}
