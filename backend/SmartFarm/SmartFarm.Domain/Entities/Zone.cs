using SmartFarm.Domain.Common;
using SmartFarm.Domain.Enums;

namespace SmartFarm.Domain.Entities;

public sealed class Zone : AuditableEntity
{
    public Guid FieldId { get; set; }
    public Field Field { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public decimal AreaM2 { get; set; }
    public string ZoneType { get; set; } = string.Empty;
    public string? BoundaryGeoJson { get; set; }
    public string? Notes { get; set; }
    public ZoneStatus Status { get; set; } = ZoneStatus.Inactive;
    public DateTime? ArchivedAtUtc { get; set; }
    /// <summary>Cây đang trồng hiện tại của Zone. Độc lập với vụ mùa; null nghĩa là Zone chưa được gán cây.</summary>
    public Guid? CropId { get; set; }
    public Crop? Crop { get; set; }
    public Guid? CropVarietyId { get; set; }
    public CropVariety? Variety { get; set; }

    /// <summary>
    /// Hồ sơ canh tác đang áp dụng trực tiếp cho Zone (hệ thống hoặc bản sao của Tenant). Độc lập với PlantingSeason: chọn/đổi
    /// hồ sơ không tạo vụ mùa, và vụ mùa vẫn giữ GrowthProfileId riêng của nó (dữ liệu lịch sử không đổi). Null = Zone chưa gắn hồ sơ.
    /// Khi có hồ sơ thì CropId/CropVarietyId của Zone phải trùng cây/giống của hồ sơ.
    /// </summary>
    public Guid? GrowthProfileId { get; set; }
    public GrowthProfile? GrowthProfile { get; set; }

    public ICollection<UserZoneAccess> UserAccesses { get; } = new List<UserZoneAccess>();
    public ICollection<PlantingSeason> PlantingSeasons { get; } = new List<PlantingSeason>();
}
