using SmartFarm.Domain.Enums;

namespace SmartFarm.Application.Features.IoTDeployment;

public sealed record IoTRequirementsView(Guid ZoneId, Guid PlantingSeasonId, Guid GrowthStageId, decimal ZoneAreaM2, IReadOnlyList<EnvironmentalParameterCode> Parameters);
public sealed record DeviceRecommendationView(Guid DeviceModelId, string ModelName, DeviceType DeviceType, decimal CoverageAreaM2, int Quantity, IReadOnlyList<EnvironmentalParameterCode> CoveredParameters);
public sealed record PlanItemInput(Guid DeviceModelId, int Quantity, string? InstallationNotes);
public sealed record PlanItemView(Guid PlanItemId, Guid DeviceModelId, string ModelName, DeviceType DeviceType, int Quantity, string? InstallationNotes);
public sealed record CreateDeploymentRequestCommand(IReadOnlyList<PlanItemInput> Items, string? Notes);
public sealed record SurveyCommand(bool IsFeasible, string SiteConditions, string Notes);
public sealed record ConnectionTestCommand(Guid DeviceId, bool Succeeded, decimal? Rssi, decimal? Snr, int? RoundTripLatencyMs, DateTime ObservedAtUtc, string? ErrorCode, string? ErrorMessage);
public sealed record FailDeploymentCommand(string FailureCode, string Description, Guid? DeviceId);
public sealed record SurveyView(Guid SurveyId, Guid TechnicianUserId, bool IsFeasible, string SiteConditions, string Notes, DateTime SurveyedAtUtc);
public sealed record DecisionView(Guid DecisionId, Guid ActorUserId, string DecisionType, string FromStatus, string ToStatus, string? Notes, DateTime DecidedAtUtc);
public sealed record DeploymentRequestView(Guid RequestId, Guid TenantId, Guid FarmId, Guid ZoneId, Guid PlantingSeasonId, Guid OwnerUserId, Guid? TechnicianUserId, DeploymentRequestStatus Status, IReadOnlyList<EnvironmentalParameterCode> RequiredParameters, string? OwnerNotes, string? FailureCode, string? FailureDescription, IReadOnlyList<PlanItemView> PlanItems, IReadOnlyList<SurveyView> Surveys, IReadOnlyList<DecisionView> DecisionHistory);

public sealed record ProvisionGatewayCommand(Guid DeploymentRequestId, Guid FarmId, string MacAddress, string GatewaySerial, string FrequencyBand, string FirmwareVersion, string MqttClientId, string ClientCertificateFingerprint);
public sealed record GatewayView(Guid GatewayId, Guid FarmId, Guid DeploymentRequestId, string MacAddress, string GatewaySerial, string FrequencyBand, string FirmwareVersion, string MqttClientId, GatewayStatus Status, DateTime? LastSeenAtUtc, int ConnectedNodes);
public sealed record FirmwareCommand(string TargetVersion, string FirmwareUrl, DateTime ScheduledAtUtc);
public sealed record FirmwareJobView(Guid OtaJobId, Guid GatewayId, string TargetVersion, DateTime ScheduledAtUtc, FirmwareJobStatus Status);
public sealed record ProvisionNodeInput(string HardwareAddress, DeviceType DeviceType, Guid? DeviceModelId);
public sealed record ProvisionDevicesCommand(Guid DeploymentRequestId, Guid GatewayId, Guid FarmId, IReadOnlyList<ProvisionNodeInput> Nodes);
public sealed record SensorInput(string SensorType, string? Pin, string? Model, string? Interface, string Unit, decimal? MinValue, decimal? MaxValue, int SamplingIntervalSec);
public sealed record ActuatorInput(string ActuatorType, int RelayChannel, decimal? RatedPowerWatt, int MaxDurationMinutes);
public sealed record AssignDeviceCommand(string? InstallationNotes, decimal? GpsLatitude, decimal? GpsLongitude);
public sealed record UnassignDeviceCommand(string Reason);
public sealed record DeviceConnectionTestView(Guid TestId, bool Succeeded, decimal? Rssi, decimal? Snr, int? RoundTripLatencyMs, DateTime ObservedAtUtc, string? ErrorCode, string? ErrorMessage);
public sealed record DeviceView(Guid DeviceId, Guid FarmId, Guid GatewayId, Guid DeploymentRequestId, Guid? ZoneId, Guid? DeviceModelId, string HardwareAddress, DeviceType DeviceType, DeviceStatus Status, string? InstallationNotes, IReadOnlyList<string> Sensors, IReadOnlyList<string> Actuators, DeviceConnectionTestView? LatestConnectionTest);
public sealed record ProvisionDevicesView(int TotalProvisioned, IReadOnlyList<DeviceView> Devices);
public sealed record DiagnoseCommand(string Action, decimal? NewFrequencyChannel, int? IncreaseTxPowerDbm);
public sealed record DiagnosticJobView(Guid DiagnosticJobId, Guid DeviceId, string Action, DiagnosticJobStatus Status, DateTime CreatedAtUtc);
public sealed record ServiceHandoffView(Guid ServiceRequestId, Guid DeploymentRequestId, ServiceRequestStatus Status);
