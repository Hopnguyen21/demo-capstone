using System.Globalization;
using Microsoft.EntityFrameworkCore;
using SmartFarm.Domain.Entities;
using SmartFarm.Infrastructure.Persistence;

namespace SmartFarm.Infrastructure.Platform;

/// <summary>
/// Tham số nghiệp vụ lưu trong bảng platform_settings, Admin đổi được trên màn hình cấu hình và có hiệu lực ở lần đọc kế tiếp
/// (không cần restart). Giá trị mặc định chỉ dùng khi dòng cấu hình chưa có hoặc không hợp lệ.
/// </summary>
public static class PlatformSettingKeys
{
    public const string RainGuardThresholdPercent = "control.rain_guard_threshold_percent";
    public const string DepositPercent = "contract.deposit_percent";
    public const string RepeatPurchaseDiscountPercent = "contract.repeat_purchase_discount_percent";
    public const string RenewalDiscountPercent = "contract.renewal_discount_percent";
    public const string AiMinimumConfidence = "ai.minimum_confidence";
    public const string AiTelemetryFreshnessMinutes = "ai.telemetry_freshness_minutes";
}

public sealed record PlatformSettingDefinition(string Key, decimal Default, decimal Min, decimal Max, string Group, string DataType, string Description);

public static class PlatformSettingsStore
{
    public static readonly IReadOnlyList<PlatformSettingDefinition> Definitions =
    [
        new(PlatformSettingKeys.RainGuardThresholdPercent, 70m, 0m, 100m, "Control", "Decimal",
            "Xác suất mưa (%) từ mức này trở lên thì chặn lệnh bật bơm thủ công và gán làm mặc định cho lịch tưới tự tạo."),
        new(PlatformSettingKeys.DepositPercent, 30m, 1m, 100m, "Contract", "Decimal",
            "Tỷ lệ tạm ứng (%) trên tổng giá trị báo giá/hợp đồng khi ký hợp đồng."),
        new(PlatformSettingKeys.RepeatPurchaseDiscountPercent, 15m, 0m, 100m, "Contract", "Decimal",
            "Giảm giá (%) khi cùng Zone mua lại trong 2 tháng."),
        new(PlatformSettingKeys.RenewalDiscountPercent, 10m, 0m, 100m, "Contract", "Decimal",
            "Giảm giá (%) khi gia hạn từ hợp đồng gốc."),
        new(PlatformSettingKeys.AiMinimumConfidence, 0.70m, 0m, 1m, "Ai", "Decimal",
            "Độ tin cậy tối thiểu (0–1) để đề xuất của AI được coi là Ready và có thể chấp nhận."),
        new(PlatformSettingKeys.AiTelemetryFreshnessMinutes, 5m, 1m, 1440m, "Ai", "Integer",
            "Số phút tối đa kể từ lần đo cuối để số liệu cảm biến còn được coi là mới."),
    ];

    public static PlatformSettingDefinition? Find(string key) => Definitions.FirstOrDefault(x => x.Key == key);

    /// <summary>Đọc một tham số; thiếu hoặc ngoài khoảng cho phép thì dùng giá trị dự phòng (nếu có) hoặc mặc định.</summary>
    public static async Task<decimal> GetDecimalAsync(SmartFarmDbContext db, string key, CancellationToken ct, decimal? fallback = null)
    {
        var def = Find(key) ?? throw new ArgumentException($"Unknown platform setting '{key}'.", nameof(key));
        var raw = await db.PlatformSettings.AsNoTracking().Where(x => x.Key == key).Select(x => x.Value).SingleOrDefaultAsync(ct);
        return TryParse(def, raw, out var value) ? value : fallback ?? def.Default;
    }

    public static bool TryParse(PlatformSettingDefinition def, string? raw, out decimal value)
    {
        value = def.Default;
        if (!decimal.TryParse(raw?.Trim(), NumberStyles.Number, CultureInfo.InvariantCulture, out var parsed)) return false;
        if (parsed < def.Min || parsed > def.Max) return false;
        if (def.DataType == "Integer" && parsed != decimal.Truncate(parsed)) return false;
        value = parsed;
        return true;
    }

    /// <summary>Tạo các dòng cấu hình còn thiếu để Admin nhìn thấy và sửa được. Idempotent.</summary>
    public static async Task EnsureDefaultsAsync(SmartFarmDbContext db, CancellationToken ct)
    {
        var existing = await db.PlatformSettings.Select(x => x.Key).ToListAsync(ct);
        var added = false;
        foreach (var def in Definitions.Where(d => !existing.Contains(d.Key)))
        {
            db.PlatformSettings.Add(new PlatformSetting
            {
                Key = def.Key, Value = def.Default.ToString(CultureInfo.InvariantCulture), Group = def.Group,
                DataType = def.DataType, Description = def.Description, UpdatedAtUtc = DateTime.UtcNow
            });
            added = true;
        }
        if (added) await db.SaveChangesAsync(ct);
    }
}
