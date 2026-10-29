using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using SmartFarm.Api.Extensions;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Domain.Entities;
using SmartFarm.Infrastructure.Ai.Knowledge;

namespace SmartFarm.Api.Controllers;

[ApiController]
// Kho tri thức chỉ do PlatformAdmin quản lý. FarmOwner/Farmer không xem danh sách, toàn văn hay file gốc;
// họ chỉ nhận đoạn trích nguồn đã duyệt kèm câu trả lời của trợ lý AI.
[Authorize(Roles = "PlatformAdmin")]
public sealed class AgricultureKnowledgeController(IAgricultureDocumentService documentService) : ControllerBase
{
    /// <summary>
    /// Lấy danh sách tài liệu trong kho tri thức nông học (VietGAP, canh tác, dịch bệnh).
    /// API catalog #89
    /// </summary>
    [HttpGet("api/v1/ai/knowledge-base")]
    [HttpGet("api/v1/ai/knowledge/documents")]
    public async Task<ActionResult<IReadOnlyList<AgricultureDocumentSummaryView>>> GetDocuments(
        [FromQuery] string? category,
        CancellationToken cancellationToken)
    {
        var tenantId = User.IsInRole("PlatformAdmin") ? (Guid?)null : User.GetTenantId();
        var documents = await documentService.GetDocumentsAsync(tenantId, category, cancellationToken);
        return Ok(documents);
    }

    /// <summary>
    /// Lấy chi tiết tài liệu kèm danh sách các đoạn (chunks) và trạng thái embedding.
    /// </summary>
    [HttpGet("api/v1/ai/knowledge/documents/{documentId:guid}")]
    public async Task<ActionResult<AgricultureDocumentDetailView>> GetDocument(
        Guid documentId,
        CancellationToken cancellationToken)
    {
        var tenantId = User.IsInRole("PlatformAdmin") ? (Guid?)null : User.GetTenantId();
        var document = await documentService.GetDocumentByIdAsync(documentId, tenantId, cancellationToken);
        if (document is null) return NotFound();
        return Ok(document);
    }

    /// <summary>
    /// Tìm kiếm tri thức nông học (Semantic search RAG) theo câu hỏi hoặc từ khóa.
    /// </summary>
    [HttpGet("api/v1/ai/knowledge/search")]
    public async Task<ActionResult<IReadOnlyList<KnowledgePassageView>>> Search(
        [FromQuery, Required, MinLength(2)] string query,
        [FromQuery] string? cropName,
        [FromQuery, Range(1, 20)] int topK = 5,
        CancellationToken cancellationToken = default)
    {
        var tenantId = User.IsInRole("PlatformAdmin") ? (Guid?)null : User.GetTenantId();
        var passages = await documentService.SearchAsync(query, cropName, tenantId, topK, cancellationToken);
        return Ok(passages);
    }

