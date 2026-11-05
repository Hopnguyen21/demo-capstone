using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SmartFarm.Infrastructure.Persistence;

namespace SmartFarm.Infrastructure.Ai.Location;

public sealed record EffectiveLocation(
    decimal Latitude,
    decimal Longitude,
    string SourceLevel,
    string? GeneralRegion);

/// <summary>
/// Xác định vị trí địa lý hiệu lực theo quy tắc kế thừa phân cấp:
/// 1. Zone (nếu có ranh giới GIS hợp lệ và tâm/điểm đại diện nằm an toàn bên trong Zone)
/// 2. Field (nếu Zone kế thừa từ Thửa ruộng có tọa độ)
/// 3. Farm (fallback về Trang trại cha)
/// 
/// Đảm bảo tính nhất quán, bảo mật đa người thuê (multi-tenant) và độc lập của dữ liệu thời tiết.
/// </summary>
public static class EffectiveLocationResolver
{
    public static async Task<EffectiveLocation?> ResolveAsync(
        SmartFarmDbContext db,
        Guid farmId,
        Guid? zoneId,
        CancellationToken cancellationToken)
    {
        string? farmLocationText = null;

        // 1. Kiểm tra cấp Zone (nếu có zoneId)
        if (zoneId.HasValue && zoneId.Value != Guid.Empty)
        {
            var query = db.Zones.AsNoTracking().Where(z => z.Id == zoneId.Value);
            // Bảo mật dữ liệu: đảm bảo Zone phải thuộc về đúng Farm được yêu cầu nếu có farmId
            if (farmId != Guid.Empty)
            {
                query = query.Where(z => z.Field.FarmId == farmId);
            }

            var zoneData = await query
                .Select(z => new
                {
                    z.BoundaryGeoJson,
                    FieldLatitude = z.Field.Latitude,
                    FieldLongitude = z.Field.Longitude,
                    FarmLatitude = z.Field.Farm.Latitude,
                    FarmLongitude = z.Field.Farm.Longitude,
                    FarmLocationText = z.Field.Farm.LocationText
                })
                .FirstOrDefaultAsync(cancellationToken);

            if (zoneData != null)
            {
                farmLocationText = zoneData.FarmLocationText;
                var generalRegion = GeneralRegionSanitizer.Sanitize(farmLocationText);

                // Ưu tiên 1: Điểm đại diện an toàn trong ranh giới của Zone
                var zoneCenter = TryExtractCenterFromGeoJson(zoneData.BoundaryGeoJson);
                if (zoneCenter.HasValue && IsValidCoordinate(zoneCenter.Value.Lat, zoneCenter.Value.Lng))
                {
                    return new EffectiveLocation(zoneCenter.Value.Lat, zoneCenter.Value.Lng, "Zone", generalRegion);
                }

                // Ưu tiên 2: Tọa độ của Field chứa Zone
                if (zoneData.FieldLatitude.HasValue && zoneData.FieldLongitude.HasValue &&
                    IsValidCoordinate(zoneData.FieldLatitude.Value, zoneData.FieldLongitude.Value))
                {
                    return new EffectiveLocation(zoneData.FieldLatitude.Value, zoneData.FieldLongitude.Value, "Field", generalRegion);
                }

                // Ưu tiên 3: Tọa độ của Farm chứa Zone
                if (zoneData.FarmLatitude.HasValue && zoneData.FarmLongitude.HasValue &&
                    IsValidCoordinate(zoneData.FarmLatitude.Value, zoneData.FarmLongitude.Value))
                {
                    return new EffectiveLocation(zoneData.FarmLatitude.Value, zoneData.FarmLongitude.Value, "Farm", generalRegion);
                }
            }
        }

        // Fallback: Kiểm tra cấp Farm trực tiếp
        if (farmId != Guid.Empty)
        {
            var farm = await db.Farms.AsNoTracking()
                .Where(f => f.Id == farmId)
                .Select(f => new { f.Latitude, f.Longitude, f.LocationText })
                .FirstOrDefaultAsync(cancellationToken);

            if (farm?.Latitude.HasValue == true && farm.Longitude.HasValue == true &&
                IsValidCoordinate(farm.Latitude.Value, farm.Longitude.Value))
            {
                var generalRegion = GeneralRegionSanitizer.Sanitize(farm.LocationText ?? farmLocationText);
                return new EffectiveLocation(farm.Latitude.Value, farm.Longitude.Value, "Farm", generalRegion);
            }
        }

        return null;
    }

