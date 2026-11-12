using SmartFarm.Domain.Common;

namespace SmartFarm.Domain.Entities;

/// <summary>
/// Lịch tưới TÙY CHỈNH THEO NGÀY của một vụ trồng (Zone + mùa vụ). Chỉ lưu các ngày bị người dùng sửa ("override");
/// ngày không có override dùng lịch theo giai đoạn của Growth Profile (lịch mẫu/đề xuất, độc lập, không bị sửa ở đây).
/// Các ngày khóa theo SỐ NGÀY CANH TÁC (1 = ngày bắt đầu vụ). Ba trường "Snapshot" ghi lại trạng thái vụ lúc lưu gần nhất
/// để phát hiện vụ đã đổi ngày bắt đầu/số ngày/profile sau đó (báo "Stale", không tự xóa dữ liệu).
/// </summary>
public sealed class SeasonIrrigationPlan : AuditableEntity
{
    public Guid PlantingSeasonId { get; set; }
    public PlantingSeason PlantingSeason { get; set; } = null!;
    public DateOnly StartDateSnapshot { get; set; }
    public int TotalDaysSnapshot { get; set; }
    public Guid GrowthProfileIdSnapshot { get; set; }
    public Guid UpdatedByUserId { get; set; }
    public ICollection<SeasonIrrigationDay> Days { get; } = new List<SeasonIrrigationDay>();
}

/// <summary>Một ngày có override. Danh sách ca rỗng nghĩa là "ngày này cố ý không tưới".</summary>
public sealed class SeasonIrrigationDay : AuditableEntity
{
    public Guid SeasonIrrigationPlanId { get; set; }
    public SeasonIrrigationPlan Plan { get; set; } = null!;
    public int DayNumber { get; set; }
    public ICollection<SeasonIrrigationSession> Sessions { get; } = new List<SeasonIrrigationSession>();
}

/// <summary>Ca tưới của một ngày override. Cùng quy ước với GrowthStageIrrigationSession (giờ địa phương theo múi giờ Farm, 1..1800 giây).</summary>
public sealed class SeasonIrrigationSession : AuditableEntity
{
    public Guid SeasonIrrigationDayId { get; set; }
    public SeasonIrrigationDay Day { get; set; } = null!;
    public int SortOrder { get; set; }
    public string Title { get; set; } = string.Empty;
    public TimeOnly StartTime { get; set; }
    public int DurationSeconds { get; set; }
    public bool Enabled { get; set; } = true;
    public string? Method { get; set; }
    public int? WaterPerPlantMl { get; set; }
}
