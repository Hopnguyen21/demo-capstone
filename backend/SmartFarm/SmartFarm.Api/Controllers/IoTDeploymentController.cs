using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartFarm.Api.Extensions;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Application.Features.IoTDeployment;
using SmartFarm.Domain.Enums;

namespace SmartFarm.Api.Controllers;

[ApiController, Authorize(Roles = "FarmOwner")]
public sealed class IoTPlanningController(IIoTDeploymentService service) : ControllerBase
{
    // IOT-V1-01
    [HttpGet("api/v1/zones/{zoneId:guid}/iot-requirements")]
    public async Task<ActionResult<IoTRequirementsView>> Requirements(Guid zoneId, CancellationToken ct) => Ok(await service.GetRequirementsAsync(User.GetUserId(), User.GetTenantId(), zoneId, ct));
    // IOT-V1-02
    [HttpPost("api/v1/zones/{zoneId:guid}/device-recommendations")]
    public async Task<ActionResult<IReadOnlyList<DeviceRecommendationView>>> Recommend(Guid zoneId, CancellationToken ct) => Ok(await service.RecommendAsync(User.GetUserId(), User.GetTenantId(), zoneId, ct));
    // IOT-V1-03
    [HttpPost("api/v1/zones/{zoneId:guid}/deployment-requests")]
    public async Task<ActionResult<DeploymentRequestView>> Create(Guid zoneId, DeploymentPlanRequest body, CancellationToken ct) { var result = await service.CreateRequestAsync(User.GetUserId(), User.GetTenantId(), zoneId, new(body.Items.Select(x => x.ToInput()).ToList(), body.Notes), ct); return CreatedAtAction(nameof(Get), new { requestId = result.RequestId }, result); }
    // IOT-V1-04
    [HttpPut("api/v1/deployment-requests/{requestId:guid}/plan")]
    public async Task<ActionResult<DeploymentRequestView>> UpdatePlan(Guid requestId, DeploymentPlanRequest body, CancellationToken ct) => Ok(await service.UpdateOwnerPlanAsync(User.GetUserId(), User.GetTenantId(), requestId, body.Items.Select(x => x.ToInput()).ToList(), ct));
    // IOT-V1-05
    [HttpPost("api/v1/deployment-requests/{requestId:guid}/submit")]
    public async Task<ActionResult<DeploymentRequestView>> Submit(Guid requestId, CancellationToken ct) => Ok(await service.SubmitAsync(User.GetUserId(), User.GetTenantId(), requestId, ct));
    // IOT-V1-06
    [HttpGet("api/v1/deployment-requests/{requestId:guid}")]
    public async Task<ActionResult<DeploymentRequestView>> Get(Guid requestId, CancellationToken ct) => Ok(await service.GetRequestAsync(User.GetUserId(), User.GetTenantId(), requestId, ct));
}

