namespace SmartFarm.Infrastructure.Ai;

/// <summary>
/// Bộ kiểm tra độ mới và tính hợp lệ của dữ liệu cảm biến vi khí hậu:
/// - Đối chiếu timestamp UTC thực tế với thời điểm hiện tại UTC và ngưỡng cấu hình.
/// - Chặn dữ liệu quá hạn (stale telemetry).
/// - Chặn dữ liệu có timestamp trong tương lai hoặc sai lệch múi giờ (clock skew > 15 giây).
/// </summary>
public static class TelemetryFreshnessValidator
{
    public const int DefaultFreshnessMinutes = 5;
    public const int MaxClockSkewSeconds = 15;

    public static bool IsFresh(DateTime capturedAtUtc, DateTime nowUtc, int freshnessMinutes)
    {
        if (freshnessMinutes <= 0) freshnessMinutes = DefaultFreshnessMinutes;
        // Chặn timestamp trong tương lai hoặc sai lệch múi giờ
        if (capturedAtUtc > nowUtc.AddSeconds(MaxClockSkewSeconds))
            return false;
        // Chặn số đo quá hạn
        var cutoff = nowUtc.AddMinutes(-freshnessMinutes);
        return capturedAtUtc >= cutoff;
    }
}

