using System.Globalization;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Application.Features.Ai;
using SmartFarm.Infrastructure.Ai.Location;
using SmartFarm.Infrastructure.Persistence;

namespace SmartFarm.Infrastructure.Ai;

public sealed class OpenMeteoOptions
{
    public const string SectionName = "OpenMeteo";
    public bool Enabled { get; set; } = true;
    public string BaseUrl { get; set; } = "https://api.open-meteo.com/v1/forecast";
    public int TimeoutSeconds { get; set; } = 10;
}

public sealed class OpenMeteoWeatherProvider(
    SmartFarmDbContext db,
    HttpClient httpClient,
    IOptions<OpenMeteoOptions> options,
    IMemoryCache? cache = null) : IAiWeatherProvider
{
    private readonly OpenMeteoOptions settings = options.Value;

    public async Task<AiWeatherResult> GetAsync(Guid farmId, Guid zoneId, CancellationToken cancellationToken)
    {
        if (!settings.Enabled)
            return new(false, null, null, null, null, "Open-Meteo is disabled.");

        // Kế thừa vị trí theo phân cấp: Zone (tâm ranh giới) -> Field (tọa độ thửa) -> Farm (tọa độ nông trại)
        var location = await EffectiveLocationResolver.ResolveAsync(db, farmId, zoneId, cancellationToken);
        if (location is null)
            return new(false, null, null, null, null, "Tọa độ vị trí chưa được cấu hình (Zone/Field/Farm).");

        // Cache theo tọa độ hiệu lực làm tròn 3 chữ số thập phân (~110m).
        // Khi người dùng thay đổi vị trí Farm/Field/Zone, tọa độ mới sẽ sinh cache key mới, tránh trộn dữ liệu.
        var cacheKey = FormattableString.Invariant($"weather_eff_{location.Latitude:F3}_{location.Longitude:F3}");
        if (cache != null && cache.TryGetValue(cacheKey, out AiWeatherResult? cached) && cached is not null)
        {
            return cached;
        }

        // Chỉ gửi tọa độ tối thiểu cần thiết tới Open-Meteo; tuyệt đối KHÔNG đính kèm tên Farm, tên người dùng, hợp đồng hay ID.
        var url = string.Create(CultureInfo.InvariantCulture,
            $"{settings.BaseUrl}?latitude={location.Latitude}&longitude={location.Longitude}&current=temperature_2m,weather_code&hourly=precipitation_probability&forecast_hours=6&timezone=UTC");
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(settings.TimeoutSeconds));
        using var response = await httpClient.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, timeout.Token);
        if (!response.IsSuccessStatusCode)
            return new(false, null, null, null, null, $"Open-Meteo returned HTTP {(int)response.StatusCode}.");
        using var json = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(timeout.Token), cancellationToken: timeout.Token);
        if (!json.RootElement.TryGetProperty("current", out var current) ||
            !current.TryGetProperty("temperature_2m", out var temperature))
            return new(false, null, null, null, null, "Open-Meteo response did not include current temperature.");

        var code = current.TryGetProperty("weather_code", out var codeElement) ? codeElement.GetInt32() : -1;
        var observedAt = current.TryGetProperty("time", out var time) && DateTime.TryParse(time.GetString(), CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out var parsed) ? parsed : DateTime.UtcNow;
        decimal? rain = null;
        if (json.RootElement.TryGetProperty("hourly", out var hourly) && hourly.TryGetProperty("precipitation_probability", out var probabilities))
        {
            var values = probabilities.EnumerateArray().Where(x => x.ValueKind == JsonValueKind.Number).Select(x => x.GetDecimal()).ToList();
            if (values.Count > 0) rain = values.Max();
        }
        var result = new AiWeatherResult(true, Describe(code), rain, temperature.GetDecimal(), observedAt, null);
        cache?.Set(cacheKey, result, TimeSpan.FromMinutes(15));
        return result;
    }

    private static string Describe(int code) => code switch
    {
        0 => "Trời quang",
        1 => "Ít mây",
        2 => "Có mây",
        3 => "Âm u",
        45 or 48 => "Sương mù",
        51 or 53 or 55 or 56 or 57 => "Mưa phùn",
        61 or 63 or 65 or 66 or 67 => "Mưa",
        71 or 73 or 75 or 77 => "Tuyết",
        80 or 81 or 82 => "Mưa rào",
        85 or 86 => "Mưa tuyết rào",
        95 or 96 or 99 => "Dông",
        _ => "Có dữ liệu thời tiết quan trắc"
    };
}