[ApiController, Authorize(Roles = "PlatformTechnician")]
public sealed class TechnicianDeploymentController(IIoTDeploymentService service) : ControllerBase
{
    // IOT-V1-07
    [HttpGet("api/v1/platform/deployment-requests")]
    public async Task<ActionResult<IReadOnlyList<DeploymentRequestView>>> List(CancellationToken ct) => Ok(await service.ListTechnicianRequestsAsync(User.GetUserId(), ct));
    // IOT-V1-06
    [HttpGet("api/v1/platform/deployment-requests/{requestId:guid}")]
    public async Task<ActionResult<DeploymentRequestView>> Get(Guid requestId, CancellationToken ct) => Ok(await service.GetRequestAsync(User.GetUserId(), null, requestId, ct));
    // IOT-V1-08
    [HttpPost("api/v1/platform/deployment-requests/{requestId:guid}/accept")]
    public async Task<ActionResult<DeploymentRequestView>> Accept(Guid requestId, CancellationToken ct) => Ok(await service.AcceptAsync(User.GetUserId(), requestId, ct));
    // IOT-V1-09
    [HttpPost("api/v1/platform/deployment-requests/{requestId:guid}/survey")]
    public async Task<ActionResult<DeploymentRequestView>> Survey(Guid requestId, SurveyRequest body, CancellationToken ct) => Ok(await service.SurveyAsync(User.GetUserId(), requestId, new(body.IsFeasible, body.SiteConditions, body.Notes), ct));
    // IOT-V1-10
    [HttpPut("api/v1/platform/deployment-requests/{requestId:guid}/plan")]
    public async Task<ActionResult<DeploymentRequestView>> Plan(Guid requestId, DeploymentPlanRequest body, CancellationToken ct) => Ok(await service.UpdateTechnicianPlanAsync(User.GetUserId(), requestId, body.Items.Select(x => x.ToInput()).ToList(), ct));
    // IOT-V1-11
    [HttpPost("api/v1/platform/deployment-requests/{requestId:guid}/confirm")]
    public async Task<ActionResult<DeploymentRequestView>> Confirm(Guid requestId, CancellationToken ct) => Ok(await service.ConfirmAsync(User.GetUserId(), requestId, ct));
    // IOT-V1-12
    [HttpPost("api/v1/platform/deployment-requests/{requestId:guid}/installation/start")]
    public async Task<ActionResult<DeploymentRequestView>> Start(Guid requestId, CancellationToken ct) => Ok(await service.StartInstallationAsync(User.GetUserId(), requestId, ct));
    // IOT-V1-13
    [HttpPost("api/v1/platform/deployment-requests/{requestId:guid}/connection-tests")]
    public async Task<ActionResult<DeviceConnectionTestView>> Test(Guid requestId, ConnectionTestRequest body, CancellationToken ct) => Ok(await service.RecordConnectionTestAsync(User.GetUserId(), requestId, body.ToCommand(), ct));
    // IOT-V1-14
    [HttpPost("api/v1/platform/deployment-requests/{requestId:guid}/complete")]
    public async Task<ActionResult<DeploymentRequestView>> Complete(Guid requestId, CancellationToken ct) => Ok(await service.CompleteAsync(User.GetUserId(), requestId, ct));
    // IOT-V1-15
    [HttpPost("api/v1/platform/deployment-requests/{requestId:guid}/fail")]
    public async Task<ActionResult<ServiceHandoffView>> Fail(Guid requestId, FailDeploymentRequest body, CancellationToken ct) => Ok(await service.FailAsync(User.GetUserId(), requestId, new(body.FailureCode, body.Description, body.DeviceId), ct));
}

