using SmartFarm.Application.Features.Platform;
using SmartFarm.Domain.Enums;

namespace SmartFarm.Application.Features.IoTDeployment;

public sealed record IoTRequirementsView(Guid ZoneId, Guid PlantingSeasonId, Guid GrowthStageId, decimal ZoneAreaM2, IReadOnlyList<EnvironmentalParameterCode> Parameters);
public sealed record DeviceRecommendationView(Guid DeviceModelId, string ModelName, DeviceType DeviceType, decimal CoverageAreaM2, int Quantity, IReadOnlyList<EnvironmentalParameterCode> CoveredParameters);
public sealed record PlanItemInput(Guid DeviceModelId, int Quantity, string? InstallationNotes);
/// <summary>Ngữ cảnh của yêu cầu: farm, thửa đất, Zone, cây và vụ mùa mà yêu cầu thuộc về, để người nhận (Owner, kỹ thuật viên) biết lắp đặt ở đâu, không chỉ thấy mã.</summary>
public sealed record DeploymentContextView(string FarmName, string? FarmLocation, string FieldName, string? SoilType, string ZoneName, string ZoneType, decimal ZoneAreaM2, string? CropName, string? VarietyName, string SeasonName, string SeasonStatus, DateOnly SeasonStartDate, DateOnly SeasonExpectedEndDate);
public sealed record EstimateItemView(Guid EstimateItemId, Guid? HardwareItemId, string Code, string Name, string? Model, string Role, int Quantity, decimal UnitPrice, decimal LineTotal, string? Notes);
public sealed record PlanItemView(Guid PlanItemId, Guid DeviceModelId, string ModelName, DeviceType DeviceType, int Quantity, string? InstallationNotes);
/// <summary>Gửi yêu cầu triển khai trực tiếp cho Zone đã có: thông số cần đo do server suy ra từ vụ đang canh tác; Owner gửi ghi chú và dòng dự toán (tuỳ chọn).</summary>
public sealed record SubmitDeploymentRequestCommand(string? OwnerNotes, IReadOnlyList<FarmWizardEstimateItemInput>? EstimateItems);
public sealed record CreateDeploymentRequestCommand(IReadOnlyList<PlanItemInput> Items, string? Notes);
public sealed record SurveyCommand(bool IsFeasible, string SiteConditions, string Notes);
public sealed record ConnectionTestCommand(Guid DeviceId, bool Succeeded, decimal? Rssi, decimal? Snr, int? RoundTripLatencyMs, DateTime ObservedAtUtc, string? ErrorCode, string? ErrorMessage);
public sealed record FailDeploymentCommand(string FailureCode, string Description, Guid? DeviceId);
public sealed record SurveyView(Guid SurveyId, Guid TechnicianUserId, bool IsFeasible, string SiteConditions, string Notes, DateTime SurveyedAtUtc);
public sealed record DecisionView(Guid DecisionId, Guid ActorUserId, string DecisionType, string FromStatus, string ToStatus, string? Notes, DateTime DecidedAtUtc);
public sealed record DeploymentRequestView(Guid RequestId, Guid TenantId, Guid FarmId, Guid ZoneId, Guid PlantingSeasonId, Guid OwnerUserId, Guid? TechnicianUserId, DeploymentRequestStatus Status, IReadOnlyList<EnvironmentalParameterCode> RequiredParameters, string? OwnerNotes, string? FailureCode, string? FailureDescription, IReadOnlyList<PlanItemView> PlanItems, IReadOnlyList<SurveyView> Surveys, IReadOnlyList<DecisionView> DecisionHistory, IReadOnlyList<EstimateItemView>? EstimateItems = null, DeploymentContextView? Context = null);

