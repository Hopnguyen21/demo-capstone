using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Domain.Entities;
using SmartFarm.Infrastructure.Persistence;
using Xunit;

namespace SmartFarm.Api.Tests;

public sealed class VietGapVersioningAndRagTests
{
    private const string OriginalDocText = """
        TIÊU CHUẨN QUỐC GIA TCVN 11892-1:2017 QUY TRÌNH VIETGAP TRỒNG CÀ CHUA
        Cây trồng áp dụng: Cà chua
        Tác giả: Cục Trồng trọt - Bộ Nông nghiệp và PTNT
        Nguồn nước tưới phải đảm bảo quy chuẩn QCVN 08-MT:2015/BTNMT không nhiễm E.Coli và Salmonella.
        Thời gian cách ly thuốc bảo vệ thực vật trước khi thu hoạch (PHI) tối thiểu là 14 ngày.
        Tuyệt đối cấm sử dụng các loại phân bón và thuốc BVTV ngoài danh mục được phép lưu hành.
        """;

    private const string UpdatedDocText = """
        TIÊU CHUẨN QUỐC GIA TCVN 11892-1:2026 QUY TRÌNH VIETGAP TRỒNG CÀ CHUA PHIÊN BẢN 2
        Cây trồng áp dụng: Cà chua
        Tác giả: Cục Trồng trọt - Bộ Nông nghiệp và PTNT
        Nguồn nước tưới phải đảm bảo quy chuẩn nước tưới hiện hành, vi sinh vật E.Coli dưới 100 CFU/100ml.
        Thời gian cách ly thuốc bảo vệ thực vật sinh học thế hệ mới (PHI) rút ngắn còn 7 ngày đối với nhóm sinh học.
        Bắt buộc ghi chép nhật ký điện tử và dán mã QR truy xuất nguồn gốc trước khi xuất bán.
        """;

    private sealed record LoginPayload(string AccessToken);