[ApiController, Authorize]
public sealed class IoTHardwareController(IIoTDeploymentService service) : ControllerBase
{
    // API catalog #54
    [HttpGet("api/v1/farms/{farmId:guid}/gateways"), Authorize(Roles = "FarmOwner,PlatformTechnician")]
    public async Task<ActionResult<IReadOnlyList<GatewayView>>> Gateways(Guid farmId, CancellationToken ct) => Ok(await service.ListGatewaysAsync(User.GetUserId(), User.GetOptionalTenantId(), farmId, ct));
    // API catalog #55
    [HttpPost("api/v1/gateways"), Authorize(Roles = "PlatformTechnician")]
    public async Task<ActionResult<GatewayView>> ProvisionGateway(ProvisionGatewayRequest body, CancellationToken ct) { var result = await service.ProvisionGatewayAsync(User.GetUserId(), body.ToCommand(), ct); return CreatedAtAction(nameof(Gateway), new { gatewayId = result.GatewayId }, result); }
    // API catalog #56
    [HttpGet("api/v1/gateways/{gatewayId:guid}"), Authorize(Roles = "FarmOwner,PlatformTechnician")]
    public async Task<ActionResult<GatewayView>> Gateway(Guid gatewayId, CancellationToken ct) => Ok(await service.GetGatewayAsync(User.GetUserId(), User.GetOptionalTenantId(), gatewayId, ct));
    // API catalog #57
    [HttpPut("api/v1/gateways/{gatewayId:guid}/firmware"), Authorize(Roles = "PlatformTechnician")]
    public async Task<ActionResult<FirmwareJobView>> Firmware(Guid gatewayId, FirmwareRequest body, CancellationToken ct) => Ok(await service.ScheduleFirmwareAsync(User.GetUserId(), gatewayId, new(body.TargetVersion, body.FirmwareUrl, body.ScheduledAtUtc), ct));
    // API catalog #58
    [HttpGet("api/v1/farms/{farmId:guid}/devices"), Authorize(Roles = "FarmOwner,PlatformTechnician")]
    public async Task<ActionResult<IReadOnlyList<DeviceView>>> FarmDevices(Guid farmId, CancellationToken ct) => Ok(await service.ListFarmDevicesAsync(User.GetUserId(), User.GetOptionalTenantId(), farmId, ct));
    // API catalog #59
    [HttpGet("api/v1/zones/{zoneId:guid}/devices"), Authorize(Roles = "FarmOwner")]
    public async Task<ActionResult<IReadOnlyList<DeviceView>>> ZoneDevices(Guid zoneId, CancellationToken ct) => Ok(await service.ListZoneDevicesAsync(User.GetUserId(), User.GetTenantId(), zoneId, ct));
    // API catalog #60
    [HttpGet("api/v1/devices/{deviceId:guid}"), Authorize(Roles = "FarmOwner,PlatformTechnician")]
    public async Task<ActionResult<DeviceView>> Device(Guid deviceId, CancellationToken ct) => Ok(await service.GetDeviceAsync(User.GetUserId(), User.GetOptionalTenantId(), deviceId, ct));
    // API catalog #61
    [HttpPost("api/v1/devices/provision"), Authorize(Roles = "PlatformTechnician")]
    public async Task<ActionResult<ProvisionDevicesView>> ProvisionDevices(ProvisionDevicesRequest body, CancellationToken ct) => Ok(await service.ProvisionDevicesAsync(User.GetUserId(), body.ToCommand(), ct));
    // API catalog #62
    [HttpPut("api/v1/devices/{deviceId:guid}/sensors"), Authorize(Roles = "PlatformTechnician")]
    public async Task<ActionResult<DeviceView>> Sensors(Guid deviceId, SensorConfigurationRequest body, CancellationToken ct) => Ok(await service.ConfigureSensorsAsync(User.GetUserId(), deviceId, body.Sensors.Select(x => x.ToInput()).ToList(), ct));
    // API catalog #63
    [HttpPut("api/v1/devices/{deviceId:guid}/actuators"), Authorize(Roles = "PlatformTechnician")]
    public async Task<ActionResult<DeviceView>> Actuators(Guid deviceId, ActuatorConfigurationRequest body, CancellationToken ct) => Ok(await service.ConfigureActuatorsAsync(User.GetUserId(), deviceId, body.Actuators.Select(x => x.ToInput()).ToList(), ct));
    // API catalog #64
    [HttpPost("api/v1/zones/{zoneId:guid}/devices/{deviceId:guid}/assign"), Authorize(Roles = "PlatformTechnician")]
    public async Task<ActionResult<DeviceView>> Assign(Guid zoneId, Guid deviceId, AssignDeviceRequest body, CancellationToken ct) => Ok(await service.AssignAsync(User.GetUserId(), zoneId, deviceId, new(body.InstallationNotes, body.GpsLatitude, body.GpsLongitude), ct));
    // API catalog #65
    [HttpPost("api/v1/zones/{zoneId:guid}/devices/{deviceId:guid}/unassign"), Authorize(Roles = "PlatformTechnician")]
    public async Task<ActionResult<DeviceView>> Unassign(Guid zoneId, Guid deviceId, UnassignDeviceRequest body, CancellationToken ct) => Ok(await service.UnassignAsync(User.GetUserId(), zoneId, deviceId, new(body.Reason), ct));
    // API catalog #66
    [HttpGet("api/v1/devices/{deviceId:guid}/ping"), Authorize(Roles = "PlatformTechnician")]
    public async Task<ActionResult<DeviceConnectionTestView>> Ping(Guid deviceId, CancellationToken ct) => Ok(await service.GetLatestConnectionTestAsync(User.GetUserId(), deviceId, ct));
    // API catalog #67
    [HttpPost("api/v1/devices/{deviceId:guid}/diagnose"), Authorize(Roles = "PlatformTechnician")]
    public async Task<ActionResult<DiagnosticJobView>> Diagnose(Guid deviceId, DiagnoseRequest body, CancellationToken ct) => Accepted(await service.DiagnoseAsync(User.GetUserId(), deviceId, new(body.Action, body.NewFrequencyChannel, body.IncreaseTxPowerDbm), ct));
    // API catalog #68
    [HttpDelete("api/v1/devices/{deviceId:guid}"), Authorize(Roles = "PlatformTechnician")]
    public async Task<IActionResult> Decommission(Guid deviceId, CancellationToken ct) { await service.DecommissionAsync(User.GetUserId(), deviceId, ct); return NoContent(); }
}

