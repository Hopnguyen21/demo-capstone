using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using SmartFarm.Application.Common.Interfaces;
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

    private sealed class FakeGeocoding(Func<Task<GeocodingAddressView?>> reverse) : IGeocodingService
    {
        public Task<GeocodingAddressView?> ReverseGeocodeAsync(decimal latitude, decimal longitude, CancellationToken ct) => reverse();
        public Task<IReadOnlyList<GeocodingAddressView>> SearchLocationAsync(string query, CancellationToken ct) =>
            Task.FromResult<IReadOnlyList<GeocodingAddressView>>([]);
    }

    private static async Task<HttpResponseMessage> ReverseWith(Func<Task<GeocodingAddressView?>> reverse)
    {
        using var factory = new TestApplicationFactory();
        await factory.SeedAsync();
        using var custom = factory.WithWebHostBuilder(b => b.ConfigureServices(services =>
        {
            services.RemoveAll<IGeocodingService>();
            services.AddSingleton<IGeocodingService>(new FakeGeocoding(reverse));
        }));
        using var client = custom.CreateClient();
        await LoginAsync(client, "owner-a@example.com");
        return await client.PostAsJsonAsync("/api/v1/gis/reverse-geocode", new { latitude = 11.9404m, longitude = 108.4583m });
    }

    [Fact]
    public async Task ReverseGeocode_Found_Returns_Camelcase_DisplayName()
    {
        var response = await ReverseWith(() => Task.FromResult<GeocodingAddressView?>(
            new GeocodingAddressView("Phường 1, Đà Lạt", null, null, "Đà Lạt", null, "Lâm Đồng", 11.9404m, 108.4583m)));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("Phường 1, Đà Lạt", doc.RootElement.GetProperty("displayName").GetString());
    }

    [Fact]
    public async Task ReverseGeocode_NoResult_Returns_NotFound_With_Code()
    {
        var response = await ReverseWith(() => Task.FromResult<GeocodingAddressView?>(null));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("GEOCODE_NOT_FOUND", doc.RootElement.GetProperty("code").GetString());
    }

    [Theory]
    [InlineData(GeocodingFailureKind.Unavailable, HttpStatusCode.BadGateway)]
    [InlineData(GeocodingFailureKind.ProviderError, HttpStatusCode.BadGateway)]
    [InlineData(GeocodingFailureKind.Timeout, HttpStatusCode.GatewayTimeout)]
    [InlineData(GeocodingFailureKind.RateLimited, HttpStatusCode.TooManyRequests)]
    public async Task ReverseGeocode_Provider_Failure_Is_Not_Reported_As_NotFound(GeocodingFailureKind kind, HttpStatusCode expected)
    {
        var response = await ReverseWith(() => throw new GeocodingProviderException(kind, "provider down"));

        Assert.Equal(expected, response.StatusCode);
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("provider down", doc.RootElement.GetProperty("message").GetString());
        Assert.StartsWith("GEOCODE_", doc.RootElement.GetProperty("code").GetString());
    }

    private static async Task LoginAsync(HttpClient client, string email)
    {
        var response = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = "ValidPassword1!" });
        response.EnsureSuccessStatusCode();
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", json.RootElement.GetProperty("accessToken").GetString());
    }
}