    private static async Task LoginAsync(HttpClient client, string email)
    {
        var response = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = "ValidPassword1!" });
        response.EnsureSuccessStatusCode();
        var payload = await response.Content.ReadFromJsonAsync<LoginPayload>();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", payload!.AccessToken);
    }

    private static async Task<Guid> UploadAndApproveDocumentAsync(TestApplicationFactory factory, HttpClient client)
    {
        var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(Encoding.UTF8.GetBytes(OriginalDocText));
        file.Headers.ContentType = new MediaTypeHeaderValue("text/plain");
        form.Add(file, "File", "tcvn_cachua_v1.txt");
        form.Add(new StringContent("TCVN 11892-1:2017"), "StandardCode");
        form.Add(new StringContent("V1.0"), "Version");

        var response = await client.PostAsync("/api/v1/ai/knowledge/documents", form);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
        var docId = body.GetProperty("id").GetGuid();

        // Review and approve document
        var reviewRes = await client.PostAsJsonAsync($"/api/v1/ai/knowledge/documents/{docId}/review", new
        {
            ContentText = OriginalDocText,
            Approve = true,
            Title = "Quy chuẩn VietGAP Cà chua V1.0",
            CropScope = "Cà chua",
            StandardCode = "TCVN 11892-1:2017",
            Version = "V1.0",
            DocumentType = "OfficialStandard",
            ReviewNotes = "Đã đối chiếu đầy đủ với tiêu chuẩn gốc của Cục Trồng trọt."
        });
        Assert.Equal(HttpStatusCode.OK, reviewRes.StatusCode);

        return docId;
    }

    [Fact]
    public async Task Update_approved_document_creates_new_version_with_previous_version_id_and_preserves_original_approved()
    {
        using var factory = new TestApplicationFactory();
        await factory.SeedAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, "admin@example.com");

        var originalDocId = await UploadAndApproveDocumentAsync(factory, client);

        // Update document with new version
        var updateForm = new MultipartFormDataContent();
        updateForm.Add(new StringContent("Quy chuẩn VietGAP Cà chua V2.0"), "Title");
        updateForm.Add(new StringContent("V2.0"), "Version");
        updateForm.Add(new StringContent("TCVN 11892-1:2026"), "StandardCode");
        updateForm.Add(new StringContent("Cà chua"), "CropScope");
        updateForm.Add(new StringContent("OfficialStandard"), "DocumentType");
        updateForm.Add(new StringContent(UpdatedDocText), "ContentText");
        updateForm.Add(new StringContent("Cập nhật quy chuẩn mới theo hướng dẫn 2026"), "ReviewNotes");

        var updateResponse = await client.PutAsync($"/api/v1/ai/knowledge/documents/{originalDocId}", updateForm);
        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);

        var updateResult = JsonDocument.Parse(await updateResponse.Content.ReadAsStringAsync()).RootElement;
        Assert.True(updateResult.GetProperty("isNewVersion").GetBoolean());
        var newDocId = updateResult.GetProperty("documentId").GetGuid();
        Assert.NotEqual(originalDocId, newDocId);
        Assert.Equal(originalDocId, updateResult.GetProperty("previousVersionId").GetGuid());
        Assert.Equal("PendingReview", updateResult.GetProperty("reviewStatus").GetString());

        // Verify DB states: Original is STILL Approved, New is PendingReview
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();

        var originalDoc = await db.AgricultureDocuments.Include(d => d.Chunks).SingleAsync(d => d.Id == originalDocId);
        Assert.Equal(AgricultureDocumentReviewStatus.Approved, originalDoc.ReviewStatus);
        Assert.NotEmpty(originalDoc.Chunks);

        var newDoc = await db.AgricultureDocuments.Include(d => d.Chunks).SingleAsync(d => d.Id == newDocId);
        Assert.Equal(AgricultureDocumentReviewStatus.PendingReview, newDoc.ReviewStatus);
        Assert.Equal(originalDocId, newDoc.PreviousVersionId);
        Assert.NotEmpty(newDoc.Chunks);
    }

    [Fact]
    public async Task Rag_search_continues_returning_passages_from_original_while_new_version_is_pending()
    {
        using var factory = new TestApplicationFactory();
        await factory.SeedAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, "admin@example.com");

        var originalDocId = await UploadAndApproveDocumentAsync(factory, client);

        // Create V2 version
        var updateForm = new MultipartFormDataContent();
        updateForm.Add(new StringContent("Quy chuẩn VietGAP Cà chua V2.0"), "Title");
        updateForm.Add(new StringContent("V2.0"), "Version");
        updateForm.Add(new StringContent("TCVN 11892-1:2026"), "StandardCode");
        updateForm.Add(new StringContent(UpdatedDocText), "ContentText");

        var updateResponse = await client.PutAsync($"/api/v1/ai/knowledge/documents/{originalDocId}", updateForm);
        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);

        // Perform RAG search while V2 is PendingReview
        using var scope = factory.Services.CreateScope();
        var docService = scope.ServiceProvider.GetRequiredService<IAgricultureDocumentService>();

        var passages = await docService.SearchAsync("cách ly", "Cà chua", null, 5, CancellationToken.None);
        Assert.NotEmpty(passages);

        // All returned passages must belong to originalDocId (Approved V1), NOT newDocId (PendingReview V2)
        foreach (var passage in passages)
        {
            Assert.Equal("V1.0", passage.Version);
            Assert.Contains("14 ngày", passage.Content);
        }
    }

    [Fact]
    public async Task Approving_new_version_supersedes_original_and_activates_new_version_in_rag()
    {
        using var factory = new TestApplicationFactory();
        await factory.SeedAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, "admin@example.com");

        var originalDocId = await UploadAndApproveDocumentAsync(factory, client);

        // Create V2
        var updateForm = new MultipartFormDataContent();
        updateForm.Add(new StringContent("Quy chuẩn VietGAP Cà chua V2.0"), "Title");
        updateForm.Add(new StringContent("V2.0"), "Version");
        updateForm.Add(new StringContent("TCVN 11892-1:2026"), "StandardCode");
        updateForm.Add(new StringContent(UpdatedDocText), "ContentText");

        var updateResponse = await client.PutAsync($"/api/v1/ai/knowledge/documents/{originalDocId}", updateForm);
        var newDocId = JsonDocument.Parse(await updateResponse.Content.ReadAsStringAsync()).RootElement.GetProperty("documentId").GetGuid();

        // Approve V2
        var reviewRes = await client.PostAsJsonAsync($"/api/v1/ai/knowledge/documents/{newDocId}/review", new
        {
            ContentText = UpdatedDocText,
            Approve = true,
            Title = "Quy chuẩn VietGAP Cà chua V2.0",
            CropScope = "Cà chua",
            StandardCode = "TCVN 11892-1:2026",
            Version = "V2.0",
            DocumentType = "OfficialStandard",
            ReviewNotes = "Phê duyệt phiên bản V2.0 chính thức thay thế V1.0."
        });
        Assert.Equal(HttpStatusCode.OK, reviewRes.StatusCode);

        // Verify DB states: Original is Superseded with SupersededByDocumentId = newDocId
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();

        var originalDoc = await db.AgricultureDocuments.SingleAsync(d => d.Id == originalDocId);
        Assert.Equal(AgricultureDocumentReviewStatus.Superseded, originalDoc.ReviewStatus);
        Assert.Equal(newDocId, originalDoc.SupersededByDocumentId);

        var newDoc = await db.AgricultureDocuments.SingleAsync(d => d.Id == newDocId);
        Assert.Equal(AgricultureDocumentReviewStatus.Approved, newDoc.ReviewStatus);

        // RAG search now returns V2 passages!
        var docService = scope.ServiceProvider.GetRequiredService<IAgricultureDocumentService>();
        var passages = await docService.SearchAsync("cách ly", "Cà chua", null, 5, CancellationToken.None);
        Assert.NotEmpty(passages);

        var v2Passage = passages.FirstOrDefault(p => p.Version == "V2.0");
        Assert.NotNull(v2Passage);
        Assert.Equal("TCVN 11892-1:2026", v2Passage.StandardCode);
        Assert.Contains("7 ngày", v2Passage.Content);
    }

    [Fact]
    public async Task Corrupted_or_short_content_returns_bad_request_and_does_not_modify_approved_doc()
    {
        using var factory = new TestApplicationFactory();
        await factory.SeedAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, "admin@example.com");

        var originalDocId = await UploadAndApproveDocumentAsync(factory, client);

        var updateForm = new MultipartFormDataContent();
        updateForm.Add(new StringContent("Quy chuẩn lỗi"), "Title");
        updateForm.Add(new StringContent("Nội dung quá ngắn"), "ContentText");

        var response = await client.PutAsync($"/api/v1/ai/knowledge/documents/{originalDocId}", updateForm);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        // Verify original doc is untouched
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        var doc = await db.AgricultureDocuments.SingleAsync(d => d.Id == originalDocId);
        Assert.Equal(AgricultureDocumentReviewStatus.Approved, doc.ReviewStatus);
        Assert.Equal("V1.0", doc.Version);
    }

    [Fact]
    public async Task Archive_document_sets_archived_status_and_excludes_from_rag()
    {
        using var factory = new TestApplicationFactory();
        await factory.SeedAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, "admin@example.com");

        var docId = await UploadAndApproveDocumentAsync(factory, client);

        // Archive document
        var archiveResponse = await client.PostAsJsonAsync($"/api/v1/ai/knowledge/documents/{docId}/archive", new
        {
            Reason = "Quy chuẩn hết hiệu lực năm 2026."
        });
        Assert.Equal(HttpStatusCode.OK, archiveResponse.StatusCode);

        // Verify status is Archived
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        var doc = await db.AgricultureDocuments.SingleAsync(d => d.Id == docId);
        Assert.Equal(AgricultureDocumentReviewStatus.Archived, doc.ReviewStatus);

        // Search returns 0 passages because it is archived
        var docService = scope.ServiceProvider.GetRequiredService<IAgricultureDocumentService>();
        var passages = await docService.SearchAsync("cách ly", "Cà chua", null, 5, CancellationToken.None);
        Assert.Empty(passages);
    }

    [Fact]
    public async Task Audit_logs_are_recorded_for_versioning_approval_and_archiving()
    {
        using var factory = new TestApplicationFactory();
        await factory.SeedAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, "admin@example.com");

        var originalDocId = await UploadAndApproveDocumentAsync(factory, client);

        // Update -> creates new version
        var updateForm = new MultipartFormDataContent();
        updateForm.Add(new StringContent("Quy chuẩn V2"), "Title");
        updateForm.Add(new StringContent("V2.0"), "Version");
        updateForm.Add(new StringContent(UpdatedDocText), "ContentText");

        var updateResponse = await client.PutAsync($"/api/v1/ai/knowledge/documents/{originalDocId}", updateForm);
        var newDocId = JsonDocument.Parse(await updateResponse.Content.ReadAsStringAsync()).RootElement.GetProperty("documentId").GetGuid();

        // Archive new version
        await client.PostAsJsonAsync($"/api/v1/ai/knowledge/documents/{newDocId}/archive", new { Reason = "Test archive" });

        // Verify audit logs exist
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();

        var logs = await db.AuditLogs
            .Where(l => l.EntityName == nameof(AgricultureDocument))
            .OrderBy(l => l.CreatedAtUtc)
            .ToListAsync();

        var approveLog = Assert.Single(logs, l => l.Action == "APPROVE_DOCUMENT" && l.EntityId == originalDocId.ToString());
        Assert.NotNull(approveLog.ActorUserId);
        Assert.NotEqual(Guid.Empty, approveLog.ActorUserId.Value);

        Assert.Contains(logs, l => l.Action == "CREATE_DOCUMENT_VERSION" && l.EntityId == newDocId.ToString());
        Assert.Contains(logs, l => l.Action == "ARCHIVE_DOCUMENT" && l.EntityId == newDocId.ToString());
    }

    [Fact]
    public async Task Document_with_future_or_expired_dates_is_strictly_excluded_from_rag()
    {
        using var factory = new TestApplicationFactory();
        await factory.SeedAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, "admin@example.com");

        var now = DateTime.UtcNow;

        // 1. Future effective date document
        var formFuture = new MultipartFormDataContent();
        var fileFuture = new ByteArrayContent(Encoding.UTF8.GetBytes(OriginalDocText));
        fileFuture.Headers.ContentType = new MediaTypeHeaderValue("text/plain");
        formFuture.Add(fileFuture, "File", "future_doc.txt");
        formFuture.Add(new StringContent("TCVN-FUTURE"), "StandardCode");
        var resFuture = await client.PostAsync("/api/v1/ai/knowledge/documents", formFuture);
        Assert.Equal(HttpStatusCode.Created, resFuture.StatusCode);
        var futureDocId = JsonDocument.Parse(await resFuture.Content.ReadAsStringAsync()).RootElement.GetProperty("id").GetGuid();

        await client.PostAsJsonAsync($"/api/v1/ai/knowledge/documents/{futureDocId}/review", new
        {
            ContentText = OriginalDocText,
            Approve = true,
            Title = "Quy chuẩn tương lai chưa hiệu lực",
            CropScope = "Cà chua",
            StandardCode = "TCVN-FUTURE",
            Version = "V1.0",
            DocumentType = "OfficialStandard",
            EffectiveDate = now.AddDays(10), // Future effective date!
            ExpirationDate = now.AddYears(2),
            ReviewNotes = "Quy chuẩn áp dụng từ tháng sau."
        });

        // 2. Expired document
        var formExpired = new MultipartFormDataContent();
        var expiredText = OriginalDocText + "\n[Quy chuẩn lưu trữ năm 2010 đã hết hạn]";
        var fileExpired = new ByteArrayContent(Encoding.UTF8.GetBytes(expiredText));
        fileExpired.Headers.ContentType = new MediaTypeHeaderValue("text/plain");
        formExpired.Add(fileExpired, "File", "expired_doc.txt");
        formExpired.Add(new StringContent("TCVN-EXPIRED"), "StandardCode");
        var resExpired = await client.PostAsync("/api/v1/ai/knowledge/documents", formExpired);
        Assert.Equal(HttpStatusCode.Created, resExpired.StatusCode);
        var expiredDocId = JsonDocument.Parse(await resExpired.Content.ReadAsStringAsync()).RootElement.GetProperty("id").GetGuid();

        await client.PostAsJsonAsync($"/api/v1/ai/knowledge/documents/{expiredDocId}/review", new
        {
            ContentText = expiredText,
            Approve = true,
            Title = "Quy chuẩn cũ đã hết hiệu lực",
            CropScope = "Cà chua",
            StandardCode = "TCVN-EXPIRED",
            Version = "V1.0",
            DocumentType = "OfficialStandard",
            EffectiveDate = now.AddYears(-2),
            ExpirationDate = now.AddDays(-1), // Already expired!
            ReviewNotes = "Quy chuẩn đã hết hạn."
        });

        // Verify RAG retriever does NOT return either future or expired document
        using var scope = factory.Services.CreateScope();
        var docService = scope.ServiceProvider.GetRequiredService<IAgricultureDocumentService>();

        var passages = await docService.SearchAsync("cách ly", "Cà chua", null, 10, CancellationToken.None);
        Assert.DoesNotContain(passages, p => p.DocumentId == futureDocId);
        Assert.DoesNotContain(passages, p => p.DocumentId == expiredDocId);
    }

    [Fact]
    public async Task Non_admin_cannot_update_preview_or_archive_documents()
    {
        using var factory = new TestApplicationFactory();
        await factory.SeedAsync();
        using var client = factory.CreateClient();

        // Login as farm owner (not PlatformAdmin)
        await LoginAsync(client, "owner-a@example.com");

        var docId = Guid.NewGuid();

        var putRes = await client.PutAsync($"/api/v1/ai/knowledge/documents/{docId}", new MultipartFormDataContent());
        Assert.Equal(HttpStatusCode.Forbidden, putRes.StatusCode);

        var archiveRes = await client.PostAsJsonAsync($"/api/v1/ai/knowledge/documents/{docId}/archive", new { Reason = "none" });
        Assert.Equal(HttpStatusCode.Forbidden, archiveRes.StatusCode);

        var previewRes = await client.PostAsync("/api/v1/ai/knowledge/documents/preview", new MultipartFormDataContent());
        Assert.Equal(HttpStatusCode.Forbidden, previewRes.StatusCode);
    }
}

