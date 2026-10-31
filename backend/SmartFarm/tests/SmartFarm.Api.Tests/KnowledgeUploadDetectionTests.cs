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

/// <summary>Tải tài liệu chỉ cần file: metadata nhận diện từ nội dung kèm bằng chứng, chờ duyệt, chỉ vào RAG sau khi duyệt.</summary>
public sealed class KnowledgeUploadDetectionTests
{
    private const string CropSpecific = """
        QUY TRÌNH KỸ THUẬT TRỒNG CÀ CHUA NHÀ MÀNG
        Đơn vị ban hành: Trung tâm Khuyến nông Hà Tĩnh
        Cây trồng áp dụng: Cà chua
        Tưới nhỏ giọt: tưới đều đặn mỗi sáng, kiểm tra nguồn nước tưới trước khi tưới, giữ độ ẩm đất ổn định trong suốt vụ trồng.
        Thu hoạch quả khi chín 70-80% màu sắc đặc trưng, thu hoạch vào sáng sớm, dụng cụ thu hoạch phải sạch.
        """;

    private const string NoScopeEvidence = """
        Hướng dẫn vệ sinh khu sản xuất
        Vệ sinh dụng cụ sau mỗi lần sử dụng, rửa tay trước khi thu hoạch, ghi chép nhật ký vệ sinh hằng tuần để truy xuất.
        Rác thải được thu gom vào thùng có nắp và xử lý theo quy định của cơ sở sản xuất để tránh lây nhiễm.
        """;

    private sealed record LoginPayload(string AccessToken);

    private static async Task LoginAdminAsync(HttpClient client)
    {
        var response = await client.PostAsJsonAsync("/api/v1/auth/login", new { email = "admin@example.com", password = "ValidPassword1!" });
        response.EnsureSuccessStatusCode();
        var payload = await response.Content.ReadFromJsonAsync<LoginPayload>();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", payload!.AccessToken);
    }

    private static MultipartFormDataContent FileOnly(string text, string fileName = "tai_lieu.txt")
    {
        var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(Encoding.UTF8.GetBytes(text));
        file.Headers.ContentType = new MediaTypeHeaderValue("text/plain");
        form.Add(file, "File", fileName);
        return form;
    }

    private static async Task<JsonElement> UploadAsync(HttpClient client, string text)
    {
        var response = await client.PostAsync("/api/v1/ai/knowledge/documents", FileOnly(text));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement.Clone();
    }

    private static async Task<IReadOnlyList<KnowledgePassageView>> RetrieveAsync(TestApplicationFactory factory, string question, string? crop)
    {
        using var scope = factory.Services.CreateScope();
        var retriever = scope.ServiceProvider.GetRequiredService<IAgricultureKnowledgeRetriever>();
        return await retriever.RetrievePassagesAsync(question, crop, null, null, 5, generalOnlyWhenCropUnknown: false, default);
    }

    [Fact]
    public async Task File_only_upload_saves_pending_review_with_detected_metadata_and_evidence()
    {
        using var factory = new TestApplicationFactory();
        await factory.SeedAsync();
        using var client = factory.CreateClient();
        await LoginAdminAsync(client);

        var body = await UploadAsync(client, CropSpecific);

        Assert.Equal("PendingReview", body.GetProperty("reviewStatus").GetString());
        Assert.Equal("Cà chua", body.GetProperty("cropScope").GetString());
        Assert.Equal("Trung tâm Khuyến nông Hà Tĩnh", body.GetProperty("authorOrganization").GetString());
        Assert.Equal("TechnicalGuide", body.GetProperty("documentType").GetString());
        var detection = body.GetProperty("metadataDetection");
        Assert.Equal("detected", detection.GetProperty("crops").GetProperty("status").GetString());
        Assert.Contains("Cây trồng áp dụng", detection.GetProperty("crops").GetProperty("evidence").GetProperty("quote").GetString());
        // Chủ đề nhận diện từ nội dung, không phụ thuộc người tải khai báo.
        var topics = detection.GetProperty("topics").EnumerateArray().Select(t => t.GetProperty("topic").GetString()).ToList();
        Assert.Contains("irrigation", topics);
        Assert.Contains("harvest", topics);
        // Thông báo không khẳng định AI đã thẩm định tài liệu đạt VietGAP.
        Assert.DoesNotContain("AI đã xác nhận", body.GetProperty("message").GetString());
    }

