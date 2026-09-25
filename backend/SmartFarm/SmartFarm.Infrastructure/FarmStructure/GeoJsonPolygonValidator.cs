using System.Text.Json;
using SmartFarm.Application.Common.Exceptions;
using SmartFarm.Infrastructure.Persistence.Configurations;

namespace SmartFarm.Infrastructure.FarmStructure;

internal static class GeoJsonPolygonValidator
{
    public static string Normalize(JsonElement polygon, string fieldName)
    {
        if (polygon.ValueKind != JsonValueKind.Object ||
            !polygon.TryGetProperty("type", out var type) ||
            type.GetString() != "Polygon" ||
            !polygon.TryGetProperty("coordinates", out var coordinates) ||
            coordinates.ValueKind != JsonValueKind.Array ||
            coordinates.GetArrayLength() == 0)
        {
            throw new RequestValidationException(fieldName, "A GeoJSON Polygon with at least one ring is required.");
        }

        foreach (var ring in coordinates.EnumerateArray())
        {
            ValidateRing(ring, fieldName);
        }

        var normalized = JsonSerializer.Serialize(polygon);
        try
        {
            if (!GeoJsonPolygonValueConverter.Parse(normalized).IsValid)
                throw new RequestValidationException(fieldName, "Polygon geometry is not topologically valid.");
        }
        catch (RequestValidationException)
        {
            throw;
        }
        catch (Exception exception) when (exception is ArgumentException or InvalidOperationException)
        {
            throw new RequestValidationException(fieldName, "Polygon geometry is invalid.");
        }

        return normalized;
    }

    private static void ValidateRing(JsonElement ring, string fieldName)
    {
        if (ring.ValueKind != JsonValueKind.Array || ring.GetArrayLength() < 4)
        {
            throw new RequestValidationException(fieldName, "Every Polygon ring must contain at least four positions.");
        }

        var positions = ring.EnumerateArray().ToArray();
        foreach (var position in positions)
        {
            if (position.ValueKind != JsonValueKind.Array || position.GetArrayLength() < 2)
            {
                throw new RequestValidationException(fieldName, "Every Polygon position must contain longitude and latitude.");
            }

            var values = position.EnumerateArray().ToArray();
            if (!values[0].TryGetDecimal(out var longitude) || !values[1].TryGetDecimal(out var latitude) ||
                longitude is < -180 or > 180 || latitude is < -90 or > 90)
            {
                throw new RequestValidationException(fieldName, "Polygon coordinates must contain valid longitude and latitude values.");
            }
        }

        var first = positions[0].EnumerateArray().Take(2).Select(x => x.GetDecimal()).ToArray();
        var last = positions[^1].EnumerateArray().Take(2).Select(x => x.GetDecimal()).ToArray();
        if (first[0] != last[0] || first[1] != last[1])
        {
            throw new RequestValidationException(fieldName, "Every Polygon ring must be closed.");
        }
    }
}
