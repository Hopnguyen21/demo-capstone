namespace SmartFarm.Infrastructure.Ai.Location;

/// <summary>
/// Quy đổi nhãn khu vực tổng quát (tỉnh/thành) sang vùng khí hậu để chọn tri thức RAG phù hợp:
/// north (Bắc Bộ, có mùa đông lạnh), central (Bắc/Nam Trung Bộ ven biển), highlands (Tây Nguyên và cao nguyên),
/// south (Nam Bộ, nhiệt đới gió mùa hai mùa). Trả null nếu không nhận diện được (khi đó không lọc theo vùng).
/// </summary>
public static class ClimateRegionMapper
{
    public const string North = "north";
    public const string Central = "central";
    public const string Highlands = "highlands";
    public const string South = "south";

    private static readonly (string Region, string[] Provinces)[] Map =
    [
        (North, ["Hà Nội", "Hải Phòng", "Hà Giang", "Cao Bằng", "Bắc Kạn", "Tuyên Quang", "Lào Cai", "Yên Bái", "Thái Nguyên", "Lạng Sơn", "Bắc Giang", "Phú Thọ", "Điện Biên", "Lai Châu", "Sơn La", "Hòa Bình", "Quảng Ninh", "Bắc Ninh", "Hà Nam", "Hải Dương", "Hưng Yên", "Nam Định", "Ninh Bình", "Thái Bình", "Vĩnh Phúc"]),
        (Central, ["Thanh Hóa", "Nghệ An", "Hà Tĩnh", "Quảng Bình", "Quảng Trị", "Thừa Thiên Huế", "Huế", "Đà Nẵng", "Quảng Nam", "Quảng Ngãi", "Bình Định", "Phú Yên", "Khánh Hòa", "Ninh Thuận", "Bình Thuận"]),
        (Highlands, ["Kon Tum", "Gia Lai", "Đắk Lắk", "Đắk Nông", "Lâm Đồng"]),
        (South, ["Hồ Chí Minh", "TP. Hồ Chí Minh", "TP Hồ Chí Minh", "TP.HCM", "TP HCM", "Sài Gòn", "Bà Rịa", "Bình Dương", "Bình Phước", "Đồng Nai", "Tây Ninh", "Long An", "Tiền Giang", "Bến Tre", "Trà Vinh", "Vĩnh Long", "Đồng Tháp", "An Giang", "Kiên Giang", "Cần Thơ", "Hậu Giang", "Sóc Trăng", "Bạc Liêu", "Cà Mau"]),
    ];

    /// <summary>Nhận nhãn như "Đà Lạt, Lâm Đồng" hoặc "Hà Nội"; so khớp theo tỉnh/thành ở cuối nhãn.</summary>
    public static string? FromGeneralRegion(string? generalRegion)
    {
        if (string.IsNullOrWhiteSpace(generalRegion)) return null;
        var parts = generalRegion.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
        for (var i = parts.Length - 1; i >= 0; i--)
        {
            var p = System.Text.RegularExpressions.Regex.Replace(parts[i], @"(?i)^(tỉnh|thành phố|tp\.?)\s+", "").Trim();
            foreach (var (region, provinces) in Map)
                if (provinces.Any(x => p.Equals(x, StringComparison.OrdinalIgnoreCase) || p.StartsWith(x, StringComparison.OrdinalIgnoreCase)))
                    return region;
        }
        return null;
    }

    /// <summary>
    /// Suy vùng khí hậu từ toạ độ (xấp xỉ theo vĩ độ/kinh độ Việt Nam), dùng khi địa chỉ không nhận diện được tỉnh/thành.
    /// Độ chính xác thấp hơn nhãn địa chỉ ở vùng giáp ranh nên chỉ là phương án dự phòng. Ngoài lãnh thổ Việt Nam trả null.
    /// </summary>
    public static string? FromCoordinates(decimal latitude, decimal longitude)
    {
        if (latitude < 8m || latitude > 23.5m || longitude < 102m || longitude > 110m) return null;
        if (latitude >= 20m) return North;
        if (latitude >= 15m) return Central;
        if (longitude < 107.2m || latitude < 11m) return South;
        return longitude <= 108.6m ? Highlands : Central;
    }

    /// <summary>Ưu tiên nhãn địa chỉ (tỉnh/thành); không nhận diện được thì dùng toạ độ.</summary>
    public static string? Resolve(string? generalRegion, decimal? latitude, decimal? longitude) =>
        FromGeneralRegion(generalRegion)
        ?? (latitude.HasValue && longitude.HasValue ? FromCoordinates(latitude.Value, longitude.Value) : null);

    /// <summary>Tài liệu áp dụng cho vùng? Rỗng = mọi vùng; vùng nông trại chưa biết = không loại tài liệu nào.</summary>
    public static bool Matches(string? documentRegionScope, string? farmRegion)
    {
        if (string.IsNullOrWhiteSpace(documentRegionScope) || string.IsNullOrWhiteSpace(farmRegion)) return true;
        return documentRegionScope
            .Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
            .Any(r => r.Equals(farmRegion, StringComparison.OrdinalIgnoreCase));
    }
}
