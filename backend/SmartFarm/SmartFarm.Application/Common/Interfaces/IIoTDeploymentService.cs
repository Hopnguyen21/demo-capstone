using SmartFarm.Application.Features.IoTDeployment;
using SmartFarm.Domain.Enums;

namespace SmartFarm.Application.Common.Interfaces;

public interface IIoTDeploymentService
{
    Task<IReadOnlyList<DeviceRecommendationView>> ListPlanModelsAsync(Guid technicianId, Guid requestId, CancellationToken ct);
    Task<IoTRequirementsView> GetRequirementsAsync(Guid ownerId, Guid tenantId, Guid zoneId, CancellationToken ct);
    Task<IReadOnlyList<DeviceRecommendationView>> RecommendAsync(Guid ownerId, Guid tenantId, Guid zoneId, CancellationToken ct);
    Task<DeploymentRequestView> CreateRequestAsync(Guid ownerId, Guid tenantId, Guid zoneId, CreateDeploymentRequestCommand command, CancellationToken ct);
    Task<DeploymentRequestView> SubmitWithEstimateAsync(Guid ownerId, Guid tenantId, Guid zoneId, SubmitDeploymentRequestCommand command, CancellationToken ct);
    Task<DeploymentRequestView> UpdateOwnerPlanAsync(Guid ownerId, Guid tenantId, Guid requestId, IReadOnlyList<PlanItemInput> items, CancellationToken ct);
    Task<DeploymentRequestView> SubmitAsync(Guid ownerId, Guid tenantId, Guid requestId, CancellationToken ct);
    Task<DeploymentRequestView> CancelAsync(Guid ownerId, Guid tenantId, Guid requestId, string? reason, CancellationToken ct);
    Task<DeploymentRequestView> GetRequestAsync(Guid userId, Guid? tenantId, Guid requestId, CancellationToken ct);
    Task<IReadOnlyList<DeploymentRequestView>> ListOwnerRequestsAsync(Guid ownerId, Guid tenantId, Guid? zoneId, CancellationToken ct);
    Task<IReadOnlyList<DeploymentRequestView>> ListTechnicianRequestsAsync(Guid technicianId, CancellationToken ct);
    Task<DeploymentRequestView> AcceptAsync(Guid technicianId, Guid requestId, CancellationToken ct);
    Task<DeploymentRequestView> SurveyAsync(Guid technicianId, Guid requestId, SurveyCommand command, CancellationToken ct);
    Task<DeploymentRequestView> UpdateTechnicianPlanAsync(Guid technicianId, Guid requestId, IReadOnlyList<PlanItemInput> items, CancellationToken ct);
    Task<DeploymentRequestView> ConfirmAsync(Guid technicianId, Guid requestId, CancellationToken ct);
    Task<DeploymentRequestView> StartInstallationAsync(Guid technicianId, Guid requestId, CancellationToken ct);
    Task<DeviceConnectionTestView> RecordConnectionTestAsync(Guid technicianId, Guid requestId, ConnectionTestCommand command, CancellationToken ct);
    /// <summary>Hoàn tất lắp đặt; [notes] = ghi chú/biên bản nghiệm thu của KTV (lưu vào lịch sử quyết định, Owner đọc lại trước khi ký).</summary>
    Task<DeploymentRequestView> CompleteAsync(Guid technicianId, Guid requestId, string? notes, CancellationToken ct);
    Task<ServiceHandoffView> FailAsync(Guid technicianId, Guid requestId, FailDeploymentCommand command, CancellationToken ct);
    Task<IReadOnlyList<GatewayView>> ListGatewaysAsync(Guid userId, Guid? tenantId, Guid farmId, CancellationToken ct);
    Task<GatewayView> ProvisionGatewayAsync(Guid technicianId, ProvisionGatewayCommand command, CancellationToken ct);
    Task<GatewayEnrollmentView> VerifyGatewayEnrollmentHandshakeAsync(Guid enrollmentId, GatewayEnrollmentHandshakeCommand command, CancellationToken ct);
    Task<GatewayEnrollmentView> AutoEnrollGatewayAsync(AutoGatewayEnrollmentCommand command, CancellationToken ct);
    Task<GatewayEnrollmentView?> GetGatewayEnrollmentAsync(Guid technicianId, Guid hardwareItemId, CancellationToken ct);
    Task<GatewayRuntimeUpdateView?> GetGatewayRuntimeUpdateAsync(string macAddress, string currentVersion, CancellationToken ct);
    Task<GatewayFirmwareConfigView?> GetGatewayRuntimeConfigAsync(string macAddress, CancellationToken ct);
    Task RecordGatewayOtaResultAsync(GatewayOtaResultCommand command, CancellationToken ct);
    Task<GatewayView> GetGatewayAsync(Guid userId, Guid? tenantId, Guid gatewayId, CancellationToken ct);
    Task<GatewayFirmwareConfigView> GetFirmwareConfigAsync(Guid technicianId, Guid gatewayId, CancellationToken ct);
    Task<GatewayView> ConfigureGatewayAsync(Guid technicianId, Guid gatewayId, GatewayConfigurationCommand command, CancellationToken ct);
    Task<GatewayView> AckGatewayConfigurationAsync(Guid technicianId, Guid gatewayId, int configVersion, CancellationToken ct);
    Task<NodeRegistryPackageView> GetNodeRegistryAsync(Guid gatewayId, CancellationToken ct);
    Task<FirmwareJobView> ScheduleFirmwareAsync(Guid technicianId, Guid gatewayId, FirmwareCommand command, CancellationToken ct);
    Task<FirmwareJobView> RetryFirmwareAsync(Guid technicianId, Guid gatewayId, CancellationToken ct);
    Task<FirmwareJobView?> GetLatestFirmwareJobAsync(Guid userId, Guid gatewayId, CancellationToken ct);
    Task<IReadOnlyList<FirmwareReleaseView>> ListFirmwareReleasesAsync(Guid adminId, CancellationToken ct);
    Task<IReadOnlyList<FirmwareReleaseView>> ListApprovedFirmwareReleasesAsync(CancellationToken ct);
    Task<FirmwareReleaseView> CreateFirmwareReleaseAsync(Guid adminId, CreateFirmwareReleaseCommand command, CancellationToken ct);
    Task<FirmwareReleaseView> SetFirmwareReleaseStatusAsync(Guid adminId, Guid releaseId, FirmwareReleaseStatus status, string? artifactSha256, CancellationToken ct);
    Task<IReadOnlyList<FirmwareReleaseView>> ImportGitHubReleaseAsync(GitHubReleaseWebhookCommand command, CancellationToken ct);
    Task<IReadOnlyList<DeviceView>> ListFarmDevicesAsync(Guid userId, Guid? tenantId, Guid farmId, CancellationToken ct);
    Task<IReadOnlyList<DeviceView>> ListZoneDevicesAsync(Guid ownerId, Guid tenantId, Guid zoneId, CancellationToken ct);
    Task<DeviceView> GetDeviceAsync(Guid userId, Guid? tenantId, Guid deviceId, CancellationToken ct);
    Task<ProvisionDevicesView> ProvisionDevicesAsync(Guid technicianId, ProvisionDevicesCommand command, CancellationToken ct);
    Task<DeviceView> ConfigureSensorsAsync(Guid technicianId, Guid deviceId, IReadOnlyList<SensorInput> sensors, CancellationToken ct);
    Task<DeviceView> ConfigureActuatorsAsync(Guid technicianId, Guid deviceId, IReadOnlyList<ActuatorInput> actuators, CancellationToken ct);
    Task<IReadOnlyList<DeviceComponentView>> ConfigureComponentsAsync(Guid technicianId, Guid deviceId, IReadOnlyList<DeviceComponentInput> components, CancellationToken ct);
    Task<IReadOnlyList<DeviceComponentView>> GetComponentsAsync(Guid technicianId, Guid deviceId, CancellationToken ct);
    Task<DeviceView> AssignAsync(Guid technicianId, Guid zoneId, Guid deviceId, AssignDeviceCommand command, CancellationToken ct);
    Task<DeviceView> UnassignAsync(Guid technicianId, Guid zoneId, Guid deviceId, UnassignDeviceCommand command, CancellationToken ct);
    Task<DeviceConnectionTestView> GetLatestConnectionTestAsync(Guid technicianId, Guid deviceId, CancellationToken ct);
    Task<DiagnosticJobView> DiagnoseAsync(Guid technicianId, Guid deviceId, DiagnoseCommand command, CancellationToken ct);
    Task DecommissionAsync(Guid technicianId, Guid deviceId, CancellationToken ct);
    Task<HardwarePreparationView> StartHardwarePreparationAsync(Guid technicianId, Guid hardwareItemId, CancellationToken ct);
    Task<IReadOnlyList<HardwarePreparationView>> ListHardwarePreparationsAsync(Guid technicianId, CancellationToken ct);
    Task<HardwarePreparationView> AdvanceHardwarePreparationAsync(Guid technicianId, Guid preparationId, HardwarePreparationStatus nextStatus, string? nodeId, int? loraAddress, string? boardProfile, string? notes, CancellationToken ct);
    Task<FirmwareInstallationView> RecordFirmwareInstallationAsync(Guid technicianId, Guid preparationId, Guid firmwareReleaseId, FirmwareUploadMethod uploadMethod, FirmwareInstallationResult result, string? boardProfile, string? bootloaderProfile, string? errorMessage, string? notes, CancellationToken ct);
    Task<IReadOnlyList<FirmwareInstallationView>> ListFirmwareInstallationsAsync(Guid technicianId, Guid preparationId, CancellationToken ct);
    Task<HardwarePreparationView> RecordHardwareConnectivityCheckAsync(Guid technicianId, Guid preparationId, HardwareConnectivityCheckCommand command, CancellationToken ct);
    Task<GatewayEnrollmentView> EnrollGatewayAsync(Guid technicianId, GatewayEnrollmentCommand command, CancellationToken ct);
    /// <summary>Chỉ khi SimulatedIot:Enabled: dựng Gateway mô phỏng trong kho KTV rồi tự đăng ký + kích hoạt cho yêu cầu (không có phần cứng thật).</summary>
    Task<GatewayEnrollmentView> SimulateGatewayAsync(Guid technicianId, SimulateGatewayCommand command, CancellationToken ct);
    Task<GatewayEnrollmentView> ActivateGatewayEnrollmentAsync(Guid technicianId, Guid enrollmentId, ActivateGatewayEnrollmentCommand command, CancellationToken ct);
}
