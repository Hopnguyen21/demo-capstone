using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace SmartFarm.Api.Tests;

public sealed class GisGeocodingProxyTests
{
    [Fact]
    public async Task ReverseGeocode_Requires_Authentication()
    {
        using var factory = new TestApplicationFactory();
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/v1/gis/reverse-geocode", new
        {
            latitude = 11.9404m,
            longitude = 108.4583m
        });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task SearchLocation_Requires_Authentication()
    {
        using var factory = new TestApplicationFactory();
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/v1/gis/search-location", new
        {
            query = "Đà Lạt"
        });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task ReverseGeocode_Invalid_Coordinates_Returns_BadRequest()
    {
        using var factory = new TestApplicationFactory();
        await factory.SeedAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, "owner-a@example.com");

        // Tọa độ 0, 0 không hợp lệ
        var responseZero = await client.PostAsJsonAsync("/api/v1/gis/reverse-geocode", new
        {
            latitude = 0m,
            longitude = 0m
        });
        Assert.Equal(HttpStatusCode.BadRequest, responseZero.StatusCode);

        // Tọa độ ngoài phạm vi [-90, 90]
        var responseOutRange = await client.PostAsJsonAsync("/api/v1/gis/reverse-geocode", new
        {
            latitude = 95m,
            longitude = 108m
        });
        Assert.Equal(HttpStatusCode.BadRequest, responseOutRange.StatusCode);
    }

    [Fact]
    public async Task SearchLocation_ShortQuery_Returns_EmptyList()
    {
        using var factory = new TestApplicationFactory();
        await factory.SeedAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, "owner-a@example.com");

        var response = await client.PostAsJsonAsync("/api/v1/gis/search-location", new
        {
            query = "a"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var content = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(content);
        Assert.Equal(JsonValueKind.Array, doc.RootElement.ValueKind);
        Assert.Equal(0, doc.RootElement.GetArrayLength());
    }

    [Fact]
    public async Task ReverseGeocode_Get_Method_Returns_MethodNotAllowed()
    {
        using var factory = new TestApplicationFactory();
        await factory.SeedAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, "owner-a@example.com");

        // Gọi GET tới endpoint POST phải trả về 405 Method Not Allowed (để tránh rò rỉ tọa độ trong query string/access log)
        var response = await client.GetAsync("/api/v1/gis/reverse-geocode?latitude=11.9404&longitude=108.4583");
        Assert.Equal(HttpStatusCode.MethodNotAllowed, response.StatusCode);
    }

    private static async Task LoginAsync(HttpClient client, string email)
    {
        var response = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = "ValidPassword1!" });
        response.EnsureSuccessStatusCode();
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", json.RootElement.GetProperty("accessToken").GetString());
    }
}

