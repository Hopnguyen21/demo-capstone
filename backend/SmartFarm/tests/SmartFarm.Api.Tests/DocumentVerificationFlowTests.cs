using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Domain.Entities;
using SmartFarm.Infrastructure.Ai.Knowledge;
using SmartFarm.Infrastructure.Persistence;
using Xunit;

namespace SmartFarm.Api.Tests;

/// <summary>
/// AI kiểm tra tài liệu có thuộc lĩnh vực nông nghiệp: kết quả/lỗi AI không bao giờ tự duyệt tài liệu,
/// mở nó vào RAG hay tạo embedding.
/// </summary>
public sealed class DocumentVerificationFlowTests
{
    private const string TomatoDoc = """
        QUY TRÌNH KỸ THUẬT TRỒNG CÀ CHUA NHÀ MÀNG
        Cây trồng áp dụng: Cà chua
        Thời gian cách ly thuốc bảo vệ thực vật trước thu hoạch tối thiểu 3 ngày. Tưới nhỏ giọt mỗi sáng và thu hoạch quả vào sáng sớm.
        Ghi chép nhật ký sản xuất cho từng lô để truy xuất nguồn gốc sản phẩm trong suốt vụ trồng.
        """;

    private sealed record LoginPayload(string AccessToken);

    private static async Task LoginAsync(HttpClient client, string email)
    {
        var response = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = "ValidPassword1!" });
        response.EnsureSuccessStatusCode();
        var payload = await response.Content.ReadFromJsonAsync<LoginPayload>();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", payload!.AccessToken);
    }

    private static async Task<JsonElement> UploadAsync(HttpClient client, string text)
    {
        var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(Encoding.UTF8.GetBytes(text));
        file.Headers.ContentType = new MediaTypeHeaderValue("text/plain");
        form.Add(file, "File", "tai_lieu.txt");
        var response = await client.PostAsync("/api/v1/ai/knowledge/documents", form);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement.Clone();
    }

    [Fact]
    public async Task Upload_is_pending_review_and_queued_for_the_ai_topic_check_without_claiming_verification()
    {
        using var factory = new TestApplicationFactory();
        await factory.SeedAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, "admin@example.com");

        var body = await UploadAsync(client, TomatoDoc);

        Assert.Equal("PendingReview", body.GetProperty("reviewStatus").GetString());
        Assert.Equal("Pending", body.GetProperty("verificationStatus").GetString());
        var message = body.GetProperty("message").GetString();
        Assert.Contains("AI đang kiểm tra", message);
        Assert.DoesNotContain("AI đã xác nhận", message);
    }

    [Fact]
    public async Task Ai_error_is_recorded_and_never_opens_the_document_to_rag_or_embeddings()
    {
        using var factory = new TestApplicationFactory(); // môi trường test không cấu hình Gemini
        await factory.SeedAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, "admin@example.com");
        var id = (await UploadAsync(client, TomatoDoc)).GetProperty("id").GetGuid();

        using var scope = factory.Services.CreateScope();
        var documents = scope.ServiceProvider.GetRequiredService<AgricultureDocumentService>();
        var retriever = scope.ServiceProvider.GetRequiredService<IAgricultureKnowledgeRetriever>();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();

        await documents.ProcessPendingVerificationAsync(default);
        var after = await db.AgricultureDocuments.AsNoTracking().SingleAsync(d => d.Id == id);
        Assert.Equal("VerificationError", after.VerificationStatus);
        Assert.NotNull(after.OriginalFileBytes); // không mất file gốc
        Assert.Equal(AgricultureDocumentReviewStatus.PendingReview, after.ReviewStatus);

        // Chưa duyệt: không embedding, không truy xuất.
        Assert.Equal(0, await documents.ProcessPendingEmbeddingsAsync(default));
        Assert.True(await db.AgricultureKnowledgeChunks.AsNoTracking().Where(c => c.DocumentId == id).AllAsync(c => c.Status == KnowledgeChunkStatus.Pending));
        var passages = await retriever.RetrievePassagesAsync("Thu hoạch cà chua khi nào?", "Cà chua", null, null, 5, false, default);
        Assert.DoesNotContain(passages, p => p.DocumentId == id);
    }

    [Fact]
    public async Task Failed_embeddings_of_approved_documents_are_requeued_after_a_pause_but_not_immediately()
    {
        using var factory = new TestApplicationFactory();
        using var scope = factory.Services.CreateScope();
        var documents = scope.ServiceProvider.GetRequiredService<AgricultureDocumentService>();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        var doc = new AgricultureDocument { Title = "Tài liệu đã duyệt", ContentText = "x", ReviewStatus = AgricultureDocumentReviewStatus.Approved, IsPublic = true };
        db.AgricultureDocuments.Add(doc);
        AgricultureKnowledgeChunk Chunk(int index, DateTime updated) => new() { DocumentId = doc.Id, ChunkIndex = index, Content = "nội dung", Status = KnowledgeChunkStatus.Failed, UpdatedAtUtc = updated };
        var old = Chunk(0, DateTime.UtcNow.AddMinutes(-AgricultureDocumentService.FailedEmbeddingRetryMinutes - 5));
        var recent = Chunk(1, DateTime.UtcNow.AddMinutes(-1));
        db.AgricultureKnowledgeChunks.AddRange(old, recent);
        await db.SaveChangesAsync();

        await documents.ProcessPendingEmbeddingsAsync(default);

        var statuses = await db.AgricultureKnowledgeChunks.AsNoTracking().Where(c => c.DocumentId == doc.Id).ToDictionaryAsync(c => c.ChunkIndex, c => c.Status);
        Assert.Equal(KnowledgeChunkStatus.Pending, statuses[0]);
        Assert.Equal(KnowledgeChunkStatus.Failed, statuses[1]);
    }

    [Fact]
    public async Task Approving_a_document_the_ai_flags_as_not_agricultural_needs_a_reviewer_note()
    {
        using var factory = new TestApplicationFactory();
        await factory.SeedAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, "admin@example.com");
        var id = (await UploadAsync(client, TomatoDoc)).GetProperty("id").GetGuid();
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            (await db.AgricultureDocuments.SingleAsync(d => d.Id == id)).VerificationStatus = "NotAgricultural";
            await db.SaveChangesAsync();
        }

        var withoutNote = await client.PostAsJsonAsync($"/api/v1/ai/knowledge/documents/{id}/review",
            new { contentText = TomatoDoc, approve = true, documentType = "TechnicalGuide" });
        Assert.Equal(HttpStatusCode.BadRequest, withoutNote.StatusCode);

        var withNote = await client.PostAsJsonAsync($"/api/v1/ai/knowledge/documents/{id}/review",
            new { contentText = TomatoDoc, approve = true, documentType = "TechnicalGuide", reviewNotes = "Đã xem file gốc: đây là quy trình trồng cà chua, AI nhận định nhầm." });
        Assert.Equal(HttpStatusCode.OK, withNote.StatusCode);

        using var scope2 = factory.Services.CreateScope();
        var retriever = scope2.ServiceProvider.GetRequiredService<IAgricultureKnowledgeRetriever>();
        var passages = await retriever.RetrievePassagesAsync("Thời gian cách ly thuốc bảo vệ thực vật là bao lâu?", "Cà chua", null, null, 5, false, default);
        Assert.Contains(passages, p => p.DocumentId == id);
    }

    [Theory]
    [InlineData("Agricultural")]
    [InlineData("Uncertain")]
    [InlineData("VerificationError")]
    [InlineData("Pending")]
    public async Task Only_a_not_agricultural_result_adds_a_note_requirement_and_no_result_approves_automatically(string status)
    {
        using var factory = new TestApplicationFactory();
        await factory.SeedAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, "admin@example.com");
        var id = (await UploadAsync(client, TomatoDoc)).GetProperty("id").GetGuid();
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        (await db.AgricultureDocuments.SingleAsync(d => d.Id == id)).VerificationStatus = status;
        await db.SaveChangesAsync();

        // Dù kết quả AI thế nào, tài liệu vẫn chờ người duyệt.
        var doc = await db.AgricultureDocuments.AsNoTracking().SingleAsync(d => d.Id == id);
        Assert.Equal(AgricultureDocumentReviewStatus.PendingReview, doc.ReviewStatus);
    }

    [Fact]
    public async Task Rerun_endpoint_queues_the_check_without_changing_review_status()
    {
        using var factory = new TestApplicationFactory();
        await factory.SeedAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, "admin@example.com");
        var id = (await UploadAsync(client, TomatoDoc)).GetProperty("id").GetGuid();
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            (await db.AgricultureDocuments.SingleAsync(d => d.Id == id)).VerificationStatus = "VerificationError";
            await db.SaveChangesAsync();
        }

        var rerun = await client.PostAsync($"/api/v1/ai/knowledge/documents/{id}/verify", null);

        Assert.Equal(HttpStatusCode.Accepted, rerun.StatusCode);
        using var scope2 = factory.Services.CreateScope();
        var doc = await scope2.ServiceProvider.GetRequiredService<SmartFarmDbContext>().AgricultureDocuments.AsNoTracking().SingleAsync(d => d.Id == id);
        Assert.Equal("Pending", doc.VerificationStatus);
        Assert.Equal(AgricultureDocumentReviewStatus.PendingReview, doc.ReviewStatus);
    }

    [Fact]
    public async Task Farm_owner_cannot_request_verification_and_reference_endpoints_no_longer_exist()
    {
        using var factory = new TestApplicationFactory();
        await factory.SeedAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, "owner-a@example.com");

        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsync($"/api/v1/ai/knowledge/documents/{Guid.NewGuid()}/verify", null)).StatusCode);

        await LoginAsync(client, "admin@example.com");
        Assert.True((await client.GetAsync("/api/v1/ai/knowledge/reference-sources")).StatusCode is HttpStatusCode.NotFound or HttpStatusCode.MethodNotAllowed);
    }
}
