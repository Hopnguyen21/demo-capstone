using System.Text.Json;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using NetTopologySuite.Geometries;

namespace SmartFarm.Infrastructure.Persistence.Configurations;

internal sealed class GeoJsonPolygonValueConverter : ValueConverter<string?, Polygon?>
{
    public static readonly GeoJsonPolygonValueConverter Instance = new();

    private GeoJsonPolygonValueConverter()
        : base(
            geoJson => geoJson == null ? null : Parse(geoJson),
            polygon => polygon == null ? null : Serialize(polygon))
    {
    }

    internal static Polygon Parse(string geoJson)
    {
        using var document = JsonDocument.Parse(geoJson);
        var coordinates = document.RootElement.GetProperty("coordinates");
        var rings = coordinates.EnumerateArray().Select(ToRing).ToArray();
        var polygon = new Polygon(rings[0], rings.Skip(1).ToArray()) { SRID = 4326 };
        return polygon;
    }

    private static LinearRing ToRing(JsonElement ring)
    {
        var coordinates = ring.EnumerateArray()
            .Select(position =>
            {
                var ordinates = position.EnumerateArray().ToArray();
                return new Coordinate(ordinates[0].GetDouble(), ordinates[1].GetDouble());
            })
            .ToArray();
        return new LinearRing(coordinates) { SRID = 4326 };
    }

    internal static string Serialize(Polygon polygon)
    {
        var rings = new List<double[][]> { ToCoordinates(polygon.ExteriorRing) };
        for (var index = 0; index < polygon.NumInteriorRings; index++)
            rings.Add(ToCoordinates(polygon.GetInteriorRingN(index)));

        return JsonSerializer.Serialize(new { type = "Polygon", coordinates = rings });
    }

    private static double[][] ToCoordinates(LineString ring) => ring.Coordinates
        .Select(coordinate => new[] { coordinate.X, coordinate.Y })
        .ToArray();
}