public sealed class PlanItemRequest { public Guid DeviceModelId { get; init; } [Range(1, 100)] public int Quantity { get; init; } [StringLength(1000)] public string? InstallationNotes { get; init; } internal PlanItemInput ToInput() => new(DeviceModelId, Quantity, InstallationNotes); }
public sealed class DeploymentPlanRequest { [Required, MinLength(1)] public List<PlanItemRequest> Items { get; init; } = []; [StringLength(1000)] public string? Notes { get; init; } }
public sealed class SurveyRequest { public bool IsFeasible { get; init; } [Required, StringLength(2000)] public string SiteConditions { get; init; } = ""; [Required, StringLength(2000)] public string Notes { get; init; } = ""; }
public sealed class ConnectionTestRequest { public Guid DeviceId { get; init; } public bool Succeeded { get; init; } public decimal? Rssi { get; init; } public decimal? Snr { get; init; } public int? RoundTripLatencyMs { get; init; } public DateTime ObservedAtUtc { get; init; } [StringLength(100)] public string? ErrorCode { get; init; } [StringLength(1000)] public string? ErrorMessage { get; init; } internal ConnectionTestCommand ToCommand() => new(DeviceId, Succeeded, Rssi, Snr, RoundTripLatencyMs, ObservedAtUtc, ErrorCode, ErrorMessage); }
public sealed class FailDeploymentRequest { [Required, StringLength(100)] public string FailureCode { get; init; } = ""; [Required, StringLength(2000)] public string Description { get; init; } = ""; public Guid? DeviceId { get; init; } }
public sealed class ProvisionGatewayRequest { public Guid DeploymentRequestId { get; init; } public Guid FarmId { get; init; } [Required] public string MacAddress { get; init; } = ""; [Required] public string GatewaySerial { get; init; } = ""; [Required] public string FrequencyBand { get; init; } = ""; [Required] public string FirmwareVersion { get; init; } = ""; [Required] public string MqttClientId { get; init; } = ""; [Required] public string ClientCertificateFingerprint { get; init; } = ""; internal ProvisionGatewayCommand ToCommand() => new(DeploymentRequestId, FarmId, MacAddress, GatewaySerial, FrequencyBand, FirmwareVersion, MqttClientId, ClientCertificateFingerprint); }
public sealed class FirmwareRequest { [Required] public string TargetVersion { get; init; } = ""; [Required] public string FirmwareUrl { get; init; } = ""; public DateTime ScheduledAtUtc { get; init; } }
public sealed class ProvisionNodeRequest { [Required] public string HardwareAddress { get; init; } = ""; [Required] public DeviceType DeviceType { get; init; } public Guid? DeviceModelId { get; init; } internal ProvisionNodeInput ToInput() => new(HardwareAddress, DeviceType, DeviceModelId); }
public sealed class ProvisionDevicesRequest { public Guid DeploymentRequestId { get; init; } public Guid GatewayId { get; init; } public Guid FarmId { get; init; } [Required, MinLength(1), MaxLength(50)] public List<ProvisionNodeRequest> Nodes { get; init; } = []; internal ProvisionDevicesCommand ToCommand() => new(DeploymentRequestId, GatewayId, FarmId, Nodes.Select(x => x.ToInput()).ToList()); }
public sealed class SensorRequest { [Required] public string SensorType { get; init; } = ""; public string? Pin { get; init; } public string? Model { get; init; } public string? Interface { get; init; } [Required] public string Unit { get; init; } = ""; public decimal? MinValue { get; init; } public decimal? MaxValue { get; init; } [Range(10, 3600)] public int SamplingIntervalSec { get; init; } = 60; internal SensorInput ToInput() => new(SensorType, Pin, Model, Interface, Unit, MinValue, MaxValue, SamplingIntervalSec); }
public sealed class SensorConfigurationRequest { [Required, MinLength(1)] public List<SensorRequest> Sensors { get; init; } = []; }
public sealed class ActuatorRequest { [Required] public string ActuatorType { get; init; } = ""; [Range(1, 8)] public int RelayChannel { get; init; } public decimal? RatedPowerWatt { get; init; } [Range(1, 30)] public int MaxDurationMinutes { get; init; } internal ActuatorInput ToInput() => new(ActuatorType, RelayChannel, RatedPowerWatt, MaxDurationMinutes); }
public sealed class ActuatorConfigurationRequest { [Required, MinLength(1)] public List<ActuatorRequest> Actuators { get; init; } = []; }
public sealed class AssignDeviceRequest { [StringLength(1000)] public string? InstallationNotes { get; init; } public decimal? GpsLatitude { get; init; } public decimal? GpsLongitude { get; init; } }
public sealed class UnassignDeviceRequest { [Required, StringLength(1000)] public string Reason { get; init; } = ""; }
public sealed class DiagnoseRequest { [Required] public string Action { get; init; } = ""; public decimal? NewFrequencyChannel { get; init; } public int? IncreaseTxPowerDbm { get; init; } }
