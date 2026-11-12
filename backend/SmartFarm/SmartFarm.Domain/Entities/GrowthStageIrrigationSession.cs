using SmartFarm.Domain.Common;

namespace SmartFarm.Domain.Entities;

/// <summary>
/// Một ca tưới của một giai đoạn trong Growth Profile. Lặp HẰNG NGÀY trong suốt giai đoạn (bộ điều khiển chỉ hỗ trợ lịch hằng ngày).
/// Giờ là giờ ĐỊA PHƯƠNG theo múi giờ của Farm (cùng quy ước với cron của ControlSchedule). Đây là lịch khuyến nghị của profile;
/// lịch điều khiển thực tế của thiết bị là ControlSchedule, được sinh ra khi đồng bộ.
/// </summary>
public sealed class GrowthStageIrrigationSession : AuditableEntity
{
    public Guid GrowthStageId { get; set; }
    public GrowthStage GrowthStage { get; set; } = null!;

    /// <summary>Thứ tự hiển thị trong ngày.</summary>
    public int SortOrder { get; set; }
    public string Title { get; set; } = string.Empty;

    /// <summary>Giờ bắt đầu (địa phương theo múi giờ Farm), không có ngày.</summary>
    public TimeOnly StartTime { get; set; }

    /// <summary>Thời lượng một lần tưới, đơn vị GIÂY, 1..1800 (giới hạn phần cứng 30 phút).</summary>
    public int DurationSeconds { get; set; }
    public bool Enabled { get; set; } = true;

    /// <summary>Phương thức tưới (nhỏ giọt, phun sương...). Chỉ để hiển thị, bộ điều khiển không dùng.</summary>
    public string? Method { get; set; }

    /// <summary>Lượng nước dự kiến cho mỗi gốc, đơn vị ml. Chỉ để tham khảo, bộ điều khiển không dùng.</summary>
    public int? WaterPerPlantMl { get; set; }
}