    [Fact]
    public async Task Pending_document_is_not_retrieved_until_approved()
    {
        using var factory = new TestApplicationFactory();
        await factory.SeedAsync();
        using var client = factory.CreateClient();
        await LoginAdminAsync(client);
        var id = (await UploadAsync(client, CropSpecific)).GetProperty("id").GetGuid();

        Assert.DoesNotContain(await RetrieveAsync(factory, "Khi nào thu hoạch cà chua?", "Cà chua"), p => p.DocumentId == id);

        var approve = await client.PostAsJsonAsync($"/api/v1/ai/knowledge/documents/{id}/review",
            new { contentText = CropSpecific, approve = true, reviewNotes = "Đã đối chiếu file gốc: đúng cây, đúng đơn vị ban hành." });
        Assert.Equal(HttpStatusCode.OK, approve.StatusCode);

        Assert.Contains(await RetrieveAsync(factory, "Khi nào thu hoạch cà chua?", "Cà chua"), p => p.DocumentId == id);
        Assert.DoesNotContain(await RetrieveAsync(factory, "Khi nào thu hoạch xà lách?", "Xà lách"), p => p.DocumentId == id);
    }

    [Fact]
    public async Task Undetermined_scope_and_type_must_be_decided_by_the_reviewer_before_approval()
    {
        using var factory = new TestApplicationFactory();
        await factory.SeedAsync();
        using var client = factory.CreateClient();
        await LoginAdminAsync(client);
        var body = await UploadAsync(client, NoScopeEvidence);
        var id = body.GetProperty("id").GetGuid();

        // Lưu được dù chưa xác định cây/loại; nhưng không được hiểu là "áp dụng chung".
        Assert.Equal("PendingReview", body.GetProperty("reviewStatus").GetString());
        Assert.Equal(string.Empty, body.GetProperty("cropScope").GetString());
        Assert.Equal("not_found", body.GetProperty("metadataDetection").GetProperty("generalScope").GetProperty("status").GetString());
        Assert.Contains("cây áp dụng", body.GetProperty("needsDecision").EnumerateArray().Select(x => x.GetString()));

        var notes = "Đã đối chiếu file gốc, tài liệu về vệ sinh khu sản xuất.";
        var noType = await client.PostAsJsonAsync($"/api/v1/ai/knowledge/documents/{id}/review",
            new { contentText = NoScopeEvidence, approve = true, reviewNotes = notes });
        Assert.Equal(HttpStatusCode.BadRequest, noType.StatusCode);

        var noScope = await client.PostAsJsonAsync($"/api/v1/ai/knowledge/documents/{id}/review",
            new { contentText = NoScopeEvidence, approve = true, reviewNotes = notes, documentType = "TechnicalGuide" });
        Assert.Equal(HttpStatusCode.BadRequest, noScope.StatusCode);

        var ok = await client.PostAsJsonAsync($"/api/v1/ai/knowledge/documents/{id}/review",
            new { contentText = NoScopeEvidence, approve = true, reviewNotes = notes, documentType = "TechnicalGuide", confirmGeneralScope = true });
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);

