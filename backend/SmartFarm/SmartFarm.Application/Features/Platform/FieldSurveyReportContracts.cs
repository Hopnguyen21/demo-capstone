namespace SmartFarm.Application.Features.Platform;

public sealed record CreateFieldSurveyReportCommand(
    Guid FarmId,
    Guid? ServiceRequestId,
    Guid? ZoneId,
    string Title,
    DateTime SurveyDate,
    string? Location,
    string? SurveyorName,
    string? RepresentativeName,
    string? FarmOverview,
    string? CropAndSeasonStatus,
    string? CultivationProcess,
    string? EnvironmentalMonitoring,
    string? EnvironmentalThresholdNeeds,
    string? EquipmentAndDataCollection,
    string? ManagementAndPermissions,
    string? DifficultiesAndNeeds,
    string? TeamAssessment,
    string? Status
);

public sealed record UpdateFieldSurveyReportCommand(
    string Title,
    DateTime SurveyDate,
    string? Location,
    string? SurveyorName,
    string? RepresentativeName,
    string? FarmOverview,
    string? CropAndSeasonStatus,
    string? CultivationProcess,
    string? EnvironmentalMonitoring,
    string? EnvironmentalThresholdNeeds,
    string? EquipmentAndDataCollection,
    string? ManagementAndPermissions,
    string? DifficultiesAndNeeds,
    string? TeamAssessment,
    string? Status
);

public sealed record FieldSurveyReportView(
    Guid Id,
    Guid FarmId,
    string FarmName,
    Guid TenantId,
    Guid? ServiceRequestId,
    string? ServiceRequestTitle,
    Guid? ZoneId,
    string? ZoneName,
    string Title,
    DateTime SurveyDate,
    string Location,
    string SurveyorName,
    string RepresentativeName,
    string FarmOverview,
    string CropAndSeasonStatus,
    string CultivationProcess,
    string EnvironmentalMonitoring,
    string EnvironmentalThresholdNeeds,
    string EquipmentAndDataCollection,
    string ManagementAndPermissions,
    string DifficultiesAndNeeds,
    string TeamAssessment,
    string Status,
    Guid CreatedByUserId,
    string CreatedByUserName,
    DateTime CreatedAtUtc,
    DateTime? UpdatedAtUtc
);

public sealed record FieldSurveyReportFilter(
    Guid? FarmId = null,
    Guid? ServiceRequestId = null,
    Guid? ZoneId = null,
    DateTime? FromDate = null,
    DateTime? ToDate = null,
    string? Status = null,
    string? Search = null
);

public interface IFieldSurveyReportService
{
    Task<IReadOnlyList<FieldSurveyReportView>> GetReportsAsync(Guid userId, FieldSurveyReportFilter filter, CancellationToken ct);
    Task<FieldSurveyReportView> GetReportByIdAsync(Guid userId, Guid reportId, CancellationToken ct);
    Task<FieldSurveyReportView?> GetReportByServiceRequestIdAsync(Guid userId, Guid serviceRequestId, CancellationToken ct);
    Task<FieldSurveyReportView> CreateReportAsync(Guid userId, CreateFieldSurveyReportCommand command, CancellationToken ct);
    Task<FieldSurveyReportView> UpdateReportAsync(Guid userId, Guid reportId, UpdateFieldSurveyReportCommand command, CancellationToken ct);
    Task DeleteReportAsync(Guid userId, Guid reportId, CancellationToken ct);
}
