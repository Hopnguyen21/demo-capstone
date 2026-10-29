using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using Xunit;

namespace SmartFarm.Api.Tests;

/// <summary>
/// Chỉ PlatformAdmin được thêm, sửa, rà soát/duyệt, xóa tài liệu VietGAP và dùng AI soạn profile từ tài liệu.
/// FarmOwner chỉ được xem tài liệu đã có.
/// </summary>
public sealed class AgricultureKnowledgeAuthorizationTests
{
    private const string SampleText =
        "QUY CHUẨN KỸ THUẬT CANH TÁC CÀ CHUA THEO VIETGAP. Giai đoạn 1: Cây con (Ngày 1 - Ngày 15). Nhiệt độ: 20°C - 26°C.";

    [Fact]
    public async Task Farm_owner_cannot_upload_vietgap_document()
    {
        using var factory = new TestApplicationFactory();
        await factory.SeedAsync();
        using var client = factory.CreateClient();
        await AuthorizeAsync(client, "owner-a@example.com");

        var response = await client.PostAsync("/api/v1/ai/knowledge/documents", BuildUploadForm());

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Farm_owner_cannot_use_legacy_upload_route()
    {
        using var factory = new TestApplicationFactory();
        await factory.SeedAsync();
        using var client = factory.CreateClient();
        await AuthorizeAsync(client, "owner-a@example.com");

        var response = await client.PostAsync("/api/v1/ai/knowledge-base", BuildUploadForm());

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Farm_owner_cannot_save_text_document_review_or_draft_profile()
    {
        using var factory = new TestApplicationFactory();
        await factory.SeedAsync();
        using var client = factory.CreateClient();
        await AuthorizeAsync(client, "owner-a@example.com");
        var anyId = Guid.NewGuid();

        var saveText = await client.PostAsJsonAsync("/api/v1/ai/knowledge/documents/text",
            new { title = "VietGAP cà chua", content = SampleText });
        var review = await client.PostAsJsonAsync($"/api/v1/ai/knowledge/documents/{anyId}/review",
            new { contentText = SampleText, approve = true });
        var draft = await client.PostAsJsonAsync("/api/v1/ai/knowledge/draft",
            new { cropName = "Cà chua" });
        var draftProfile = await client.PostAsJsonAsync("/api/v1/ai/knowledge/draft-growth-profile",
            new { cropName = "Cà chua", documentId = anyId, stageCount = 4 });
        var delete = await client.DeleteAsync($"/api/v1/ai/knowledge/documents/{anyId}");

        Assert.Equal(HttpStatusCode.Forbidden, saveText.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, review.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, draft.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, draftProfile.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, delete.StatusCode);
    }

    [Theory]
    [InlineData("owner-a@example.com")]
    [InlineData("farmer-b@example.com")]
    public async Task Farm_users_cannot_read_the_knowledge_library(string email)
    {
        using var factory = new TestApplicationFactory();
        await factory.SeedAsync();
        using var client = factory.CreateClient();
        await AuthorizeAsync(client, email);
        var anyId = Guid.NewGuid();

        // Chỉ PlatformAdmin xem tài liệu; người dùng trang trại chỉ nhận đoạn trích kèm câu trả lời AI.
        foreach (var url in new[]
                 {
                     "/api/v1/ai/knowledge/documents", "/api/v1/ai/knowledge-base",
                     $"/api/v1/ai/knowledge/documents/{anyId}", $"/api/v1/ai/knowledge/documents/{anyId}/file",
                     "/api/v1/ai/knowledge/search?query=c%C3%A0%20chua"
                 })
        {
            var response = await client.GetAsync(url);
            Assert.True(response.StatusCode == HttpStatusCode.Forbidden, $"{url} returned {(int)response.StatusCode}");
        }
    }

    [Fact]
    public async Task Upload_is_saved_pending_human_review_with_declared_topics()
    {
        using var factory = new TestApplicationFactory();
        await factory.SeedAsync();
        using var client = factory.CreateClient();
        await AuthorizeAsync(client, "admin@example.com");

        var form = BuildUploadForm();
        form.Add(new StringContent("pest"), "Topics");
        form.Add(new StringContent("harvest"), "Topics");
        var response = await client.PostAsync("/api/v1/ai/knowledge/documents", form);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<CreatedPayload>();
        var detail = await client.GetFromJsonAsync<DetailPayload>($"/api/v1/ai/knowledge/documents/{created!.Id}");
        // Mỗi tài liệu là một nguồn riêng, không chặn vì thiếu mục; chỉ vào RAG sau khi người duyệt xác nhận.
        Assert.Equal("PendingReview", detail?.ReviewStatus);
        Assert.Null(detail?.ReviewedAtUtc);
        Assert.Contains("pest", detail!.Topics);
        Assert.Contains("harvest", detail.Topics);
    }

    [Fact]
    public async Task Uploading_the_same_content_twice_is_rejected()
    {
        using var factory = new TestApplicationFactory();
        await factory.SeedAsync();
        using var client = factory.CreateClient();
        await AuthorizeAsync(client, "admin@example.com");

        var first = await client.PostAsync("/api/v1/ai/knowledge/documents", BuildUploadForm());
        var second = await client.PostAsync("/api/v1/ai/knowledge/documents", BuildUploadForm());

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
        // Trả kèm tài liệu đã có để giao diện mở thẳng tài liệu đó.
        var created = await first.Content.ReadFromJsonAsync<CreatedPayload>();
        var problem = await second.Content.ReadFromJsonAsync<DuplicatePayload>();
        Assert.Equal(created!.Id, problem!.ExistingDocumentId);
        var documents = await client.GetFromJsonAsync<List<DetailPayload>>("/api/v1/ai/knowledge/documents");
        Assert.Single(documents!);
    }

    [Fact]
    public async Task Near_duplicate_is_saved_with_a_warning_note()
    {
        using var factory = new TestApplicationFactory();
        await factory.SeedAsync();
        using var client = factory.CreateClient();
        await AuthorizeAsync(client, "admin@example.com");

        var longText = string.Join(' ', Enumerable.Repeat(SampleText, 3)) +
            " Phòng trừ sâu khoang bằng bẫy pheromone, ngắt ổ trứng khi mật độ sâu thấp, nhổ bỏ cây bị héo xanh đem tiêu hủy.";
        await UploadTextAsync(client, "Quy trình IPM cà chua", longText);
        // Phiên bản sửa một câu: không trùng hệt nên được lưu, nhưng ghi chú cho người duyệt.
        var v2 = await UploadTextAsync(client, "Quy trình IPM cà chua (bản cập nhật)", longText + " Cập nhật năm 2026.");

        var detail = await client.GetFromJsonAsync<DetailPayload>($"/api/v1/ai/knowledge/documents/{v2}");
        Assert.StartsWith("[Có thể trùng với tài liệu đã có] \"Quy trình IPM cà chua\"", detail!.ReviewNotes);
    }

    [Fact]
    public async Task Approving_a_new_version_supersedes_the_older_approved_one()
    {
        using var factory = new TestApplicationFactory();
        await factory.SeedAsync();
        using var client = factory.CreateClient();
        await AuthorizeAsync(client, "admin@example.com");

        var v1 = await UploadTextAsync(client, "Quy trình IPM cà chua", SampleText + " Phiên bản 1.");
        await ApproveAsync(client, v1, SampleText + " Phiên bản 1.");
        var v2 = await UploadTextAsync(client, "Quy trình IPM cà chua", SampleText + " Phiên bản 2 có cập nhật thời gian cách ly.");
        await ApproveAsync(client, v2, SampleText + " Phiên bản 2 có cập nhật thời gian cách ly.");

        var old = await client.GetFromJsonAsync<DetailPayload>($"/api/v1/ai/knowledge/documents/{v1}");
        var current = await client.GetFromJsonAsync<DetailPayload>($"/api/v1/ai/knowledge/documents/{v2}");
        Assert.Equal("Superseded", old?.ReviewStatus);
        Assert.Equal("Approved", current?.ReviewStatus);
    }

    [Fact]
    public async Task Crop_growth_profile_is_refused_without_approved_documents()
    {
        using var factory = new TestApplicationFactory();
        await factory.SeedAsync();
        using var client = factory.CreateClient();
        await AuthorizeAsync(client, "admin@example.com");

        // Tài liệu đã tải lên nhưng chưa duyệt không được dùng làm nguồn Growth Profile.
        await UploadTextAsync(client, "Hướng dẫn thu hoạch cà chua", SampleText);
        var response = await client.PostAsJsonAsync("/api/v1/ai/knowledge/draft-growth-profile", new { cropName = "cà chua" });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    private static async Task<Guid> UploadTextAsync(HttpClient client, string title, string content)
    {
        var response = await client.PostAsJsonAsync("/api/v1/ai/knowledge/documents/text",
            new { title, content, authorOrganization = "Trung tâm Khuyến nông Hà Tĩnh", category = "pest", cropScope = "cà chua", documentType = "Thematic" });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<CreatedPayload>())!.Id;
    }

    private static async Task ApproveAsync(HttpClient client, Guid id, string content)
    {
        var response = await client.PostAsJsonAsync($"/api/v1/ai/knowledge/documents/{id}/review",
            new { contentText = content, approve = true, reviewNotes = "Đã đối chiếu với bản gốc của trung tâm khuyến nông." });
        response.EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task Platform_admin_can_upload_file_only_and_metadata_is_read_from_content()
    {
        using var factory = new TestApplicationFactory();
        await factory.SeedAsync();
        using var client = factory.CreateClient();
        await AuthorizeAsync(client, "admin@example.com");

        var response = await client.PostAsync("/api/v1/ai/knowledge/documents", BuildUploadForm(includeMetadata: false));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<CreatedPayload>();
        var detail = await client.GetFromJsonAsync<MetadataPayload>($"/api/v1/ai/knowledge/documents/{created!.Id}");
        Assert.StartsWith("QUY CHUẨN KỸ THUẬT CANH TÁC CÀ CHUA", detail!.Title);
        Assert.Equal("cà chua", detail.CropScope);
        Assert.Equal("general", detail.Category);
        Assert.True(detail.IsPublic);
    }

    private static MultipartFormDataContent BuildUploadForm(bool includeMetadata = true)
    {
        var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(Encoding.UTF8.GetBytes(SampleText));
        file.Headers.ContentType = new MediaTypeHeaderValue("text/plain");
        form.Add(file, "File", "vietgap_ca_chua.txt");
        if (!includeMetadata) return form;
        form.Add(new StringContent("VietGAP cà chua nhà màng"), "Title");
        form.Add(new StringContent("general"), "Category");
        form.Add(new StringContent("cà chua"), "CropScope");
        return form;
    }

    private static async Task AuthorizeAsync(HttpClient client, string email)
    {
        var response = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = "ValidPassword1!" });
        response.EnsureSuccessStatusCode();
        var payload = await response.Content.ReadFromJsonAsync<LoginPayload>()
            ?? throw new InvalidOperationException("Login response was empty.");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", payload.AccessToken);
    }

    private sealed record LoginPayload(string AccessToken, string RefreshToken);
    private sealed record CreatedPayload(Guid Id);
    private sealed record DetailPayload(Guid Id, string ReviewStatus, DateTime? ReviewedAtUtc, string? ReviewNotes, string Topics = "");
    private sealed record InsufficientPayload(List<string> MissingRequirements);
    private sealed record DuplicatePayload(Guid ExistingDocumentId, string ExistingTitle);
    private sealed record MetadataPayload(Guid Id, string Title, string CropScope, string Category, bool IsPublic);
}