    /// <summary>
    /// Tải lên và nạp tài liệu mới (PDF, DOCX, TXT) vào kho tri thức RAG.
    /// API catalog #90
    /// </summary>
    [HttpPost("api/v1/ai/knowledge-base")]
    [HttpPost("api/v1/ai/knowledge/documents")]
    [Authorize(Roles = "PlatformAdmin")]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<object>> UploadDocument(
        [FromForm] UploadKnowledgeDocumentRequest request,
        CancellationToken cancellationToken)
    {
        if (request.File is null || request.File.Length == 0)
            return BadRequest("File is required and must not be empty.");

        if (request.File.Length > DocumentTextExtractor.MaxFileBytes)
            return BadRequest($"File size exceeds maximum allowed size of {DocumentTextExtractor.MaxFileBytes / (1024 * 1024)}MB.");

        var ext = Path.GetExtension(request.File.FileName).TrimStart('.').ToLowerInvariant();
        if (ext is not ("pdf" or "docx" or "txt"))
            return BadRequest($"Unsupported file type '{ext}'. Allowed types: PDF, DOCX, TXT.");

        try
        {
            using var ms = new MemoryStream();
            await request.File.CopyToAsync(ms, cancellationToken);
            var bytes = ms.ToArray();
            DocumentTextExtractor.ValidateFileSignature(bytes, ext);

            var isPlatformAdmin = User.IsInRole("PlatformAdmin");
            Guid? tenantId = null;
            if (isPlatformAdmin)
            {
                try { tenantId = User.GetOptionalTenantId(); } catch { tenantId = null; }
            }
            else
            {
                tenantId = User.GetTenantId();
            }
            var isPublic = isPlatformAdmin ? request.IsPublic : false;
            if (isPlatformAdmin && tenantId == null)
            {
                // Tài liệu do PlatformAdmin nạp không gắn tenant cụ thể bắt buộc phải là Public để không bị thất lạc
                isPublic = true;
            }

            var documentId = await documentService.IngestDocumentAsync(
                request.Title ?? string.Empty,
                request.File.FileName,
                ext,
                bytes,
                request.AuthorOrganization,
                request.Category ?? "general",
                request.CropScope ?? string.Empty,
                request.Version,
                request.DocumentType,
                request.Topics,
                tenantId,
                isPublic,
                cancellationToken);

            var saved = await documentService.GetDocumentByIdAsync(documentId, null, cancellationToken);
            return CreatedAtAction(nameof(GetDocument), new { documentId }, new
            {
                id = documentId,
                title = saved?.Title ?? request.Title,
                cropScope = saved?.CropScope,
                authorOrganization = saved?.AuthorOrganization,
                version = saved?.Version,
                category = saved?.Category,
                reviewStatus = saved?.ReviewStatus,
                reviewNotes = saved?.ReviewNotes,
                message = "Tài liệu đã lưu độc lập với Growth Profile ở trạng thái chờ người duyệt; tài liệu chỉ vào RAG sau khi được xác nhận."
            });
        }
        catch (Exception ex) when (ex is NotSupportedException or InvalidOperationException or ArgumentException or IOException)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Cập nhật thông tin hoặc nội dung tài liệu (tải file mới đè lên hoặc sửa text/version).
    /// Tự động xóa vector chunks cũ và sinh lại embeddings mới cho phiên bản mới.
    /// </summary>
    [HttpPut("api/v1/ai/knowledge/documents/{documentId:guid}")]
    [Authorize(Roles = "PlatformAdmin")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> UpdateDocument(
        Guid documentId,
        [FromForm] UpdateKnowledgeDocumentRequest request,
        CancellationToken cancellationToken)
    {
        var isPlatformAdmin = User.IsInRole("PlatformAdmin");
        var tenantId = isPlatformAdmin ? (Guid?)null : User.GetTenantId();

        byte[]? fileBytes = null;
        string? ext = null;
        if (request.File is { Length: > 0 })
        {
            if (request.File.Length > DocumentTextExtractor.MaxFileBytes)
                return BadRequest($"File size exceeds maximum allowed size of {DocumentTextExtractor.MaxFileBytes / (1024 * 1024)}MB.");

            ext = Path.GetExtension(request.File.FileName).TrimStart('.').ToLowerInvariant();
            if (ext is not ("pdf" or "docx" or "txt"))
                return BadRequest($"Unsupported file type '{ext}'. Allowed types: PDF, DOCX, TXT.");

            using var ms = new MemoryStream();
            await request.File.CopyToAsync(ms, cancellationToken);
            fileBytes = ms.ToArray();
        }

        try
        {
            if (fileBytes != null && ext != null)
            {
                DocumentTextExtractor.ValidateFileSignature(fileBytes, ext);
            }
            var updated = await documentService.UpdateDocumentAsync(
                documentId,
                request.Title,
                request.File?.FileName,
                ext,
                fileBytes,
                request.ContentText,
                request.AuthorOrganization,
                request.Category ?? "general",
                request.CropScope ?? string.Empty,
                request.Version,
                tenantId,
                isPlatformAdmin,
                cancellationToken);

            if (!updated) return NotFound();
            return Ok(new { message = "Đã cập nhật toàn văn và chunks. Embedding sẽ được xử lý nền.", documentId });
        }
        catch (Exception ex) when (ex is NotSupportedException or InvalidOperationException or ArgumentException or IOException)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>Tải file gốc trong phạm vi quyền tenant để đối chiếu nội dung OCR.</summary>
    [HttpGet("api/v1/ai/knowledge/documents/{documentId:guid}/file")]
    [Authorize(Roles = "PlatformAdmin")]
    public async Task<IActionResult> DownloadOriginalFile(Guid documentId, CancellationToken cancellationToken)
    {
        var isPlatformAdmin = User.IsInRole("PlatformAdmin");
        var tenantId = isPlatformAdmin ? (Guid?)null : User.GetTenantId();
        var file = await documentService.GetOriginalFileAsync(documentId, tenantId, isPlatformAdmin, cancellationToken);
        if (file is null) return NotFound(new { message = "Không tìm thấy file gốc đã lưu cho tài liệu này." });
        return File(file.Content, file.ContentType, file.FileName);
    }

    /// <summary>Ghi nhận việc đối chiếu nội dung OCR/toàn văn với tài liệu gốc.</summary>
    [HttpPost("api/v1/ai/knowledge/documents/{documentId:guid}/review")]
    [Authorize(Roles = "PlatformAdmin")]
    public async Task<IActionResult> ReviewDocument(
        Guid documentId,
        [FromBody] ReviewKnowledgeDocumentDto request,
        CancellationToken cancellationToken)
    {
        var isPlatformAdmin = User.IsInRole("PlatformAdmin");
        var tenantId = isPlatformAdmin ? (Guid?)null : User.GetTenantId();
        var reviewed = await documentService.ReviewDocumentAsync(
            documentId, request.ContentText, request.Approve, request.ReviewNotes,
            tenantId, isPlatformAdmin, cancellationToken);
        if (!reviewed) return NotFound();
        return Ok(new
        {
            reviewStatus = request.Approve ? "Approved" : "NeedsCorrection",
            message = request.Approve
                ? "Đã xác nhận tài liệu. Nội dung này được phép dùng cho RAG và sinh profile."
                : "Đã lưu nội dung rà soát với trạng thái cần chỉnh sửa."
        });
    }

    /// <summary>Chạy lại AI trích các trường VietGAP kèm trích dẫn (tài liệu cũ hoặc sau khi sửa toàn văn).</summary>
    [HttpPost("api/v1/ai/knowledge/documents/{documentId:guid}/extract")]
    [Authorize(Roles = "PlatformAdmin")]
    public async Task<ActionResult<VietGapStructuredExtraction>> ReextractDocument(Guid documentId, CancellationToken cancellationToken) =>
        Ok(await documentService.ReextractDocumentAsync(documentId, cancellationToken));

    /// <summary>
    /// Xóa một tài liệu khỏi kho tri thức.
    /// </summary>
    [HttpDelete("api/v1/ai/knowledge/documents/{documentId:guid}")]
    [Authorize(Roles = "PlatformAdmin")]
    public async Task<IActionResult> DeleteDocument(Guid documentId, CancellationToken cancellationToken)
    {
        var isPlatformAdmin = User.IsInRole("PlatformAdmin");
        var tenantId = isPlatformAdmin ? (Guid?)null : User.GetTenantId();
        var deleted = await documentService.DeleteDocumentAsync(documentId, tenantId, isPlatformAdmin, cancellationToken);
        if (!deleted) return NotFound();
        return NoContent();
    }

    /// <summary>
    /// Kích hoạt tạo lại embedding cho các đoạn tri thức chưa có vector embedding.
    /// </summary>
    [HttpPost("api/v1/ai/knowledge/backfill-embeddings")]
    [HttpPost("api/v1/ai/knowledge/backfill")]
    [Authorize(Roles = "PlatformAdmin")]
    public async Task<ActionResult<object>> BackfillEmbeddings(CancellationToken cancellationToken)
    {
        var count = await documentService.BackfillEmbeddingsAsync(cancellationToken);
        return Ok(new { message = $"Successfully backfilled embeddings for {count} chunks.", backfilledCount = count });
    }

    /// <summary>
    /// Chia lại mọi tài liệu theo mục/trang (tài liệu nhập trước khi có StructuredChunker). Trạng thái duyệt giữ nguyên;
    /// vector của tài liệu đã duyệt được worker nền tạo lại.
    /// </summary>
    [HttpPost("api/v1/ai/knowledge/rechunk")]
    [Authorize(Roles = "PlatformAdmin")]
    public async Task<ActionResult<object>> RechunkDocuments(CancellationToken cancellationToken)
    {
        var count = await documentService.RechunkAllDocumentsAsync(cancellationToken);
        return Ok(new { message = $"Đã chia lại thành {count} đoạn; vector đang được tạo lại nền.", chunkCount = count });
    }

    /// <summary>
    /// Nạp dữ liệu tri thức chuẩn hóa VietGAP khởi tạo nếu chưa có.
    /// </summary>
    [HttpPost("api/v1/ai/knowledge/seed")]
    [Authorize(Roles = "PlatformAdmin")]
    public async Task<ActionResult<object>> SeedVietGapKnowledge(CancellationToken cancellationToken)
    {
        await documentService.SeedVietGapKnowledgeAsync(cancellationToken);
        return Ok(new { message = "VietGAP knowledge base seed completed successfully." });
    }

    /// <summary>
    /// Yêu cầu AI soạn thảo bản nháp VietGAP theo yêu cầu, không mặc định mã tiêu chuẩn.
    /// Người dùng sẽ kiểm tra và hiệu đính nội dung trước khi quyết định lưu vào CSDL.
    /// </summary>
    [HttpPost("api/v1/ai/knowledge/draft")]
    [Authorize(Roles = "PlatformAdmin")]
    public async Task<ActionResult<VietGapDraftResult>> GenerateDraft(
        [FromBody] GenerateVietGapDraftDto dto,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(dto.CropName))
            return BadRequest(new { message = "Tên cây trồng không được để trống." });

        var request = new VietGapDraftRequest(
            dto.CropName.Trim(),
            string.IsNullOrWhiteSpace(dto.StandardCode) ? "Chưa cung cấp mã tiêu chuẩn" : dto.StandardCode.Trim(),
            dto.Category ?? "general",
            dto.CultivationModel,
            dto.AdditionalRequirements);

        var result = await documentService.GenerateVietGapDraftAsync(request, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Sử dụng AI để soạn thảo Hồ Sơ Sinh Trưởng (Growth Profile) theo template của hệ thống SmartFarm
    /// dựa trên tài liệu kỹ thuật VietGAP và mô hình canh tác.
    /// </summary>
    [HttpPost("api/v1/ai/knowledge/draft-growth-profile")]
    [Authorize(Roles = "PlatformAdmin")]
    public async Task<ActionResult<VietGapGrowthProfileDraftResult>> GenerateGrowthProfileDraft(
        [FromBody] GenerateGrowthProfileDraftDto dto,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(dto.CropName))
            return BadRequest(new { message = "Tên cây trồng không được để trống." });

        var isPlatformAdmin = User.IsInRole("PlatformAdmin");
        var tenantId = isPlatformAdmin ? (Guid?)null : User.GetTenantId();
        var stageCount = dto.StageCount is >= 2 and <= 6 ? dto.StageCount : 4;

        // Không chọn tài liệu: gom mọi tài liệu đã duyệt của cây trồng (thu hoạch, sâu bệnh, tưới... từ nhiều file).
        // Profile chỉ được tạo khi các tài liệu đó cùng cung cấp đủ giai đoạn và ngưỡng có trích dẫn.
        if (dto.DocumentId is null || dto.DocumentId == Guid.Empty)
        {
            var bundle = await documentService.BuildCropSourceBundleAsync(dto.CropName.Trim(), tenantId, cancellationToken);
            if (bundle is null)
                return Conflict(new { message = $"Chưa có tài liệu đã duyệt nào cho cây \"{dto.CropName.Trim()}\". Hãy tải lên và duyệt tài liệu trước." });

            var draft = await documentService.GenerateGrowthProfileDraftAsync(
                new VietGapGrowthProfileDraftRequest(dto.CropName.Trim(), bundle.CombinedContent, dto.CultivationModel, stageCount),
                cancellationToken);
            if (draft.IsFallback)
                return Conflict(new
                {
                    message = $"Các tài liệu đã duyệt của cây \"{dto.CropName.Trim()}\" chưa đủ dữ liệu có trích dẫn (giai đoạn, số ngày, " +
                              "nhiệt độ, độ ẩm không khí, ẩm đất, pH cho từng giai đoạn) để tạo Growth Profile. Bổ sung và duyệt thêm tài liệu.",
                    sourceDocuments = bundle.Documents.Select(d => d.Title)
                });
            return Ok(AgricultureDocumentService.AttributeSources(draft, bundle));
        }

        var sourceDocument = await documentService.GetDocumentByIdAsync(dto.DocumentId.Value, tenantId, cancellationToken);
        if (sourceDocument is null) return NotFound(new { message = "Không tìm thấy tài liệu nguồn hoặc bạn không có quyền truy cập." });
        if (sourceDocument.ReviewStatus != "Approved")
            return Conflict(new { message = "Tài liệu nguồn chưa được đối chiếu và duyệt. Hãy rà soát tài liệu trước khi tạo profile." });
        if (string.IsNullOrWhiteSpace(sourceDocument.ContentText) || sourceDocument.ContentText.Trim().Length < 50)
            return BadRequest(new { message = "Tài liệu đã duyệt không có đủ nội dung để tạo profile." });
        if (sourceDocument.ContentText.Length > 200_000)
            return BadRequest(new { message = "Toàn văn tài liệu vượt giới hạn 200.000 ký tự cho một lần phân tích; hãy chia tài liệu thành các phần nhỏ hơn." });

        var request = new VietGapGrowthProfileDraftRequest(
            dto.CropName.Trim(),
            sourceDocument.ContentText,
            dto.CultivationModel,
            dto.StageCount is >= 2 and <= 6 ? dto.StageCount : 4);

        var result = await documentService.GenerateGrowthProfileDraftAsync(request, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Lưu trực tiếp tài liệu quy chuẩn dạng văn bản đã soạn thảo/chỉnh sửa vào CSDL.
    /// Tự động chia các chunks và sinh vector embeddings (pgvector).
    /// </summary>
    [HttpPost("api/v1/ai/knowledge/documents/text")]
    [Authorize(Roles = "PlatformAdmin")]
    public async Task<ActionResult<object>> SaveTextDocument(
        [FromBody] SaveTextDocumentDto dto,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(dto.Title) || dto.Title.Trim().Length < 3)
            return BadRequest(new { message = "Tiêu đề phải từ 3 đến 300 ký tự." });

        if (string.IsNullOrWhiteSpace(dto.Content) || dto.Content.Trim().Length < 50)
            return BadRequest(new { message = "Nội dung văn bản quy chuẩn phải có ít nhất 50 ký tự." });

        var isPlatformAdmin = User.IsInRole("PlatformAdmin");
        Guid? tenantId = null;
        if (isPlatformAdmin)
        {
            try { tenantId = User.GetOptionalTenantId(); } catch { tenantId = null; }
        }
        else
        {
            tenantId = User.GetTenantId();
        }

        var isPublic = isPlatformAdmin ? dto.IsPublic : false;
        if (isPlatformAdmin && tenantId == null) isPublic = true;

        var documentId = await documentService.IngestTextDocumentAsync(
            dto.Title,
            dto.Content,
            dto.AuthorOrganization,
            dto.Category ?? "general",
            dto.CropScope ?? string.Empty,
            dto.Version ?? "V1.0",
            dto.DocumentType,
            dto.Topics,
            tenantId,
            isPublic,
            cancellationToken);

        return CreatedAtAction(nameof(GetDocument), new { documentId }, new
        {
            id = documentId,
            title = dto.Title,
            message = "AI đã xác nhận tài liệu đủ thông tin. Đã lưu ở trạng thái chờ đối chiếu; tài liệu chỉ vào RAG sau khi người duyệt xác nhận."
        });
    }
}

public sealed class ReviewKnowledgeDocumentDto
{
    [Required, MinLength(50), StringLength(200000)]
    public string ContentText { get; init; } = string.Empty;

    public bool Approve { get; init; }

    [StringLength(2000)]
    public string? ReviewNotes { get; init; }
}

public sealed class GenerateVietGapDraftDto
{
    [Required, StringLength(100, MinimumLength = 1)]
    public string CropName { get; init; } = string.Empty;

    [StringLength(100)]
    public string? StandardCode { get; init; }

    [StringLength(50)]
    public string? Category { get; init; } = "general";

    [StringLength(100)]
    public string? CultivationModel { get; init; }

    [StringLength(1000)]
    public string? AdditionalRequirements { get; init; }
}

public sealed class SaveTextDocumentDto
{
    [Required, StringLength(300, MinimumLength = 3)]
    public string Title { get; init; } = string.Empty;

    [Required, MinLength(50)]
    public string Content { get; init; } = string.Empty;

    [StringLength(200)]
    public string? AuthorOrganization { get; init; }

    [StringLength(50)]
    public string? Category { get; init; } = "general";

    [StringLength(500)]
    public string? CropScope { get; init; } = string.Empty;

    [StringLength(50)]
    public string? Version { get; init; } = "V1.0";

    public bool IsPublic { get; init; } = true;

    /// <summary>Loại tài liệu quyết định mục bắt buộc: OfficialStandard, TechnicalGuide, Thematic (chuyên đề theo Category).</summary>
    public AgricultureDocumentType DocumentType { get; init; } = AgricultureDocumentType.OfficialStandard;

    /// <summary>Chủ đề tài liệu bao quát: irrigation, pest, nutrition, harvest, record, climate, soil (có thể nhiều).</summary>
    public List<string>? Topics { get; init; }
}

public sealed class UploadKnowledgeDocumentRequest
{
    /// <summary>Không bắt buộc: bỏ trống thì server lấy tiêu đề từ nội dung file.</summary>
    [StringLength(300)]
    public string? Title { get; init; }

    public IFormFile? File { get; init; }

    [StringLength(200)]
    public string? AuthorOrganization { get; init; }

    [StringLength(50)]
    public string? Category { get; init; } = "general";

    [StringLength(500)]
    public string? CropScope { get; init; } = string.Empty;

    [StringLength(50)]
    public string? Version { get; init; }

    public bool IsPublic { get; init; } = true;

    /// <summary>Loại tài liệu quyết định mục bắt buộc: OfficialStandard, TechnicalGuide, Thematic (chuyên đề theo Category).</summary>
    public AgricultureDocumentType DocumentType { get; init; } = AgricultureDocumentType.OfficialStandard;

    /// <summary>Chủ đề tài liệu bao quát: irrigation, pest, nutrition, harvest, record, climate, soil (có thể nhiều).</summary>
    public List<string>? Topics { get; init; }
}

public sealed class UpdateKnowledgeDocumentRequest
{
    [Required, StringLength(300, MinimumLength = 3)]
    public string Title { get; init; } = string.Empty;

    public IFormFile? File { get; init; }

    public string? ContentText { get; init; }

    [StringLength(200)]
    public string? AuthorOrganization { get; init; }

    [StringLength(50)]
    public string? Category { get; init; } = "general";

    [StringLength(500)]
    public string? CropScope { get; init; } = string.Empty;

    [StringLength(50)]
    public string? Version { get; init; }
}

public sealed class GenerateGrowthProfileDraftDto
{
    [Required, StringLength(100, MinimumLength = 1)]
    public string CropName { get; init; } = string.Empty;

    /// <summary>Tùy chọn: một tài liệu cụ thể. Bỏ trống để gom mọi tài liệu đã duyệt của cây trồng.</summary>
    public Guid? DocumentId { get; init; }

    [StringLength(100)]
    public string? CultivationModel { get; init; }

    [Range(2, 6)]
    public int StageCount { get; init; } = 4;
}
