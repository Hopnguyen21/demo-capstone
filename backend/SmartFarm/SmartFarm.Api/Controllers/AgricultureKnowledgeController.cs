using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using SmartFarm.Api.Extensions;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Infrastructure.Ai.Knowledge;

namespace SmartFarm.Api.Controllers;

[ApiController]
[Authorize]
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
        [FromQuery] int topK = 5,
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
    [Authorize(Roles = "PlatformAdmin,FarmOwner")]
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

            var isPlatformAdmin = User.IsInRole("PlatformAdmin");
            var tenantId = isPlatformAdmin && request.IsPublic ? (Guid?)null : User.GetTenantId();
            var isPublic = isPlatformAdmin ? request.IsPublic : false;

            var documentId = await documentService.IngestDocumentAsync(
                request.Title,
                request.File.FileName,
                ext,
                bytes,
                request.AuthorOrganization,
                request.Category ?? "general",
                request.CropScope ?? string.Empty,
                tenantId,
                isPublic,
                cancellationToken);

            return CreatedAtAction(nameof(GetDocument), new { documentId }, new { id = documentId, title = request.Title });
        }
        catch (Exception ex) when (ex is NotSupportedException or InvalidOperationException or ArgumentException)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Xóa một tài liệu khỏi kho tri thức.
    /// </summary>
    [HttpDelete("api/v1/ai/knowledge/documents/{documentId:guid}")]
    [Authorize(Roles = "PlatformAdmin,FarmOwner")]
    public async Task<IActionResult> DeleteDocument(Guid documentId, CancellationToken cancellationToken)
    {
        var tenantId = User.IsInRole("PlatformAdmin") ? (Guid?)null : User.GetTenantId();
        var deleted = await documentService.DeleteDocumentAsync(documentId, tenantId, cancellationToken);
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
    /// Nạp dữ liệu tri thức chuẩn hóa VietGAP khởi tạo nếu chưa có.
    /// </summary>
    [HttpPost("api/v1/ai/knowledge/seed")]
    [Authorize(Roles = "PlatformAdmin")]
    public async Task<ActionResult<object>> SeedVietGapKnowledge(CancellationToken cancellationToken)
    {
        await documentService.SeedVietGapKnowledgeAsync(cancellationToken);
        return Ok(new { message = "VietGAP knowledge base seed completed successfully." });
    }
}

public sealed class UploadKnowledgeDocumentRequest
{
    [Required, StringLength(300, MinimumLength = 3)]
    public string Title { get; init; } = string.Empty;

    public IFormFile? File { get; init; }

    [StringLength(200)]
    public string? AuthorOrganization { get; init; }

    [StringLength(50)]
    public string? Category { get; init; } = "general";

    [StringLength(500)]
    public string? CropScope { get; init; } = string.Empty;

    public bool IsPublic { get; init; } = true;
}
