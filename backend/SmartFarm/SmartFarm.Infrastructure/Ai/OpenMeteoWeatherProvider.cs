using System.Globalization;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Application.Features.Ai;
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
    IOptions<OpenMeteoOptions> options) : IAiWeatherProvider
{
    private readonly OpenMeteoOptions settings = options.Value;

    public async Task<AiWeatherResult> GetAsync(Guid farmId, Guid zoneId, CancellationToken cancellationToken)
    {
        if (!settings.Enabled)
            return new(false, null, null, null, null, "Open-Meteo is disabled.");
        var farm = await db.Farms.AsNoTracking().Where(x => x.Id == farmId)
            .Select(x => new { x.Latitude, x.Longitude }).SingleOrDefaultAsync(cancellationToken);
        if (farm?.Latitude is null || farm.Longitude is null)
            return new(false, null, null, null, null, "Farm coordinates are missing.");

        var url = string.Create(CultureInfo.InvariantCulture,
            $"{settings.BaseUrl}?latitude={farm.Latitude}&longitude={farm.Longitude}&current=temperature_2m,weather_code&hourly=precipitation_probability&forecast_hours=6&timezone=UTC");
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
        return new(true, Describe(code), rain, temperature.GetDecimal(), observedAt, null);
    }

    private static string Describe(int code) => code switch
    {
        0 => "Clear sky",
        1 or 2 or 3 => "Partly cloudy or overcast",
        45 or 48 => "Fog",
        51 or 53 or 55 or 56 or 57 => "Drizzle",
        61 or 63 or 65 or 66 or 67 => "Rain",
        71 or 73 or 75 or 77 => "Snow",
        80 or 81 or 82 => "Rain showers",
        85 or 86 => "Snow showers",
        95 or 96 or 99 => "Thunderstorm",
        _ => "Weather observation available"
    };
}
