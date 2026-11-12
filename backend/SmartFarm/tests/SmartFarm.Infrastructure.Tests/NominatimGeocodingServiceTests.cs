using System.Net;
using System.Text;
using FluentAssertions;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Infrastructure.Platform;
using Xunit;

namespace SmartFarm.Infrastructure.Tests;

/// <summary>
/// Lỗi nhà cung cấp (DNS/mạng, timeout, 429, 5xx, JSON hỏng) phải được báo là lỗi nhà cung cấp,
/// chỉ "không có địa chỉ" mới được trả null (controller đổi thành 404).
/// </summary>
public class NominatimGeocodingServiceTests
{
    private sealed class StubHandler(Func<HttpRequestMessage, Task<HttpResponseMessage>> respond) : HttpMessageHandler
    {
        public List<Uri> Requests { get; } = [];

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Requests.Add(request.RequestUri!);
            return respond(request);
        }
    }

    private sealed class SingleValueConfiguration(string key, string value) : IConfiguration
    {
        public string? this[string k] { get => k == key ? value : null; set => throw new NotSupportedException(); }
        public IEnumerable<IConfigurationSection> GetChildren() => [];
        public Microsoft.Extensions.Primitives.IChangeToken GetReloadToken() => throw new NotSupportedException();
        public IConfigurationSection GetSection(string k) => throw new NotSupportedException();
    }

    private static HttpResponseMessage Json(string body, HttpStatusCode code = HttpStatusCode.OK) =>
        new(code) { Content = new StringContent(body, Encoding.UTF8, "application/json") };

    private static NominatimGeocodingService Create(StubHandler handler, IConfiguration? configuration = null) =>
        new(new HttpClient(handler), new MemoryCache(new MemoryCacheOptions()), NullLogger<NominatimGeocodingService>.Instance, configuration);

    [Fact]
    public async Task Reverse_Returns_DisplayName_And_Address_Parts()
    {
        var handler = new StubHandler(_ => Task.FromResult(Json(
            """{"display_name":"Phường 1, Đà Lạt, Lâm Đồng","address":{"road":"Đường A","suburb":"Phường 1","city":"Đà Lạt","state":"Lâm Đồng"}}""")));

        var result = await Create(handler).ReverseGeocodeAsync(11.9404m, 108.4583m, CancellationToken.None);

        result.Should().NotBeNull();
        result!.DisplayName.Should().Be("Phường 1, Đà Lạt, Lâm Đồng");
        result.City.Should().Be("Đà Lạt");
        result.Province.Should().Be("Lâm Đồng");
        handler.Requests.Single().AbsolutePath.Should().Be("/reverse");
    }

    [Fact]
    public async Task Reverse_Provider_Says_No_Result_Returns_Null_Not_Exception()
    {
        var handler = new StubHandler(_ => Task.FromResult(Json("""{"error":"Unable to geocode"}""")));

        var result = await Create(handler).ReverseGeocodeAsync(11.9404m, 108.4583m, CancellationToken.None);

        result.Should().BeNull();
    }

    [Fact]
    public async Task Reverse_Dns_Or_Network_Failure_Throws_Unavailable()
    {
        var handler = new StubHandler(_ => throw new HttpRequestException("No such host is known.", new System.Net.Sockets.SocketException(11001)));

        var act = () => Create(handler).ReverseGeocodeAsync(11.9404m, 108.4583m, CancellationToken.None);

        (await act.Should().ThrowAsync<GeocodingProviderException>()).Which.Kind.Should().Be(GeocodingFailureKind.Unavailable);
    }

    [Fact]
    public async Task Reverse_Provider_Timeout_Throws_Timeout()
    {
        var handler = new StubHandler(_ => throw new TaskCanceledException("timed out"));

        var act = () => Create(handler).ReverseGeocodeAsync(11.9404m, 108.4583m, CancellationToken.None);

        (await act.Should().ThrowAsync<GeocodingProviderException>()).Which.Kind.Should().Be(GeocodingFailureKind.Timeout);
    }

    [Fact]
    public async Task Reverse_Client_Cancellation_Is_Not_Reported_As_Provider_Error()
    {
        using var cts = new CancellationTokenSource();
        cts.Cancel();
        var handler = new StubHandler(r => throw new TaskCanceledException("cancelled"));

        var act = () => Create(handler).ReverseGeocodeAsync(11.9404m, 108.4583m, cts.Token);

        await act.Should().ThrowAsync<OperationCanceledException>();
    }

    [Theory]
    [InlineData(HttpStatusCode.TooManyRequests, GeocodingFailureKind.RateLimited)]
    [InlineData(HttpStatusCode.InternalServerError, GeocodingFailureKind.ProviderError)]
    [InlineData(HttpStatusCode.Forbidden, GeocodingFailureKind.ProviderError)]
    public async Task Reverse_Provider_Http_Error_Maps_To_Kind(HttpStatusCode status, GeocodingFailureKind expected)
    {
        var handler = new StubHandler(_ => Task.FromResult(Json("{}", status)));

        var act = () => Create(handler).ReverseGeocodeAsync(11.9404m, 108.4583m, CancellationToken.None);

        (await act.Should().ThrowAsync<GeocodingProviderException>()).Which.Kind.Should().Be(expected);
    }

    [Fact]
    public async Task Reverse_Invalid_Json_Throws_ProviderError()
    {
        var handler = new StubHandler(_ => Task.FromResult(Json("<html>not json</html>")));

        var act = () => Create(handler).ReverseGeocodeAsync(11.9404m, 108.4583m, CancellationToken.None);

        (await act.Should().ThrowAsync<GeocodingProviderException>()).Which.Kind.Should().Be(GeocodingFailureKind.ProviderError);
    }

    [Fact]
    public async Task Reverse_Uses_Configured_Provider_Base_Url()
    {
        var handler = new StubHandler(_ => Task.FromResult(Json("""{"display_name":"X"}""")));
        var config = new SingleValueConfiguration("Geocoding:NominatimBaseUrl", "https://geo.example.test/");

        await Create(handler, config).ReverseGeocodeAsync(11.9404m, 108.4583m, CancellationToken.None);

        handler.Requests.Single().Host.Should().Be("geo.example.test");
    }

    private const string PhotonDalat = """{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"type":"street","name":"Hùng Vương","district":"Xuân Hương","city":"Đà Lạt","state":"Lâm Đồng","country":"Việt Nam"},"geometry":{"type":"Point","coordinates":[108.4583,11.9404]}}]}""";

    private static StubHandler NominatimDownPhotonUp(string photonBody) => new(r =>
        r.RequestUri!.Host.Contains("nominatim")
            ? throw new HttpRequestException("No such host is known.")
            : Task.FromResult(Json(photonBody)));

    [Fact]
    public async Task Reverse_Falls_Back_To_Photon_When_Nominatim_Unreachable()
    {
        var handler = NominatimDownPhotonUp(PhotonDalat);

        var result = await Create(handler).ReverseGeocodeAsync(11.9404m, 108.4583m, CancellationToken.None);

        result.Should().NotBeNull();
        result!.DisplayName.Should().Be("Hùng Vương, Xuân Hương, Đà Lạt, Lâm Đồng, Việt Nam");
        result.City.Should().Be("Đà Lạt");
        handler.Requests.Select(u => u.Host).Should().Contain(["nominatim.openstreetmap.org", "photon.komoot.io"]);
        handler.Requests.Last().Query.Should().Contain("lon=108.4583").And.Contain("lat=11.9404");
    }

    [Fact]
    public async Task Reverse_Photon_Far_Landmark_Is_Not_Used_As_Address_Only_Admin_Levels()
    {
        // Đỉnh núi cách ~3 km: không được dùng tên "Hòn Nga" làm địa chỉ điểm; chỉ giữ xã/tỉnh.
        var handler = NominatimDownPhotonUp(
            """{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"name":"Hòn Nga","county":"Xã Phú Sơn Lâm Hà","state":"Lâm Đồng","country":"Việt Nam"},"geometry":{"type":"Point","coordinates":[108.227,12.0]}}]}""");

        var result = await Create(handler).ReverseGeocodeAsync(12.0m, 108.2m, CancellationToken.None);

        result.Should().NotBeNull();
        result!.DisplayName.Should().Be("Xã Phú Sơn Lâm Hà, Lâm Đồng, Việt Nam");
        result.DisplayName.Should().NotContain("Hòn Nga");
    }

    [Fact]
    public async Task Reverse_Photon_Country_Only_Is_Treated_As_No_Result()
    {
        var handler = NominatimDownPhotonUp(
            """{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"country":"Việt Nam"},"geometry":{"type":"Point","coordinates":[108.2,12.0]}}]}""");

        (await Create(handler).ReverseGeocodeAsync(12.0m, 108.2m, CancellationToken.None)).Should().BeNull();
    }

    [Fact]
    public async Task Reverse_Photon_Without_Features_Returns_Null()
    {
        var handler = NominatimDownPhotonUp("""{"type":"FeatureCollection","features":[]}""");

        (await Create(handler).ReverseGeocodeAsync(11.9404m, 108.4583m, CancellationToken.None)).Should().BeNull();
    }

    [Fact]
    public async Task Reverse_Both_Providers_Down_Reports_Original_Provider_Error()
    {
        var handler = new StubHandler(_ => throw new HttpRequestException("No such host is known."));

        var act = () => Create(handler).ReverseGeocodeAsync(11.9404m, 108.4583m, CancellationToken.None);

        (await act.Should().ThrowAsync<GeocodingProviderException>()).Which.Kind.Should().Be(GeocodingFailureKind.Unavailable);
    }

    [Fact]
    public async Task Reverse_Photon_Fallback_Can_Be_Disabled_By_Configuration()
    {
        var handler = NominatimDownPhotonUp(PhotonDalat);
        var config = new SingleValueConfiguration("Geocoding:PhotonEnabled", "false");

        var act = () => Create(handler, config).ReverseGeocodeAsync(11.9404m, 108.4583m, CancellationToken.None);

        await act.Should().ThrowAsync<GeocodingProviderException>();
        handler.Requests.Should().OnlyContain(u => u.Host.Contains("nominatim"));
    }

    [Fact]
    public async Task Reverse_Invalid_Coordinates_Return_Null_Without_Calling_Provider()
    {
        var handler = new StubHandler(_ => Task.FromResult(Json("{}")));

        (await Create(handler).ReverseGeocodeAsync(0m, 0m, CancellationToken.None)).Should().BeNull();
        handler.Requests.Should().BeEmpty();
    }
}
