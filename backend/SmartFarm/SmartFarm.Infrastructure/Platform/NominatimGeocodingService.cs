using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using SmartFarm.Application.Common.Interfaces;

namespace SmartFarm.Infrastructure.Platform;

public sealed class NominatimGeocodingService(
    HttpClient httpClient,
    IMemoryCache cache,
    ILogger<NominatimGeocodingService> logger) : IGeocodingService
{
    private const string NominatimBaseUrl = "https://nominatim.openstreetmap.org";
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
            var url = FormattableString.Invariant($"{NominatimBaseUrl}/reverse?format=json&lat={latitude}&lon={longitude}&zoom=16&addressdetails=1");
            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.Add("User-Agent", "SmartFarmApp/1.0 (contact@smartfarm.vn)");
            request.Headers.Add("Accept-Language", "vi,en");

            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(8));

            using var response = await httpClient.SendAsync(request, cts.Token);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("[Geocoding] Reverse geocoding failed with HTTP {Status}", (int)response.StatusCode);
                return null;
            }

            using var json = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(cts.Token), cancellationToken: cts.Token);
            var root = json.RootElement;
            if (!root.TryGetProperty("display_name", out var displayEl))
                return null;

            var displayName = displayEl.GetString() ?? string.Empty;
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
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning("[Geocoding] Reverse geocode failed with {ExceptionType}.", ex.GetType().Name);
            return null;
        }
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