    public static bool IsValidCoordinate(decimal lat, decimal lng) =>
        lat is >= -90 and <= 90 &&
        lng is >= -180 and <= 180 &&
        !(lat == 0 && lng == 0);

    /// <summary>
    /// Thuật toán Ray-Casting kiểm tra một điểm (lat, lng) có nằm bên trong đa giác hay không.
    /// </summary>
    public static bool IsPointInPolygon(decimal lat, decimal lng, IReadOnlyList<(decimal Lat, decimal Lng)> ring)
    {
        if (ring.Count < 3) return false;
        var inside = false;
        for (int i = 0, j = ring.Count - 1; i < ring.Count; j = i++)
        {
            var xi = ring[i].Lng;
            var yi = ring[i].Lat;
            var xj = ring[j].Lng;
            var yj = ring[j].Lat;

            var intersect = ((yi > lat) != (yj > lat)) &&
                            (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
            if (intersect)
                inside = !inside;
        }
        return inside;
    }

    /// <summary>
    /// Trích xuất điểm đại diện an toàn từ GeoJSON (tuân thủ RFC 7946 GeoJSON Polygon và MultiPolygon,
    /// cũng như định dạng mảng tọa độ mở rộng).
    /// Với polygon lõm (concave), nếu trọng tâm hình học (centroid) rơi ra ngoài ranh giới,
    /// hàm sẽ tìm điểm nội suy an toàn bên trong đa giác hoặc trả về null để fallback an toàn về Field/Farm.
    /// </summary>
    public static (decimal Lat, decimal Lng)? TryExtractCenterFromGeoJson(string? geoJson)
    {
        if (string.IsNullOrWhiteSpace(geoJson)) return null;

        try
        {
            using var doc = JsonDocument.Parse(geoJson);
            var root = doc.RootElement;

            List<List<(decimal Lat, decimal Lng)>> polygons = [];

            // Case A: GeoJSON Object {"type": "Polygon"|"MultiPolygon", "coordinates": ...}
            if (root.ValueKind == JsonValueKind.Object)
            {
                var type = root.TryGetProperty("type", out var typeEl) ? typeEl.GetString() : null;
                if (root.TryGetProperty("coordinates", out var coordsElement))
                {
                    if (string.Equals(type, "MultiPolygon", StringComparison.OrdinalIgnoreCase))
                    {
                        ExtractMultiPolygon(coordsElement, polygons);
                    }
                    else
                    {
                        ExtractPolygon(coordsElement, polygons);
                    }
                }
            }
            // Case B: Raw Array [[lat, lng], [lat, lng], ...] hoặc [[[lng, lat], ...]]
            else if (root.ValueKind == JsonValueKind.Array)
            {
                ExtractPolygon(root, polygons);
            }

            if (polygons.Count == 0) return null;

            // Tìm đa giác có diện tích lớn nhất (với MultiPolygon)
            List<(decimal Lat, decimal Lng)>? bestRing = null;
            decimal maxArea = -1m;

            foreach (var ring in polygons)
            {
                if (ring.Count < 3) continue;
                var effectiveRing = CleanRing(ring);
                if (effectiveRing.Count < 3) continue;

                var area = Math.Abs(CalculateSignedArea(effectiveRing));
                if (area > maxArea)
                {
                    maxArea = area;
                    bestRing = effectiveRing;
                }
            }

            if (bestRing == null || bestRing.Count < 3) return null;

            // Tính Centroid hình học chuẩn
            var (cLat, cLng) = CalculateCentroid(bestRing);

            // Kiểm tra Ray-Casting: Centroid có nằm BÊN TRONG đa giác không?
            if (IsPointInPolygon(cLat, cLng, bestRing))
            {
                return (Math.Round(cLat, 6), Math.Round(cLng, 6));
            }

            // Với polygon lõm (concave) mà centroid nằm ngoài:
            // Tìm điểm tam giác nội suy an toàn bên trong đa giác
            for (int i = 1; i < bestRing.Count - 1; i++)
            {
                var triLat = (bestRing[0].Lat + bestRing[i].Lat + bestRing[i + 1].Lat) / 3m;
                var triLng = (bestRing[0].Lng + bestRing[i].Lng + bestRing[i + 1].Lng) / 3m;

                if (IsPointInPolygon(triLat, triLng, bestRing))
                {
                    return (Math.Round(triLat, 6), Math.Round(triLng, 6));
                }
            }

            // Nếu không tìm được điểm bên trong an toàn, fallback về null để dùng Field/Farm
            return null;
        }
        catch
        {
            return null;
        }
    }

    private static List<(decimal Lat, decimal Lng)> CleanRing(List<(decimal Lat, decimal Lng)> points)
    {
        if (points.Count > 3 && points[0].Lat == points[^1].Lat && points[0].Lng == points[^1].Lng)
        {
            return points.Take(points.Count - 1).ToList();
        }
        return points;
    }

    private static decimal CalculateSignedArea(IReadOnlyList<(decimal Lat, decimal Lng)> ring)
    {
        decimal area = 0m;
        int n = ring.Count;
        for (int i = 0; i < n; i++)
        {
            int j = (i + 1) % n;
            area += (ring[i].Lng * ring[j].Lat) - (ring[j].Lng * ring[i].Lat);
        }
        return area / 2m;
    }

    private static (decimal Lat, decimal Lng) CalculateCentroid(IReadOnlyList<(decimal Lat, decimal Lng)> ring)
    {
        int n = ring.Count;
        decimal area = CalculateSignedArea(ring);

        if (Math.Abs(area) < 0.000000000001m)
        {
            // Suy biến: dùng trung bình cộng
            return (ring.Average(p => p.Lat), ring.Average(p => p.Lng));
        }

        decimal cLng = 0m;
        decimal cLat = 0m;

        for (int i = 0; i < n; i++)
        {
            int j = (i + 1) % n;
            decimal factor = (ring[i].Lng * ring[j].Lat) - (ring[j].Lng * ring[i].Lat);
            cLng += (ring[i].Lng + ring[j].Lng) * factor;
            cLat += (ring[i].Lat + ring[j].Lat) * factor;
        }

        decimal sixArea = area * 6m;
        cLng /= sixArea;
        cLat /= sixArea;

        return (cLat, cLng);
    }

    private static void ExtractPolygon(JsonElement element, List<List<(decimal Lat, decimal Lng)>> polygons)
    {
        if (element.ValueKind != JsonValueKind.Array) return;

        // Nếu là mảng 2 phần tử số: [c0, c1] -> không phải ring, bỏ qua
        var items = element.EnumerateArray().ToList();
        if (items.Count == 0) return;

        // Kiểm tra xem đây có phải là danh sách điểm [ [x, y], [x, y], ... ] (Ring)
        if (items[0].ValueKind == JsonValueKind.Array)
        {
            var firstSub = items[0].EnumerateArray().ToList();
            if (firstSub.Count == 2 && firstSub[0].ValueKind == JsonValueKind.Number)
            {
                // Đây là một LinearRing!
                var ring = new List<(decimal Lat, decimal Lng)>();
                foreach (var pt in items)
                {
                    var coords = pt.EnumerateArray().ToList();
                    if (coords.Count >= 2 && coords[0].ValueKind == JsonValueKind.Number && coords[1].ValueKind == JsonValueKind.Number)
                    {
                        var c0 = coords[0].GetDecimal();
                        var c1 = coords[1].GetDecimal();
                        // GeoJSON RFC 7946: [lng, lat]
                        if (c1 is >= -90 and <= 90 && c0 is >= -180 and <= 180)
                            ring.Add((Lat: c1, Lng: c0));
                        else if (c0 is >= -90 and <= 90 && c1 is >= -180 and <= 180)
                            ring.Add((Lat: c0, Lng: c1));
                    }
                }
                if (ring.Count >= 3)
                {
                    polygons.Add(ring);
                }
                return;
            }
        }

        // Nếu là mảng lồng nhau (Polygon chứa rings hoặc MultiPolygon)
        foreach (var sub in items)
        {
            if (sub.ValueKind == JsonValueKind.Array)
            {
                ExtractPolygon(sub, polygons);
            }
        }
    }

    private static void ExtractMultiPolygon(JsonElement element, List<List<(decimal Lat, decimal Lng)>> polygons)
    {
        if (element.ValueKind != JsonValueKind.Array) return;
        foreach (var poly in element.EnumerateArray())
        {
            if (poly.ValueKind == JsonValueKind.Array)
            {
                ExtractPolygon(poly, polygons);
            }
        }
    }
}
