using SmartFarm.Domain.Common;
using SmartFarm.Domain.Enums;

namespace SmartFarm.Domain.Entities;

public sealed class DeviceModelDefinition : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public DeviceType DeviceType { get; set; }
    public decimal CoverageAreaM2 { get; set; }
    public bool IsActive { get; set; } = true;
    public ICollection<DeviceModelCapability> Capabilities { get; } = new List<DeviceModelCapability>();
}

public sealed class DeviceModelCapability
{
    public Guid DeviceModelDefinitionId { get; set; }
    public DeviceModelDefinition DeviceModelDefinition { get; set; } = null!;
    public EnvironmentalParameterCode ParameterCode { get; set; }
}

public sealed class DeploymentRequest : AuditableEntity
{
    public Guid TenantId { get; set; }
    public Tenant Tenant { get; set; } = null!;
    public Guid FarmId { get; set; }
    public Farm Farm { get; set; } = null!;
    public Guid ZoneId { get; set; }
    public Zone Zone { get; set; } = null!;
    public Guid PlantingSeasonId { get; set; }
    public PlantingSeason PlantingSeason { get; set; } = null!;
    public Guid OwnerUserId { get; set; }
    public AppUser OwnerUser { get; set; } = null!;
    public Guid? TechnicianUserId { get; set; }
    public AppUser? TechnicianUser { get; set; }
    public DeploymentRequestStatus Status { get; set; }
    public string RequiredParametersCsv { get; set; } = string.Empty;
    public string? OwnerNotes { get; set; }
    public string? FailureCode { get; set; }
    public string? FailureDescription { get; set; }
    public DateTime? SubmittedAtUtc { get; set; }
    public DateTime? CompletedAtUtc { get; set; }
    public ICollection<DeploymentPlanItem> PlanItems { get; } = new List<DeploymentPlanItem>();
    public ICollection<DeploymentSurvey> Surveys { get; } = new List<DeploymentSurvey>();
    public ICollection<DeploymentDecisionHistory> Decisions { get; } = new List<DeploymentDecisionHistory>();
}

public sealed class DeploymentPlanItem : AuditableEntity
{
    public Guid DeploymentRequestId { get; set; }
    public DeploymentRequest DeploymentRequest { get; set; } = null!;
    public Guid DeviceModelDefinitionId { get; set; }
    public DeviceModelDefinition DeviceModelDefinition { get; set; } = null!;
    public int Quantity { get; set; }
    public string? InstallationNotes { get; set; }
}

public sealed class DeploymentSurvey : AuditableEntity
{
    public Guid DeploymentRequestId { get; set; }
    public DeploymentRequest DeploymentRequest { get; set; } = null!;
    public Guid TechnicianUserId { get; set; }
    public AppUser TechnicianUser { get; set; } = null!;
    public bool IsFeasible { get; set; }
    public string SiteConditions { get; set; } = string.Empty;
    public string Notes { get; set; } = string.Empty;
}

public sealed class DeploymentDecisionHistory : AuditableEntity
{
    public Guid DeploymentRequestId { get; set; }
    public DeploymentRequest DeploymentRequest { get; set; } = null!;
    public Guid ActorUserId { get; set; }
    public AppUser ActorUser { get; set; } = null!;
    public string DecisionType { get; set; } = string.Empty;
    public string FromStatus { get; set; } = string.Empty;
    public string ToStatus { get; set; } = string.Empty;
    public string? Notes { get; set; }
}

public sealed class Gateway : AuditableEntity
{
    public Guid FarmId { get; set; }
    public Farm Farm { get; set; } = null!;
    public Guid DeploymentRequestId { get; set; }
    public DeploymentRequest DeploymentRequest { get; set; } = null!;
    public string MacAddress { get; set; } = string.Empty;
    public string GatewaySerial { get; set; } = string.Empty;
    public string FrequencyBand { get; set; } = string.Empty;
    public string FirmwareVersion { get; set; } = string.Empty;
    public string MqttClientId { get; set; } = string.Empty;
    public string ClientCertificateFingerprint { get; set; } = string.Empty;
    public GatewayStatus Status { get; set; } = GatewayStatus.Provisioned;
    public DateTime? LastSeenAtUtc { get; set; }
    public ICollection<Device> Devices { get; } = new List<Device>();
}

public sealed class FirmwareJob : AuditableEntity
{
    public Guid GatewayId { get; set; }
    public Gateway Gateway { get; set; } = null!;
    public string TargetVersion { get; set; } = string.Empty;
    public string FirmwareUrl { get; set; } = string.Empty;
    public DateTime ScheduledAtUtc { get; set; }
    public FirmwareJobStatus Status { get; set; } = FirmwareJobStatus.Scheduled;
}

