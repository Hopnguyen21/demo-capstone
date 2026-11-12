using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;
using Xunit;

namespace SmartFarm.Api.Tests;

/// <summary>Owner xem thông tin Zone + nội dung yêu cầu rồi xác nhận gửi: POST /zones/{id}/deployment-requests/submit (trạng thái Submitted ngay, kèm dự toán).</summary>
public sealed class SubmitDeploymentRequestTests
{
    private static readonly Guid Crop = Guid.Parse("10000000-0000-0000-0000-000000000001");
    private static readonly Guid Variety = Guid.Parse("10000000-0000-0000-0000-000000000002");
    private static readonly Guid Profile = Guid.Parse("10000000-0000-0000-0000-000000000003");

    private static async Task Login(HttpClient client, string email)
    {
        client.DefaultRequestHeaders.Authorization = null;
        var response = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = "ValidPassword1!" });
        response.EnsureSuccessStatusCode();
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", json.RootElement.GetProperty("accessToken").GetString());
    }

    private static async Task CreateSeason(HttpClient client, Guid zoneId)
    {
        var response = await client.PostAsJsonAsync($"/api/v1/zones/{zoneId}/planting-seasons", new { cropId = Crop, varietyId = Variety, growthProfileId = Profile, name = $"Submit-{Guid.NewGuid():N}", startDate = "2026-09-24", expectedEndDate = "2026-12-01" });
        response.EnsureSuccessStatusCode();
    }

    private static async Task<Guid> AddCatalogGateway(TestApplicationFactory factory, string role = "Gateway", decimal price = 3_800_000m)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        var item = new PlatformHardwareItem { Code = "GW-" + Guid.NewGuid().ToString("N")[..6], Name = "Gateway LoRa", Category = "GATEWAY", Model = "LG308N", UnitPrice = price, Status = "InStock", EstimateRole = role, EstimateUnits = 1 };
        db.PlatformHardwareItems.Add(item);
        await db.SaveChangesAsync();
        return item.Id;
    }

    [Fact]
    public async Task OwnerConfirmsSend_CreatesSubmittedRequest_WithServerDerivedParameters_AndCatalogPricedEstimate()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync(); using var client = factory.CreateClient();
        await Login(client, "owner-a@example.com"); await CreateSeason(client, seed.ZoneAId);
        var gw = await AddCatalogGateway(factory);

        var response = await client.PostAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}/deployment-requests/submit", new
        {
            ownerNotes = "Gần cổng chính",
            estimateItems = new object[]
            {
                new { hardwareItemId = gw, role = "Gateway", quantity = 1, unitPrice = 1, notes = "Cần 1, đã gắn 0" }, // giá client bị bỏ qua
                new { role = "Installation", quantity = 1, unitPrice = 500000 },
            },
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var root = json.RootElement;
        Assert.Equal("Submitted", root.GetProperty("status").GetString());
        Assert.True(root.GetProperty("requiredParameters").GetArrayLength() > 0); // lấy từ vụ trồng, không phải từ client
        Assert.Equal("Gần cổng chính", root.GetProperty("ownerNotes").GetString());
        var items = root.GetProperty("estimateItems");
        Assert.Equal(2, items.GetArrayLength());
        Assert.Equal(3_800_000m, items[0].GetProperty("unitPrice").GetDecimal());
        Assert.Equal(500_000m, items[1].GetProperty("lineTotal").GetDecimal());
        Assert.Equal(JsonValueKind.Object, root.GetProperty("context").ValueKind);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        var request = await db.DeploymentRequests.AsNoTracking().SingleAsync(x => x.ZoneId == seed.ZoneAId);
        Assert.Equal(DeploymentRequestStatus.Submitted, request.Status);
        Assert.NotNull(request.SubmittedAtUtc);
    }

    [Fact]
    public async Task SendingTwice_IsRejected_SoDoubleTapNeverCreatesDuplicates()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync(); using var client = factory.CreateClient();
        await Login(client, "owner-a@example.com"); await CreateSeason(client, seed.ZoneAId);
        var first = await client.PostAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}/deployment-requests/submit", new { ownerNotes = "lần 1" });
        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        var second = await client.PostAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}/deployment-requests/submit", new { ownerNotes = "lần 2" });
        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
        using var scope = factory.Services.CreateScope();
        Assert.Equal(1, await scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>().DeploymentRequests.CountAsync(x => x.ZoneId == seed.ZoneAId));
    }

    [Fact]
    public async Task InvalidEstimate_IsRejected_AndNoRequestIsCreated()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync(); using var client = factory.CreateClient();
        await Login(client, "owner-a@example.com"); await CreateSeason(client, seed.ZoneAId);
        var gw = await AddCatalogGateway(factory);
        var wrongRole = await client.PostAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}/deployment-requests/submit", new { estimateItems = new[] { new { hardwareItemId = gw, role = "SensorNode", quantity = 1 } } });
        Assert.Equal(HttpStatusCode.BadRequest, wrongRole.StatusCode);
        var unpriced = await AddCatalogGateway(factory, price: 0);
        var noPrice = await client.PostAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}/deployment-requests/submit", new { estimateItems = new[] { new { hardwareItemId = unpriced, role = "Gateway", quantity = 1 } } });
        Assert.Equal(HttpStatusCode.BadRequest, noPrice.StatusCode);
        using var scope = factory.Services.CreateScope();
        Assert.Equal(0, await scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>().DeploymentRequests.CountAsync(x => x.ZoneId == seed.ZoneAId));
    }

    [Fact]
    public async Task OnlyOwnerOfTheZoneTenant_CanSend_AndZoneNeedsAnActiveSeason()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync(); using var client = factory.CreateClient();
        await Login(client, "owner-a@example.com");
        // Zone chưa có vụ đang canh tác: không có thông số để khảo sát
        Assert.Equal(HttpStatusCode.NotFound, (await client.PostAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}/deployment-requests/submit", new { })).StatusCode);
        // Zone của tenant khác
        Assert.Equal(HttpStatusCode.NotFound, (await client.PostAsJsonAsync($"/api/v1/zones/{seed.ZoneBId}/deployment-requests/submit", new { })).StatusCode);
        // kỹ thuật viên không được gửi thay Owner
        await Login(client, "technician@example.com");
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync($"/api/v1/zones/{seed.ZoneAId}/deployment-requests/submit", new { })).StatusCode);
    }
}
