using System.Text.RegularExpressions;
using SmartFarm.Application.Common.Exceptions;

namespace SmartFarm.Infrastructure.Ai.Knowledge;

/// <summary>
/// Trình phân tích cú pháp và tự động tăng phiên bản (Version Bumping) cho tài liệu VietGAP/tiêu chuẩn nông nghiệp.
/// Xử lý chuẩn xác các định dạng được hỗ trợ: "1", "1.2", "1.2.3", "V1.0", "v2", "Version 3.9".
/// Từ chối các định dạng sai như "1.2garbage", số âm, chuỗi rỗng, hoặc số quá lớn.
/// </summary>
public static class VersionParser
{
    private const int MaxVersionLength = 30;
    private const int MaxSegmentValue = 999_999;

    // Chỉ chấp nhận: prefix tùy chọn (v/ver/version), theo sau là 1 đến 3 cụm số phân tách bằng dấu chấm.
    // Kết thúc chuỗi nghiêm ngặt ($), không chấp nhận ký tự thừa phía sau (như 1.2garbage).
    private static readonly Regex StrictVersionRegex = new(
        @"^(?:v|ver|version)?\s*(\d+)(?:\.(\d+))?(?:\.(\d+))?$",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    /// <summary>
    /// Kiểm tra tính hợp lệ của phiên bản do người dùng nhập.
    /// Giới hạn tối đa 30 ký tự, tuân thủ đúng định dạng (1, 1.2, 1.2.3, V1.2, Version 1.2) và giá trị số hợp lý.
    /// </summary>
    public static bool IsValidUserVersion(string? version)
    {
        if (string.IsNullOrWhiteSpace(version)) return false;
        var trimmed = version.Trim();
        if (trimmed.Length > MaxVersionLength) return false;

        var match = StrictVersionRegex.Match(trimmed);
        if (!match.Success) return false;

        // Xác minh từng cụm số không bị tràn hoặc vượt giới hạn hợp lý
        if (!int.TryParse(match.Groups[1].Value, out var major) || major < 0 || major > MaxSegmentValue)
            return false;

        if (match.Groups[2].Success && (!int.TryParse(match.Groups[2].Value, out var minor) || minor < 0 || minor > MaxSegmentValue))
            return false;

        if (match.Groups[3].Success && (!int.TryParse(match.Groups[3].Value, out var patch) || patch < 0 || patch > MaxSegmentValue))
            return false;

        return true;
    }

    /// <summary>
    /// Chuẩn hóa phiên bản người dùng nhập nếu có, hoặc tự động bump lên phiên bản minor kế tiếp.
    /// </summary>
    public static string NormalizeOrBump(string? currentVersion, string? requestedVersion = null)
    {
        if (!string.IsNullOrWhiteSpace(requestedVersion))
        {
            var trimmed = requestedVersion.Trim();
            if (trimmed.Length > MaxVersionLength)
            {
                throw new RequestValidationException("version", $"Mã phiên bản không được vượt quá {MaxVersionLength} ký tự.");
            }
            if (!IsValidUserVersion(trimmed))
            {
                throw new RequestValidationException("version", $"Mã phiên bản '{trimmed}' không đúng định dạng hợp lệ (chỉ chấp nhận: 1, 1.2, 1.2.3, V1.0, Version 2.0).");
            }

            var m = StrictVersionRegex.Match(trimmed);
            var maj = int.Parse(m.Groups[1].Value);
            var min = m.Groups[2].Success ? int.Parse(m.Groups[2].Value) : 0;
            if (m.Groups[3].Success)
            {
                var patch = int.Parse(m.Groups[3].Value);
                return $"V{maj}.{min}.{patch}";
            }

            return $"V{maj}.{min}";
        }

        return BumpMinor(currentVersion);
    }

    /// <summary>
    /// Tăng phiên bản Minor kế tiếp:
    /// - "V1.0" -> "V1.1"
    /// - "1.0" -> "V1.1"
    /// - "v2" -> "V2.1"
    /// - "Version 3.9" -> "V3.10"
    /// - "1.2.3" -> "V1.2.4"
    /// - "" hoặc null -> "V1.1"
    /// </summary>
    public static string BumpMinor(string? currentVersion)
    {
        if (string.IsNullOrWhiteSpace(currentVersion))
        {
            return "V1.1";
        }

        var trimmed = currentVersion.Trim();
        var match = StrictVersionRegex.Match(trimmed);
        if (match.Success && int.TryParse(match.Groups[1].Value, out var major) && major >= 0 && major <= MaxSegmentValue)
        {
            var minor = match.Groups[2].Success && int.TryParse(match.Groups[2].Value, out var min) && min >= 0 && min <= MaxSegmentValue
                ? min
                : 0;

            if (match.Groups[3].Success && int.TryParse(match.Groups[3].Value, out var patch) && patch >= 0 && patch <= MaxSegmentValue)
            {
                var nextPatch = patch < MaxSegmentValue ? patch + 1 : patch;
                return $"V{major}.{minor}.{nextPatch}";
            }

            var nextMinor = minor < MaxSegmentValue ? minor + 1 : minor;
            return $"V{major}.{nextMinor}";
        }

        return "V1.1";
    }

    /// <summary>
    /// Tăng phiên bản Major kế tiếp:
    /// - "V1.0" -> "V2.0"
    /// - "1.5" -> "V2.0"
    /// - "Version 3.9" -> "V4.0"
    /// </summary>
    public static string BumpMajor(string? currentVersion)
    {
        if (string.IsNullOrWhiteSpace(currentVersion))
        {
            return "V2.0";
        }

        var trimmed = currentVersion.Trim();
        var match = StrictVersionRegex.Match(trimmed);
        if (match.Success && int.TryParse(match.Groups[1].Value, out var major) && major >= 0 && major <= MaxSegmentValue)
        {
            var nextMajor = major < MaxSegmentValue ? major + 1 : major;
            return $"V{nextMajor}.0";
        }

        return "V2.0";
    }
}