public sealed record ProvisionGatewayCommand(Guid DeploymentRequestId, Guid FarmId, string MacAddress, string GatewaySerial, string FrequencyBand, string FirmwareVersion, string MqttClientId, string ClientCertificateFingerprint);
public sealed record GatewayFirmwareConfigView(Guid GatewayId, Guid FarmId, Guid ZoneId, Guid DeploymentRequestId, string GatewaySerial, string MqttClientId, string ClientCertificateFingerprint, string MqttHost, int MqttPort, string TelemetryTopic, string CommandTopic, string FeedbackTopic, IReadOnlyList<FirmwareNodeConfigView> Nodes, int ConfigVersion = 1, int TelemetryIntervalSec = 60, int SamplesPerInterval = 1, int PollingIntervalSeconds = 60, int HeartbeatIntervalSeconds = 15, int ResponseTimeoutMs = 3000, int RetryCount = 2, MqttIdentityView? Mqtt = null);
public sealed record MqttIdentityView(string Host, int Port, string ClientId, string Fingerprint);
public sealed record FirmwareNodeConfigView(Guid DeviceId, string HardwareAddress, Guid ZoneId, int LoraAddress, DeviceType DeviceType);
public sealed record GatewayView(Guid GatewayId, Guid FarmId, Guid DeploymentRequestId, string MacAddress, string GatewaySerial, string FrequencyBand, string FirmwareVersion, string MqttClientId, GatewayStatus Status, DateTime? LastSeenAtUtc, int ConnectedNodes, int TelemetryIntervalSec = 60, int SamplesPerInterval = 1, string? InstallationLocation = null, IReadOnlyList<Guid>? ConfiguredNodeIds = null, DateTime? ConfiguredAtUtc = null, int ConfigVersion = 1, int PollingIntervalSeconds = 60, int HeartbeatIntervalSeconds = 15, int ResponseTimeoutMs = 3000, int RetryCount = 2, string ConfigSyncStatus = "Applied");
public sealed record GatewayConfigurationCommand(IReadOnlyList<Guid> NodeIds, int TelemetryIntervalSec, int SamplesPerInterval, string? InstallationLocation, int? PollingIntervalSeconds = null, int? HeartbeatIntervalSeconds = null, int? ResponseTimeoutMs = null, int? RetryCount = null);
public sealed record NodeRegistryItemView(Guid DeviceId, string HardwareAddress, DeviceType DeviceType, Guid? ZoneId, string Status);
public sealed record NodeRegistryPackageView(Guid GatewayId, int NodeRegistryVersion, int ConfigVersion, string GatewaySerial, IReadOnlyList<NodeRegistryItemView> Nodes);
public sealed record FirmwareCommand(Guid FirmwareReleaseId, DateTime ScheduledAtUtc);
public sealed record FirmwareJobView(Guid OtaJobId, Guid GatewayId, Guid FirmwareReleaseId, string TargetVersion, string FirmwareUrl, string? ArtifactSha256, DateTime ScheduledAtUtc, FirmwareJobStatus Status);
public sealed record FirmwareReleaseView(Guid Id, string HardwareTarget, string Version, string ProtocolVersion, string? SourceRepository, string? GitTag, string? CommitSha, string ArtifactUrl, string? ArtifactSha256, string? ReleaseNotes, FirmwareReleaseStatus Status, DateTime? PublishedAtUtc, Guid? ApprovedByUserId);
public sealed record CreateFirmwareReleaseCommand(string HardwareTarget, string Version, string ProtocolVersion, string ArtifactUrl, string? SourceRepository, string? GitTag, string? CommitSha, string? ArtifactSha256, string? ReleaseNotes, DateTime? PublishedAtUtc);
public sealed record GitHubReleaseAssetInput(string Name, string DownloadUrl);
public sealed record GitHubReleaseWebhookCommand(string RepositoryUrl, string Tag, string CommitSha, string? ReleaseName, string? ReleaseNotes, DateTime? PublishedAtUtc, IReadOnlyList<GitHubReleaseAssetInput> Assets);
public sealed record ProvisionNodeInput(string HardwareAddress, DeviceType DeviceType, Guid? DeviceModelId, Guid? HardwareItemId);
public sealed record ProvisionDevicesCommand(Guid DeploymentRequestId, Guid GatewayId, Guid FarmId, IReadOnlyList<ProvisionNodeInput> Nodes);
public sealed record SensorInput(string SensorType, string? Pin, string? Model, string? Interface, string Unit, decimal? MinValue, decimal? MaxValue, int SamplingIntervalSec);
public sealed record ActuatorInput(string ActuatorType, int RelayChannel, decimal? RatedPowerWatt, int MaxDurationMinutes, decimal? FlowRateLitersPerMinute = null);
public sealed record DeviceComponentInput(Guid HardwareItemId, string ComponentType, int Quantity, string? Unit, string? Notes);
public sealed record DeviceComponentView(Guid Id, Guid DeviceId, Guid HardwareItemId, string Code, string Name, string ComponentType, int Quantity, string Unit, string? Notes);
public sealed record AssignDeviceCommand(string? InstallationNotes, decimal? GpsLatitude, decimal? GpsLongitude, int? HeartbeatIntervalSeconds = null);
public sealed record UnassignDeviceCommand(string Reason);
public sealed record DeviceConnectionTestView(Guid TestId, bool Succeeded, decimal? Rssi, decimal? Snr, int? RoundTripLatencyMs, DateTime ObservedAtUtc, string? ErrorCode, string? ErrorMessage);
public sealed record DeviceView(Guid DeviceId, Guid FarmId, Guid GatewayId, Guid DeploymentRequestId, Guid? ZoneId, Guid? DeviceModelId, string HardwareAddress, DeviceType DeviceType, DeviceStatus Status, string? InstallationNotes, IReadOnlyList<string> Sensors, IReadOnlyList<string> Actuators, DeviceConnectionTestView? LatestConnectionTest, DateTime? LastSeenAtUtc = null, int? HeartbeatIntervalSeconds = null, decimal? GpsLatitude = null, decimal? GpsLongitude = null, Guid? HardwareItemId = null);
public sealed record ProvisionDevicesView(int TotalProvisioned, IReadOnlyList<DeviceView> Devices);
public sealed record DiagnoseCommand(string Action, decimal? NewFrequencyChannel, int? IncreaseTxPowerDbm);
public sealed record DiagnosticJobView(Guid DiagnosticJobId, Guid DeviceId, string Action, DiagnosticJobStatus Status, DateTime CreatedAtUtc);
public sealed record ServiceHandoffView(Guid ServiceRequestId, Guid DeploymentRequestId, ServiceRequestStatus Status);
public sealed record HardwarePreparationView(Guid Id, Guid HardwareItemId, Guid TechnicianUserId, string DeviceType, HardwarePreparationStatus Status, string? NodeId, int? LoRaAddress, string? BoardProfile, string? Notes, DateTime CreatedAtUtc, DateTime? CompletedAtUtc, bool? ConnectivityCheckPassed, DateTime? ConnectivityCheckedAtUtc, string? ConnectivityEvidence);
public sealed record HardwareConnectivityCheckCommand(bool Passed, string Evidence);
public sealed record FirmwareInstallationView(Guid Id, Guid PreparationSessionId, Guid TechnicianUserId, Guid? FirmwareReleaseId, string FirmwareVersion, FirmwareUploadMethod UploadMethod, string? BoardProfile, string? BootloaderProfile, FirmwareInstallationResult Result, string? ErrorMessage, string? Notes, DateTime CreatedAtUtc, DateTime? CompletedAtUtc);
public sealed record GatewayEnrollmentView(Guid Id, Guid HardwareItemId, string MacAddress, string ChipId, string GatewaySerial, string Status, DateTime? EnrolledAtUtc, Guid? GatewayId = null);
public sealed record GatewayEnrollmentCommand(Guid HardwareItemId, string MacAddress, string ChipId, string GatewaySerial, string BootstrapToken, string BootstrapFirmwareVersion);
public sealed record GatewayEnrollmentHandshakeCommand(string MacAddress, string ChipId, string BootstrapToken);
public sealed record AutoGatewayEnrollmentCommand(string MacAddress, string ChipId, string? GatewaySerial, string BootstrapFirmwareVersion);
public sealed record GatewayRuntimeUpdateView(Guid JobId, string Version, string FirmwareUrl, string ArtifactSha256, string Status);
public sealed record GatewayOtaResultCommand(string MacAddress, string Version, string Result, string? ErrorCode, string? ErrorMessage);
public sealed record ActivateGatewayEnrollmentCommand(Guid FarmId, Guid DeploymentRequestId, string FrequencyBand);
/// <summary>MÔ PHỎNG Gateway cho một yêu cầu triển khai khi chưa có phần cứng (chỉ môi trường bật SimulatedIot:Enabled).</summary>
public sealed record SimulateGatewayCommand(Guid FarmId, Guid DeploymentRequestId);
