using SmartFarm.Domain.Common;

namespace SmartFarm.Domain.Entities;

/// <summary>
/// Phiếu báo cáo khảo sát thực địa tại trang trại do Kỹ thuật viên (Technician) thực hiện trước khi lập Báo giá & Hợp đồng.
/// </summary>
public sealed class FieldSurveyReport : AuditableEntity
{
    public Guid FarmId { get; set; }
    public Farm Farm { get; set; } = null!;

    public Guid TenantId { get; set; }
    public Tenant Tenant { get; set; } = null!;

    public Guid? ServiceRequestId { get; set; }
    public ServiceRequest? ServiceRequest { get; set; }

    public Guid? ZoneId { get; set; }
    public Zone? Zone { get; set; }

    public string Title { get; set; } = string.Empty;
    public DateTime SurveyDate { get; set; } = DateTime.UtcNow;
    public string Location { get; set; } = string.Empty;
    public string SurveyorName { get; set; } = string.Empty;
    public string RepresentativeName { get; set; } = string.Empty;

    // 10 mục nội dung khảo sát chi tiết
    public string FarmOverview { get; set; } = string.Empty;
    public string CropAndSeasonStatus { get; set; } = string.Empty;
    public string CultivationProcess { get; set; } = string.Empty;
    public string EnvironmentalMonitoring { get; set; } = string.Empty;
    public string EnvironmentalThresholdNeeds { get; set; } = string.Empty;
    public string EquipmentAndDataCollection { get; set; } = string.Empty;
    public string ManagementAndPermissions { get; set; } = string.Empty;
    public string DifficultiesAndNeeds { get; set; } = string.Empty;
    public string TeamAssessment { get; set; } = string.Empty;

    public string Status { get; set; } = "Submitted"; // Draft | Submitted | Approved

    public Guid CreatedByUserId { get; set; }
    public AppUser CreatedByUser { get; set; } = null!;
}
