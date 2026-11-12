using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using SmartFarm.Application.Common.Interfaces;

namespace SmartFarm.Infrastructure.Platform;

public sealed class NominatimGeocodingService(
    HttpClient httpClient,
    IMemoryCache cache,
    ILogger<NominatimGeocodingService> logger,
    IConfiguration? configuration = null) : IGeocodingService
{
    private const string DefaultNominatimBaseUrl = "https://nominatim.openstreetmap.org";

    /// <summary>Cho phép trỏ tới bản sao/mirror Nominatim khi mạng chặn tên miền mặc định (Geocoding:NominatimBaseUrl).</summary>
    private string NominatimBaseUrl => (configuration?["Geocoding:NominatimBaseUrl"] is { Length: > 0 } custom ? custom : DefaultNominatimBaseUrl).TrimEnd('/');
    private const string DefaultPhotonBaseUrl = "https://photon.komoot.io";

    /// <summary>Nhà cung cấp dự phòng (Photon, dữ liệu OSM) khi Nominatim không truy cập được (DNS/mạng/5xx/timeout).</summary>
    private string PhotonBaseUrl => (configuration?["Geocoding:PhotonBaseUrl"] is { Length: > 0 } custom ? custom : DefaultPhotonBaseUrl).TrimEnd('/');
    private bool PhotonEnabled => !string.Equals(configuration?["Geocoding:PhotonEnabled"], "false", StringComparison.OrdinalIgnoreCase);
    private static readonly TimeSpan ReverseCacheDuration = TimeSpan.FromHours(24);
    private static readonly TimeSpan SearchCacheDuration = TimeSpan.FromHours(2);

    public async Task<GeocodingAddressView?> ReverseGeocodeAsync(decimal latitude, decimal longitude, CancellationToken ct)
    {
        if (latitude is < -90 or > 90 || longitude is < -180 or > 180 || (latitude == 0 && longitude == 0))
            return null;

        var cacheKey = FormattableString.Invariant($"geo_rev_{latitude:F4}_{longitude:F4}");
        if (cache.TryGetValue(cacheKey, out GeocodingAddressView? cached) && cached is not null)
            return cached;

        try
        {
            return await ReverseViaNominatimAsync(latitude, longitude, cacheKey, ct);
        }
        catch (GeocodingProviderException primary) when (PhotonEnabled && primary.Kind != GeocodingFailureKind.RateLimited)
        {
            logger.LogWarning("[Geocoding] Nominatim failed ({Kind}); trying Photon fallback.", primary.Kind);
            var (ok, fallback) = await TryReverseViaPhotonAsync(latitude, longitude, ct);
            if (!ok) throw; // Cả hai lỗi: báo nguyên nhân của nhà cung cấp chính để dễ chẩn đoán.
            if (fallback is not null) cache.Set(cacheKey, fallback, ReverseCacheDuration);
            return fallback;
        }
    }

    private async Task<GeocodingAddressView?> ReverseViaNominatimAsync(decimal latitude, decimal longitude, string cacheKey, CancellationToken ct)
    {
        try
        {
            var url = FormattableString.Invariant($"{NominatimBaseUrl}/reverse?format=json&lat={latitude}&lon={longitude}&zoom=16&addressdetails=1");
            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.Add("User-Agent", "SmartFarmApp/1.0 (contact@smartfarm.vn)");
            request.Headers.Add("Accept-Language", "vi,en");

            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(8));

            using var response = await httpClient.SendAsync(request, cts.Token);
            if (!response.IsSuccessStatusCode)
            {
                var status = (int)response.StatusCode;
                logger.LogWarning("[Geocoding] Reverse geocoding provider returned HTTP {Status}", status);
                throw new GeocodingProviderException(
                    status == 429 ? GeocodingFailureKind.RateLimited : GeocodingFailureKind.ProviderError,
                    status == 429
                        ? "Dịch vụ tên địa điểm đang giới hạn tần suất. Thử lại sau vài giây."
                        : $"Nhà cung cấp tên địa điểm trả lỗi HTTP {status}.");
            }

            using var json = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(cts.Token), cancellationToken: cts.Token);
            var root = json.RootElement;
            // Nominatim trả 200 {"error":"Unable to geocode"} khi không có địa chỉ: đây là "không có kết quả", không phải lỗi.
            if (root.ValueKind != JsonValueKind.Object || !root.TryGetProperty("display_name", out var displayEl))
                return null;

            var displayName = displayEl.GetString() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(displayName)) return null;
            string? road = null, ward = null, district = null, city = null, province = null;

            if (root.TryGetProperty("address", out var addr))
            {
                road = GetStringProp(addr, "road", "pedestrian", "footway", "path", "neighbourhood");
                ward = GetStringProp(addr, "suburb", "quarter", "hamlet");
                district = GetStringProp(addr, "city_district", "district", "county");
                city = GetStringProp(addr, "city", "town", "village", "municipality");
                province = GetStringProp(addr, "state", "region");
            }

            var result = new GeocodingAddressView(displayName, road, ward, district, city, province, latitude, longitude);
            cache.Set(cacheKey, result, ReverseCacheDuration);
            return result;
        }
        catch (GeocodingProviderException)
        {
            throw;
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            // Hết 8 giây chờ nhà cung cấp (không phải client huỷ yêu cầu).
            logger.LogWarning("[Geocoding] Reverse geocode provider timed out.");
            throw new GeocodingProviderException(GeocodingFailureKind.Timeout, "Nhà cung cấp tên địa điểm phản hồi quá chậm.");
        }
        catch (HttpRequestException ex)
        {
            // DNS không phân giải được tên miền, TLS, từ chối kết nối... Ghi nguyên nhân gốc (không kèm toạ độ).
            logger.LogWarning("[Geocoding] Reverse geocode provider unreachable: {ExceptionType}: {Detail}", ex.GetType().Name, ex.InnerException?.Message ?? ex.Message);
            throw new GeocodingProviderException(
                GeocodingFailureKind.Unavailable,
                "Máy chủ không kết nối được tới dịch vụ tên địa điểm (kiểm tra Internet/DNS của máy chạy backend).", ex);
        }
        catch (JsonException ex)
        {
            logger.LogWarning("[Geocoding] Reverse geocode provider returned invalid JSON.");
            throw new GeocodingProviderException(GeocodingFailureKind.ProviderError, "Nhà cung cấp tên địa điểm trả dữ liệu không đọc được.", ex);
        }
    }

    /// <summary>Photon reverse. ok=false khi chính Photon cũng lỗi; ok=true với null nghĩa là Photon không có địa chỉ.</summary>
    private async Task<(bool Ok, GeocodingAddressView? Result)> TryReverseViaPhotonAsync(decimal latitude, decimal longitude, CancellationToken ct)
    {
        try
        {
            var url = FormattableString.Invariant($"{PhotonBaseUrl}/reverse?lon={longitude}&lat={latitude}&lang=default&radius=10&limit=1");
            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.Add("User-Agent", "SmartFarmApp/1.0 (contact@smartfarm.vn)");

            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(8));

            using var response = await httpClient.SendAsync(request, cts.Token);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("[Geocoding] Photon fallback returned HTTP {Status}", (int)response.StatusCode);
                return (false, null);
            }

            using var json = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(cts.Token), cancellationToken: cts.Token);
            return (true, ParsePhotonReverse(json.RootElement, latitude, longitude));
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex) when (ex is HttpRequestException or OperationCanceledException or JsonException)
        {
            logger.LogWarning("[Geocoding] Photon fallback failed: {ExceptionType}", ex.GetType().Name);
            return (false, null);
        }
    }

    /// <summary>Đối tượng Photon xa hơn ngưỡng này (m) không được dùng làm tên/đường của điểm; chỉ dùng cấp hành chính.</summary>
    private const double PhotonNearFeatureMeters = 1000;

    internal static GeocodingAddressView? ParsePhotonReverse(JsonElement root, decimal latitude, decimal longitude)
    {
        if (root.ValueKind != JsonValueKind.Object ||
            !root.TryGetProperty("features", out var features) ||
            features.ValueKind != JsonValueKind.Array ||
            features.GetArrayLength() == 0 ||
            !features[0].TryGetProperty("properties", out var props) ||
            props.ValueKind != JsonValueKind.Object)
            return null;

        // Photon quét bán kính 10 km nên có thể trả một địa danh ở xa (đỉnh núi, quán...). Tên đó không phải địa chỉ của điểm,
        // nên khi đối tượng ở xa chỉ giữ các cấp hành chính (xã/phường, thành phố, tỉnh).
        var near = DistanceMeters(features[0], latitude, longitude) is { } d && d <= PhotonNearFeatureMeters;

        var name = near ? GetStringProp(props, "name") : null;
        var street = near ? GetStringProp(props, "street") : null;
        var city = GetStringProp(props, "city");
        var ward = GetStringProp(props, "district", "locality");
        // Vùng nông thôn thường chỉ có "county" (ví dụ "Xã Phú Sơn Lâm Hà") thay cho quận/phường.
        if (ward is null && city is null) ward = GetStringProp(props, "county");
        var province = GetStringProp(props, "state");
        var country = GetStringProp(props, "country");

        // Ghép địa chỉ từ các thành phần có thật, bỏ trùng; không dựng chữ nào từ toạ độ.
        var parts = new List<string>();
        foreach (var part in new[] { name ?? street, ward, city, province, country })
        {
            if (!string.IsNullOrWhiteSpace(part) && !parts.Contains(part, StringComparer.OrdinalIgnoreCase)) parts.Add(part);
        }
        if (parts.Count == 0 || (parts.Count == 1 && parts[0] == country)) return null;

        return new GeocodingAddressView(string.Join(", ", parts), street ?? name, ward, null, city, province, latitude, longitude);
    }

    private static double? DistanceMeters(JsonElement feature, decimal latitude, decimal longitude)
    {
        if (!feature.TryGetProperty("geometry", out var geometry) ||
            !geometry.TryGetProperty("coordinates", out var coords) ||
            coords.ValueKind != JsonValueKind.Array || coords.GetArrayLength() < 2 ||
            !coords[0].TryGetDouble(out var lon) || !coords[1].TryGetDouble(out var lat))
            return null;

        const double earthRadius = 6371000;
        var lat1 = (double)latitude * Math.PI / 180;
        var lat2 = lat * Math.PI / 180;
        var dLat = lat2 - lat1;
        var dLon = (lon - (double)longitude) * Math.PI / 180;
        var h = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) + Math.Cos(lat1) * Math.Cos(lat2) * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        return 2 * earthRadius * Math.Asin(Math.Min(1, Math.Sqrt(h)));
    }

    public async Task<IReadOnlyList<GeocodingAddressView>> SearchLocationAsync(string query, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(query))
            return Array.Empty<GeocodingAddressView>();

        var cleanQuery = query.Trim();
        var cacheKey = $"geo_search_{cleanQuery.ToLowerInvariant()}";
        if (cache.TryGetValue(cacheKey, out IReadOnlyList<GeocodingAddressView>? cached) && cached is not null)
            return cached;

        try
        {
            var url = FormattableString.Invariant($"{NominatimBaseUrl}/search?format=json&q={Uri.EscapeDataString(cleanQuery)}&countrycodes=vn&limit=5&addressdetails=1");
            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.Add("User-Agent", "SmartFarmApp/1.0 (contact@smartfarm.vn)");
            request.Headers.Add("Accept-Language", "vi,en");

            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(8));

            using var response = await httpClient.SendAsync(request, cts.Token);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("[Geocoding] Location search failed with HTTP {Status}", (int)response.StatusCode);
                return Array.Empty<GeocodingAddressView>();
            }

            using var json = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(cts.Token), cancellationToken: cts.Token);
            var results = new List<GeocodingAddressView>();

            foreach (var item in json.RootElement.EnumerateArray())
            {
                if (!item.TryGetProperty("lat", out var latEl) || !item.TryGetProperty("lon", out var lonEl))
                    continue;

                if (!decimal.TryParse(latEl.GetString(), NumberStyles.Float, CultureInfo.InvariantCulture, out var lat) ||
                    !decimal.TryParse(lonEl.GetString(), NumberStyles.Float, CultureInfo.InvariantCulture, out var lon))
                    continue;

                var displayName = item.TryGetProperty("display_name", out var dnEl) ? dnEl.GetString() ?? "" : "";
                string? road = null, ward = null, district = null, city = null, province = null;

                if (item.TryGetProperty("address", out var addr))
                {
                    road = GetStringProp(addr, "road", "pedestrian", "footway", "path", "neighbourhood");
                    ward = GetStringProp(addr, "suburb", "quarter", "hamlet");
                    district = GetStringProp(addr, "city_district", "district", "county");
                    city = GetStringProp(addr, "city", "town", "village", "municipality");
                    province = GetStringProp(addr, "state", "region");
                }

                results.Add(new GeocodingAddressView(displayName, road, ward, district, city, province, lat, lon));
            }

            cache.Set(cacheKey, results, SearchCacheDuration);
            return results;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning("[Geocoding] Location search failed with {ExceptionType}.", ex.GetType().Name);
            return Array.Empty<GeocodingAddressView>();
        }
    }

    private static string? GetStringProp(JsonElement element, params string[] propertyNames)
    {
        foreach (var prop in propertyNames)
        {
            if (element.TryGetProperty(prop, out var val) && val.ValueKind == JsonValueKind.String)
            {
                var s = val.GetString();
                if (!string.IsNullOrWhiteSpace(s)) return s;
            }
        }
        return null;
    }
}

