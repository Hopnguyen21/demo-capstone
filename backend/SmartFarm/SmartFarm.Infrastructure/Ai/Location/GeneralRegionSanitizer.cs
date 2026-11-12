using System.Text.RegularExpressions;

namespace SmartFarm.Infrastructure.Ai.Location;

/// <summary>
/// Trích xuất nhãn khu vực tổng quát (Province / District) từ địa chỉ đầy đủ của Farm.
/// Xác thực dựa trên danh mục đơn vị hành chính chính thức (63 tỉnh/thành phố và quận/huyện) của Việt Nam.
/// Nếu không chắc chắn nhãn nào là cấp hành chính tổng quát hợp lệ, trả null thay vì gửi chuỗi chưa xác minh cho AI.
/// </summary>
public static class GeneralRegionSanitizer
{
    private static readonly Regex SpecificStreetPattern = new(
        @"(?i)(số\s*\d+|ngõ\s*\d+|ngách\s*\d+|hẻm\s*\d+|thôn\s*[^,]+|ấp\s*[^,]+|xóm\s*[^,]+|tổ\s*\d+[^,]*|đường\s*[^,]+|khu\s*phố\s*[^,]+)",
        RegexOptions.Compiled);

    private static readonly Regex LeadingNumberPattern = new(
        @"^\d+([A-Za-z]?\b)?",
        RegexOptions.Compiled);

    // Danh mục 63 tỉnh/thành phố trực thuộc Trung ương của Việt Nam
    private static readonly string[] RecognizedProvinces =
    [
        "Hà Nội", "Hồ Chí Minh", "TP. Hồ Chí Minh", "TP Hồ Chí Minh", "TP.HCM", "TP HCM", "Sài Gòn",
        "Hải Phòng", "Đà Nẵng", "Cần Thơ", "An Giang", "Bà Rịa - Vũng Tàu", "Bà Rịa Vũng Tàu",
        "Bắc Giang", "Bắc Kạn", "Bạc Liêu", "Bắc Ninh", "Bến Tre", "Bình Định", "Bình Dương",
        "Bình Phước", "Bình Thuận", "Cà Mau", "Cao Bằng", "Đắk Lắk", "Đắk Nông", "Điện Biên",
        "Đồng Nai", "Đồng Tháp", "Gia Lai", "Hà Giang", "Hà Nam", "Hà Tĩnh", "Hải Dương",
        "Hậu Giang", "Hòa Bình", "Hưng Yên", "Khánh Hòa", "Kiên Giang", "Kon Tum", "Lai Châu",
        "Lâm Đồng", "Lạng Sơn", "Lào Cai", "Long An", "Nam Định", "Nghệ An", "Ninh Bình",
        "Ninh Thuận", "Phú Thọ", "Phú Yên", "Quảng Bình", "Quảng Nam", "Quảng Ngãi", "Quảng Ninh",
        "Quảng Trị", "Sóc Trăng", "Sơn La", "Tây Ninh", "Thái Bình", "Thái Nguyên", "Thanh Hóa",
        "Thừa Thiên Huế", "Huế", "Tiền Giang", "Trà Vinh", "Tuyên Quang", "Vĩnh Long", "Vĩnh Phúc", "Yên Bái"
    ];

    private static readonly Regex DistrictPrefixPattern = new(
        @"(?i)\b(quận|huyện|thị xã|thành phố|tp\.?|tx\.?)\b",
        RegexOptions.Compiled);

    /// <summary>
    /// Làm sạch địa chỉ, chỉ giữ lại đơn vị hành chính cấp tỉnh/thành hoặc quận/huyện + tỉnh/thành.
    /// Trả về null nếu không xác định được cấp hành chính tổng quát.
    /// </summary>
    public static string? Sanitize(string? locationText)
    {
        if (string.IsNullOrWhiteSpace(locationText)) return null;

        // Tách chuỗi theo dấu phẩy
        var parts = locationText
            .Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
            .Where(p => !SpecificStreetPattern.IsMatch(p) && !LeadingNumberPattern.IsMatch(p))
            .ToList();

        if (parts.Count == 0) return null;

        // 1. Tìm phần tử khớp với Tỉnh/Thành phố trong danh mục chính thức
        int provinceIndex = -1;
        string? matchedProvince = null;

        for (int i = parts.Count - 1; i >= 0; i--)
        {
            var cleanPart = CleanAdministrativeTerm(parts[i]);
            var matched = RecognizedProvinces.FirstOrDefault(p =>
                cleanPart.Equals(p, StringComparison.OrdinalIgnoreCase) ||
                cleanPart.EndsWith(p, StringComparison.OrdinalIgnoreCase));

            if (matched != null)
            {
                provinceIndex = i;
                matchedProvince = parts[i]; // Giữ nguyên cách viết của part gốc
                break;
            }
        }

        // Nếu không nhận diện được Tỉnh/Thành phố nào trong danh mục -> Không an toàn, trả về null
        if (provinceIndex < 0 || matchedProvince == null)
        {
            return null;
        }

        // 2. Nếu có phần tử đứng trước Tỉnh/Thành, kiểm tra xem có phải Quận/Huyện/Thị xã/Thành phố thuộc tỉnh không
        if (provinceIndex > 0)
        {
            var precedingPart = parts[provinceIndex - 1];
            // Nếu có tiền tố hành chính (Quận, Huyện, Thị xã, Thành phố) hoặc tên địa danh cấp huyện phổ biến
            // Chỉ giữ cấp quận/huyện khi có tiền tố hành chính rõ ràng; tên địa danh trần không được coi là an toàn.
            if (DistrictPrefixPattern.IsMatch(precedingPart))
            {
                return $"{precedingPart}, {matchedProvince}";
            }
        }

        return matchedProvince;
    }

    private static string CleanAdministrativeTerm(string input)
    {
        return Regex.Replace(input, @"(?i)^(tỉnh|thành phố|tp\.?)\s+", "").Trim();
    }

    /// <summary>
    /// Chuyển tiếp tới AiPrivacySanitizer để đảm bảo tính đồng nhất.
    /// </summary>
    public static string SanitizeUserQuestion(string? question) =>
        AiPrivacySanitizer.SanitizeUserQuestion(question);
}
