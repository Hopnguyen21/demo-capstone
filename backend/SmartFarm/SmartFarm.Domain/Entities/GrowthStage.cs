using SmartFarm.Domain.Common;

namespace SmartFarm.Domain.Entities;

public sealed class GrowthStage : AuditableEntity
{
    public Guid GrowthProfileId { get; set; }
    public GrowthProfile GrowthProfile { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public int StageOrder { get; set; }
    public int DurationDays { get; set; }
    public string? Description { get; set; }
    public string? FertilizerAction { get; set; }
    public string? IpmAction { get; set; }
    public ICollection<EnvironmentalRequirement> Requirements { get; } = new List<EnvironmentalRequirement>();

    /// <summary>Các ca tưới của giai đoạn (lịch tưới thuộc Growth Profile). Mọi ngày trong giai đoạn dùng chung các ca này.</summary>
    public ICollection<GrowthStageIrrigationSession> IrrigationSessions { get; } = new List<GrowthStageIrrigationSession>();
}