        // Áp dụng chung đã được người duyệt xác nhận: truy xuất được cho mọi cây.
        Assert.Contains(await RetrieveAsync(factory, "Vệ sinh dụng cụ sau khi sử dụng như thế nào?", "Xà lách"), p => p.DocumentId == id);
    }

    [Fact]
    public async Task Reviewer_can_set_crop_scope_when_detection_was_uncertain()
    {
        using var factory = new TestApplicationFactory();
        await factory.SeedAsync();
        using var client = factory.CreateClient();
        await LoginAdminAsync(client);
        var id = (await UploadAsync(client, NoScopeEvidence)).GetProperty("id").GetGuid();

        var ok = await client.PostAsJsonAsync($"/api/v1/ai/knowledge/documents/{id}/review",
            new { contentText = NoScopeEvidence, approve = true, reviewNotes = "Đối chiếu file gốc: áp dụng cho dưa leo.", documentType = "TechnicalGuide", cropScope = "dưa leo" });
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);

        Assert.Contains(await RetrieveAsync(factory, "Vệ sinh dụng cụ như thế nào?", "Dưa leo"), p => p.DocumentId == id);
        Assert.DoesNotContain(await RetrieveAsync(factory, "Vệ sinh dụng cụ như thế nào?", "Xà lách"), p => p.DocumentId == id);
    }

    [Fact]
    public async Task Empty_wrong_format_and_unreadable_files_are_rejected_and_not_saved()
    {
        using var factory = new TestApplicationFactory();
        await factory.SeedAsync();
        using var client = factory.CreateClient();
        await LoginAdminAsync(client);

        var empty = new MultipartFormDataContent { { new ByteArrayContent([]), "File", "rong.txt" } };
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsync("/api/v1/ai/knowledge/documents", empty)).StatusCode);

        var wrongExt = new MultipartFormDataContent { { new ByteArrayContent(Encoding.UTF8.GetBytes(CropSpecific)), "File", "anh.png" } };
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsync("/api/v1/ai/knowledge/documents", wrongExt)).StatusCode);

        var fakePdf = new MultipartFormDataContent { { new ByteArrayContent(Encoding.UTF8.GetBytes("không phải pdf thật")), "File", "gia.pdf" } };
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsync("/api/v1/ai/knowledge/documents", fakePdf)).StatusCode);

        // PDF có chữ ký hợp lệ nhưng không đọc được lớp văn bản và OCR không chạy được (không cấu hình Gemini ở môi trường test):
        // phải báo lỗi rõ, không lưu tài liệu thiếu nội dung như thể đã đọc thành công.
        var scan = new MultipartFormDataContent { { new ByteArrayContent(Encoding.ASCII.GetBytes("%PDF-1.4\n%scan khong co lop van ban\n")), "File", "scan.pdf" } };
        var scanResponse = await client.PostAsync("/api/v1/ai/knowledge/documents", scan);
        Assert.Equal(HttpStatusCode.BadRequest, scanResponse.StatusCode);
        Assert.Contains("OCR", await scanResponse.Content.ReadAsStringAsync());

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        Assert.Equal(0, await db.AgricultureDocuments.CountAsync(d => d.FileName == "rong.txt" || d.FileName == "anh.png" || d.FileName == "gia.pdf" || d.FileName == "scan.pdf"));
    }

    [Fact]
    public async Task Text_endpoint_does_not_require_title_or_metadata_and_reports_honest_status()
    {
        using var factory = new TestApplicationFactory();
        await factory.SeedAsync();
        using var client = factory.CreateClient();
        await LoginAdminAsync(client);

        var response = await client.PostAsJsonAsync("/api/v1/ai/knowledge/documents/text", new { content = CropSpecific });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
        Assert.Equal("QUY TRÌNH KỸ THUẬT TRỒNG CÀ CHUA NHÀ MÀNG", body.GetProperty("title").GetString());
        Assert.Equal("Cà chua", body.GetProperty("cropScope").GetString());
        Assert.Equal("PendingReview", body.GetProperty("reviewStatus").GetString());
        Assert.DoesNotContain("AI đã xác nhận", body.GetProperty("message").GetString());
    }

    [Fact]
    public async Task Declared_metadata_is_optional_and_overrides_detection_when_given()
    {
        using var factory = new TestApplicationFactory();
        await factory.SeedAsync();
        using var client = factory.CreateClient();
        await LoginAdminAsync(client);
        var form = FileOnly(CropSpecific);
        form.Add(new StringContent("dưa leo"), "CropScope");
        form.Add(new StringContent("Thematic"), "DocumentType");

        var response = await client.PostAsync("/api/v1/ai/knowledge/documents", form);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
        Assert.Equal("Dưa leo", body.GetProperty("cropScope").GetString());
        Assert.Equal("Thematic", body.GetProperty("documentType").GetString());
    }
}
