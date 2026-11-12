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

public enum GeocodingFailureKind { Unavailable, Timeout, RateLimited, ProviderError }

/// <summary>
/// Nhà cung cấp geocoding lỗi (DNS/mạng, timeout, 429, 5xx, JSON hỏng). Khác với "không có kết quả":
/// trường hợp đó <see cref="IGeocodingService.ReverseGeocodeAsync"/> trả null.
/// </summary>
public sealed class GeocodingProviderException(GeocodingFailureKind kind, string message, Exception? inner = null)
    : Exception(message, inner)
{
    public GeocodingFailureKind Kind { get; } = kind;
}

public interface IGeocodingService
{
    /// <summary>Trả null nếu nhà cung cấp trả lời nhưng không có địa chỉ; ném <see cref="GeocodingProviderException"/> khi nhà cung cấp lỗi.</summary>
    Task<GeocodingAddressView?> ReverseGeocodeAsync(decimal latitude, decimal longitude, CancellationToken ct);
    Task<IReadOnlyList<GeocodingAddressView>> SearchLocationAsync(string query, CancellationToken ct);
}

