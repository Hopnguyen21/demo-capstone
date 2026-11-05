namespace SmartFarm.Application.Common.Interfaces;

public sealed record GeocodingAddressView(
    string DisplayName,
    string? Road,
    string? Ward,
    string? District,
    string? City,
    string? Province,
    decimal Latitude,
    decimal Longitude);

public interface IGeocodingService
{
    Task<GeocodingAddressView?> ReverseGeocodeAsync(decimal latitude, decimal longitude, CancellationToken ct);
    Task<IReadOnlyList<GeocodingAddressView>> SearchLocationAsync(string query, CancellationToken ct);
}