public sealed class Device : AuditableEntity
{
    public Guid FarmId { get; set; }
    public Farm Farm { get; set; } = null!;
    public Guid GatewayId { get; set; }
    public Gateway Gateway { get; set; } = null!;
    public Guid DeploymentRequestId { get; set; }
    public DeploymentRequest DeploymentRequest { get; set; } = null!;
    public Guid? ZoneId { get; set; }
    public Zone? Zone { get; set; }
    public Guid? DeviceModelDefinitionId { get; set; }
    public DeviceModelDefinition? DeviceModelDefinition { get; set; }
    public string HardwareAddress { get; set; } = string.Empty;
    public DeviceType DeviceType { get; set; }
    public DeviceStatus Status { get; set; } = DeviceStatus.Unassigned;
    public string? InstallationNotes { get; set; }
    public decimal? GpsLatitude { get; set; }
    public decimal? GpsLongitude { get; set; }
    public DateTime? DecommissionedAtUtc { get; set; }
    public ICollection<DeviceSensor> Sensors { get; } = new List<DeviceSensor>();
    public ICollection<DeviceActuator> Actuators { get; } = new List<DeviceActuator>();
    public ICollection<DeviceAssignmentHistory> AssignmentHistory { get; } = new List<DeviceAssignmentHistory>();
    public ICollection<DeviceConnectionTest> ConnectionTests { get; } = new List<DeviceConnectionTest>();
}

public sealed class DeviceSensor : AuditableEntity
{
    public Guid DeviceId { get; set; }
    public Device Device { get; set; } = null!;
    public string SensorType { get; set; } = string.Empty;
    public string? Pin { get; set; }
    public string? Model { get; set; }
    public string? Interface { get; set; }
    public string Unit { get; set; } = string.Empty;
    public decimal? MinValue { get; set; }
    public decimal? MaxValue { get; set; }
    public int SamplingIntervalSec { get; set; } = 60;
}

public sealed class DeviceActuator : AuditableEntity
{
    public Guid DeviceId { get; set; }
    public Device Device { get; set; } = null!;
    public string ActuatorType { get; set; } = string.Empty;
    public int RelayChannel { get; set; }
    public decimal? RatedPowerWatt { get; set; }
    public int MaxDurationMinutes { get; set; }
}

public sealed class DeviceAssignmentHistory : AuditableEntity
{
    public Guid DeviceId { get; set; }
    public Device Device { get; set; } = null!;
    public Guid? ZoneId { get; set; }
    public Zone? Zone { get; set; }
    public Guid TechnicianUserId { get; set; }
    public AppUser TechnicianUser { get; set; } = null!;
    public string Action { get; set; } = string.Empty;
    public string? Notes { get; set; }
}

public sealed class DeviceConnectionTest : AuditableEntity
{
    public Guid DeviceId { get; set; }
    public Device Device { get; set; } = null!;
    public Guid DeploymentRequestId { get; set; }
    public DeploymentRequest DeploymentRequest { get; set; } = null!;
    public Guid TechnicianUserId { get; set; }
    public AppUser TechnicianUser { get; set; } = null!;
    public bool Succeeded { get; set; }
    public decimal? Rssi { get; set; }
    public decimal? Snr { get; set; }
    public int? RoundTripLatencyMs { get; set; }
    public DateTime ObservedAtUtc { get; set; }
    public string? ErrorCode { get; set; }
    public string? ErrorMessage { get; set; }
}

public sealed class DeviceDiagnosticJob : AuditableEntity
{
    public Guid DeviceId { get; set; }
    public Device Device { get; set; } = null!;
    public Guid TechnicianUserId { get; set; }
    public AppUser TechnicianUser { get; set; } = null!;
    public string Action { get; set; } = string.Empty;
    public decimal? NewFrequencyChannel { get; set; }
    public int? IncreaseTxPowerDbm { get; set; }
    public DiagnosticJobStatus Status { get; set; } = DiagnosticJobStatus.Pending;
}

public sealed class ServiceRequest : AuditableEntity
{
    public Guid TenantId { get; set; }
    public Tenant Tenant { get; set; } = null!;
    public Guid FarmId { get; set; }
    public Farm Farm { get; set; } = null!;
    public Guid ZoneId { get; set; }
    public Zone Zone { get; set; } = null!;
    public Guid DeploymentRequestId { get; set; }
    public DeploymentRequest DeploymentRequest { get; set; } = null!;
    public Guid? DeviceId { get; set; }
    public Device? Device { get; set; }
    public string Source { get; set; } = string.Empty;
    public string FailureCode { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public ServiceRequestStatus Status { get; set; } = ServiceRequestStatus.Open;
}
