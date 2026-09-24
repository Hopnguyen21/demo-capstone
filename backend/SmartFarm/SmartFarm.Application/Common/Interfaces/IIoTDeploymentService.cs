using SmartFarm.Application.Features.IoTDeployment;

namespace SmartFarm.Application.Common.Interfaces;

public interface IIoTDeploymentService
{
    Task<IoTRequirementsView> GetRequirementsAsync(Guid ownerId, Guid tenantId, Guid zoneId, CancellationToken ct);
    Task<IReadOnlyList<DeviceRecommendationView>> RecommendAsync(Guid ownerId, Guid tenantId, Guid zoneId, CancellationToken ct);
    Task<DeploymentRequestView> CreateRequestAsync(Guid ownerId, Guid tenantId, Guid zoneId, CreateDeploymentRequestCommand command, CancellationToken ct);
    Task<DeploymentRequestView> UpdateOwnerPlanAsync(Guid ownerId, Guid tenantId, Guid requestId, IReadOnlyList<PlanItemInput> items, CancellationToken ct);
    Task<DeploymentRequestView> SubmitAsync(Guid ownerId, Guid tenantId, Guid requestId, CancellationToken ct);
    Task<DeploymentRequestView> GetRequestAsync(Guid userId, Guid? tenantId, Guid requestId, CancellationToken ct);
    Task<IReadOnlyList<DeploymentRequestView>> ListTechnicianRequestsAsync(Guid technicianId, CancellationToken ct);
    Task<DeploymentRequestView> AcceptAsync(Guid technicianId, Guid requestId, CancellationToken ct);
    Task<DeploymentRequestView> SurveyAsync(Guid technicianId, Guid requestId, SurveyCommand command, CancellationToken ct);
    Task<DeploymentRequestView> UpdateTechnicianPlanAsync(Guid technicianId, Guid requestId, IReadOnlyList<PlanItemInput> items, CancellationToken ct);
    Task<DeploymentRequestView> ConfirmAsync(Guid technicianId, Guid requestId, CancellationToken ct);
    Task<DeploymentRequestView> StartInstallationAsync(Guid technicianId, Guid requestId, CancellationToken ct);
    Task<DeviceConnectionTestView> RecordConnectionTestAsync(Guid technicianId, Guid requestId, ConnectionTestCommand command, CancellationToken ct);
    Task<DeploymentRequestView> CompleteAsync(Guid technicianId, Guid requestId, CancellationToken ct);
    Task<ServiceHandoffView> FailAsync(Guid technicianId, Guid requestId, FailDeploymentCommand command, CancellationToken ct);
    Task<IReadOnlyList<GatewayView>> ListGatewaysAsync(Guid userId, Guid? tenantId, Guid farmId, CancellationToken ct);
    Task<GatewayView> ProvisionGatewayAsync(Guid technicianId, ProvisionGatewayCommand command, CancellationToken ct);
    Task<GatewayView> GetGatewayAsync(Guid userId, Guid? tenantId, Guid gatewayId, CancellationToken ct);
    Task<FirmwareJobView> ScheduleFirmwareAsync(Guid technicianId, Guid gatewayId, FirmwareCommand command, CancellationToken ct);
    Task<IReadOnlyList<DeviceView>> ListFarmDevicesAsync(Guid userId, Guid? tenantId, Guid farmId, CancellationToken ct);
    Task<IReadOnlyList<DeviceView>> ListZoneDevicesAsync(Guid ownerId, Guid tenantId, Guid zoneId, CancellationToken ct);
    Task<DeviceView> GetDeviceAsync(Guid userId, Guid? tenantId, Guid deviceId, CancellationToken ct);
    Task<ProvisionDevicesView> ProvisionDevicesAsync(Guid technicianId, ProvisionDevicesCommand command, CancellationToken ct);
    Task<DeviceView> ConfigureSensorsAsync(Guid technicianId, Guid deviceId, IReadOnlyList<SensorInput> sensors, CancellationToken ct);
    Task<DeviceView> ConfigureActuatorsAsync(Guid technicianId, Guid deviceId, IReadOnlyList<ActuatorInput> actuators, CancellationToken ct);
    Task<DeviceView> AssignAsync(Guid technicianId, Guid zoneId, Guid deviceId, AssignDeviceCommand command, CancellationToken ct);
    Task<DeviceView> UnassignAsync(Guid technicianId, Guid zoneId, Guid deviceId, UnassignDeviceCommand command, CancellationToken ct);
    Task<DeviceConnectionTestView> GetLatestConnectionTestAsync(Guid technicianId, Guid deviceId, CancellationToken ct);
    Task<DiagnosticJobView> DiagnoseAsync(Guid technicianId, Guid deviceId, DiagnoseCommand command, CancellationToken ct);
    Task DecommissionAsync(Guid technicianId, Guid deviceId, CancellationToken ct);
}
