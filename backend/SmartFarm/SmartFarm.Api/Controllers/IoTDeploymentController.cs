using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using SmartFarm.Api.Extensions;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Application.Features.IoTDeployment;
using SmartFarm.Domain.Enums;
using SmartFarm.Api.HostedServices;

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
    // IOT-V1-03b: Owner xem thông tin Zone + nội dung yêu cầu rồi xác nhận gửi (trạng thái Submitted ngay, kèm dự toán thiết bị)
    [HttpPost("api/v1/zones/{zoneId:guid}/deployment-requests/submit")]
    public async Task<ActionResult<DeploymentRequestView>> SubmitDirect(Guid zoneId, [FromBody] SubmitDeploymentRequestCommand body, CancellationToken ct) { var result = await service.SubmitWithEstimateAsync(User.GetUserId(), User.GetTenantId(), zoneId, body, ct); return CreatedAtAction(nameof(Get), new { requestId = result.RequestId }, result); }
    // IOT-V1-03a: danh sách yêu cầu của Tenant trong JWT (tuỳ chọn lọc theo Zone)
    [HttpGet("api/v1/deployment-requests")]
    public async Task<ActionResult<IReadOnlyList<DeploymentRequestView>>> ListMine([FromQuery] Guid? zoneId, CancellationToken ct) => Ok(await service.ListOwnerRequestsAsync(User.GetUserId(), User.GetTenantId(), zoneId, ct));
    // IOT-V1-04
    [HttpPut("api/v1/deployment-requests/{requestId:guid}/plan")]
    public async Task<ActionResult<DeploymentRequestView>> UpdatePlan(Guid requestId, DeploymentPlanRequest body, CancellationToken ct) => Ok(await service.UpdateOwnerPlanAsync(User.GetUserId(), User.GetTenantId(), requestId, body.Items.Select(x => x.ToInput()).ToList(), ct));
    // IOT-V1-05
    [HttpPost("api/v1/deployment-requests/{requestId:guid}/submit")]
    public async Task<ActionResult<DeploymentRequestView>> Submit(Guid requestId, CancellationToken ct) => Ok(await service.SubmitAsync(User.GetUserId(), User.GetTenantId(), requestId, ct));
    // IOT-V1-05b: chủ trại hủy yêu cầu triển khai khi chưa bắt đầu lắp đặt (chưa ký hợp đồng/đóng cọc)
    [HttpPost("api/v1/deployment-requests/{requestId:guid}/cancel")]
    public async Task<ActionResult<DeploymentRequestView>> Cancel(Guid requestId, [FromBody] CancelDeploymentRequest? body, CancellationToken ct) => Ok(await service.CancelAsync(User.GetUserId(), User.GetTenantId(), requestId, body?.Reason, ct));
    // IOT-V1-06
    [HttpGet("api/v1/deployment-requests/{requestId:guid}")]
    public async Task<ActionResult<DeploymentRequestView>> Get(Guid requestId, CancellationToken ct) => Ok(await service.GetRequestAsync(User.GetUserId(), User.GetTenantId(), requestId, ct));
}

[ApiController, Authorize(Roles = "PlatformTechnician")]
public sealed class TechnicianDeploymentController(IIoTDeploymentService service) : ControllerBase
{
    // IOT-V1-10a: model catalogue for the assigned technician's deployment plan.
    [HttpGet("api/v1/platform/deployment-requests/{requestId:guid}/models")]
    public async Task<ActionResult<IReadOnlyList<DeviceRecommendationView>>> Models(Guid requestId, CancellationToken ct) => Ok(await service.ListPlanModelsAsync(User.GetUserId(), requestId, ct));
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
    public async Task<ActionResult<DeploymentRequestView>> Complete(Guid requestId, [FromBody(EmptyBodyBehavior = Microsoft.AspNetCore.Mvc.ModelBinding.EmptyBodyBehavior.Allow)] CompleteDeploymentBody? body, CancellationToken ct) => Ok(await service.CompleteAsync(User.GetUserId(), requestId, body?.Notes, ct));
    // IOT-V1-15
    [HttpPost("api/v1/platform/deployment-requests/{requestId:guid}/fail")]
    public async Task<ActionResult<ServiceHandoffView>> Fail(Guid requestId, FailDeploymentRequest body, CancellationToken ct) => Ok(await service.FailAsync(User.GetUserId(), requestId, new(body.FailureCode, body.Description, body.DeviceId), ct));
}

[ApiController, Authorize]
public sealed class IoTHardwareController(IIoTDeploymentService service, MqttBrokerHost mqttBroker) : ControllerBase
{
    // API catalog #54
    [HttpGet("api/v1/farms/{farmId:guid}/gateways"), Authorize(Roles = "FarmOwner,PlatformTechnician,PlatformAdmin")]
    public async Task<ActionResult<IReadOnlyList<GatewayView>>> Gateways(Guid farmId, CancellationToken ct) => Ok(await service.ListGatewaysAsync(User.GetUserId(), User.GetOptionalTenantId(), farmId, ct));
    // API catalog #55
    [HttpPost("api/v1/gateways"), Authorize(Roles = "PlatformTechnician")]
    [Obsolete("Use gateway enrollment and activation instead.")]
    public ActionResult<GatewayView> ProvisionGateway(ProvisionGatewayRequest body, CancellationToken ct) => StatusCode(StatusCodes.Status410Gone, new { detail = "Legacy Gateway provisioning is disabled. Use /api/v1/gateway-enrollment then /activate." });
    [HttpPost("api/v1/gateway-enrollment"), Authorize(Roles = "PlatformTechnician")]
    public async Task<ActionResult<GatewayEnrollmentView>> EnrollGateway(GatewayEnrollmentRequest body, CancellationToken ct) => Ok(await service.EnrollGatewayAsync(User.GetUserId(), body.ToCommand(), ct));
    [HttpPost("api/v1/gateway-enrollment/{enrollmentId:guid}/handshake")]
    [AllowAnonymous, EnableRateLimiting("GatewayHandshakePolicy")]
    public async Task<ActionResult<GatewayEnrollmentView>> VerifyGatewayHandshake(Guid enrollmentId, GatewayEnrollmentHandshakeRequest body, CancellationToken ct)
        => Ok(await service.VerifyGatewayEnrollmentHandshakeAsync(enrollmentId, body.ToCommand(), ct));
    [HttpPost("api/v1/gateway-enrollment/auto"), AllowAnonymous]
    public async Task<ActionResult<GatewayEnrollmentView>> AutoEnrollGateway(AutoGatewayEnrollmentRequest body, CancellationToken ct)
        => Ok(await service.AutoEnrollGatewayAsync(body.ToCommand(), ct));
    [HttpGet("api/v1/gateway-enrollment/by-hardware/{hardwareItemId:guid}"), Authorize(Roles = "PlatformTechnician")]
    public async Task<ActionResult<GatewayEnrollmentView>> GatewayEnrollmentByHardware(Guid hardwareItemId, CancellationToken ct)
        => (await service.GetGatewayEnrollmentAsync(User.GetUserId(), hardwareItemId, ct)) is { } enrollment ? Ok(enrollment) : NoContent();
    [HttpGet("api/v1/gateway-runtime/update"), AllowAnonymous]
    public async Task<ActionResult<GatewayRuntimeUpdateView>> GatewayRuntimeUpdate([FromQuery] string macAddress, [FromQuery] string currentVersion = "bootstrap", CancellationToken ct = default)
        => (await service.GetGatewayRuntimeUpdateAsync(macAddress, currentVersion, ct)) is { } update ? Ok(update) : NoContent();
    [HttpGet("api/v1/gateway-runtime/config"), AllowAnonymous]
    public async Task<ActionResult<GatewayFirmwareConfigView>> GatewayRuntimeConfig([FromQuery] string macAddress, CancellationToken ct = default)
        => (await service.GetGatewayRuntimeConfigAsync(macAddress, ct)) is { } config ? Ok(config) : NoContent();
    [HttpPost("api/v1/gateway-runtime/ota-result"), AllowAnonymous]
    public async Task<IActionResult> GatewayOtaResult(GatewayOtaResultRequest body, CancellationToken ct)
    { await service.RecordGatewayOtaResultAsync(new(body.MacAddress, body.Version, body.Result, body.ErrorCode, body.ErrorMessage), ct); return NoContent(); }
    /// <summary>MÔ PHỎNG Gateway khi chưa có phần cứng; 404 nếu môi trường không bật SimulatedIot:Enabled.</summary>
    [HttpPost("api/v1/gateway-enrollment/simulate"), Authorize(Roles = "PlatformTechnician")]
    public async Task<ActionResult<GatewayEnrollmentView>> SimulateGateway(SimulateGatewayCommand body, CancellationToken ct) => Ok(await service.SimulateGatewayAsync(User.GetUserId(), body, ct));
    [HttpPost("api/v1/gateway-enrollment/{enrollmentId:guid}/activate"), Authorize(Roles = "PlatformTechnician")]
    public async Task<ActionResult<GatewayEnrollmentView>> ActivateGatewayEnrollment(Guid enrollmentId, ActivateGatewayEnrollmentRequest body, CancellationToken ct) => Ok(await service.ActivateGatewayEnrollmentAsync(User.GetUserId(), enrollmentId, body.ToCommand(), ct));
    // API catalog #56
    [HttpGet("api/v1/gateways/{gatewayId:guid}"), Authorize(Roles = "FarmOwner,PlatformTechnician")]
    public async Task<ActionResult<GatewayView>> Gateway(Guid gatewayId, CancellationToken ct) => Ok(await service.GetGatewayAsync(User.GetUserId(), User.GetOptionalTenantId(), gatewayId, ct));
    [HttpGet("api/v1/gateways/{gatewayId:guid}/firmware-config"), Authorize(Roles = "PlatformTechnician")]
    public async Task<ActionResult<GatewayFirmwareConfigView>> FirmwareConfig(Guid gatewayId, CancellationToken ct) => Ok(await service.GetFirmwareConfigAsync(User.GetUserId(), gatewayId, ct));
    [HttpGet("api/v1/gateways/{gatewayId:guid}/mqtt-status"), Authorize(Roles = "FarmOwner,PlatformTechnician,PlatformAdmin")]
    public async Task<ActionResult<object>> MqttStatus(Guid gatewayId, CancellationToken ct)
    {
        var gateway = await service.GetGatewayAsync(User.GetUserId(), User.GetOptionalTenantId(), gatewayId, ct);
        return Ok(new { gatewayId, mqttConnected = mqttBroker.IsConnected(gateway.MqttClientId) });
    }
    [HttpPut("api/v1/gateways/{gatewayId:guid}/configuration"), Authorize(Roles = "PlatformTechnician")]
    public async Task<ActionResult<GatewayView>> ConfigureGateway(Guid gatewayId, GatewayConfigurationRequest body, CancellationToken ct)
    {
        var result = await service.ConfigureGatewayAsync(User.GetUserId(), gatewayId, new(body.NodeIds, body.TelemetryIntervalSec, body.SamplesPerInterval, body.InstallationLocation, body.PollingIntervalSeconds, body.HeartbeatIntervalSeconds, body.ResponseTimeoutMs, body.RetryCount), ct);
        var config = await service.GetFirmwareConfigAsync(User.GetUserId(), gatewayId, ct);
        await mqttBroker.PublishGatewayConfigurationAsync(config, ct);
        return Ok(result);
    }
    [HttpPost("api/v1/gateways/{gatewayId:guid}/ack-configuration"), Authorize(Roles = "PlatformTechnician")]
    public async Task<ActionResult<GatewayView>> AckConfiguration(Guid gatewayId, [FromQuery] int configVersion, CancellationToken ct)
        => Ok(await service.AckGatewayConfigurationAsync(User.GetUserId(), gatewayId, configVersion, ct));
    [HttpGet("api/v1/gateways/{gatewayId:guid}/node-registry")]
    public async Task<ActionResult<NodeRegistryPackageView>> NodeRegistry(Guid gatewayId, CancellationToken ct)
        => Ok(await service.GetNodeRegistryAsync(gatewayId, ct));
    // API catalog #57
    [HttpPut("api/v1/gateways/{gatewayId:guid}/firmware"), Authorize(Roles = "PlatformTechnician")]
    public async Task<ActionResult<FirmwareJobView>> Firmware(Guid gatewayId, FirmwareRequest body, CancellationToken ct) => Ok(await service.ScheduleFirmwareAsync(User.GetUserId(), gatewayId, new(body.FirmwareReleaseId, body.ScheduledAtUtc), ct));
    [HttpPost("api/v1/gateways/{gatewayId:guid}/firmware/retry"), Authorize(Roles = "PlatformTechnician")]
    public async Task<ActionResult<FirmwareJobView>> RetryFirmware(Guid gatewayId, CancellationToken ct)
        => Ok(await service.RetryFirmwareAsync(User.GetUserId(), gatewayId, ct));
    [HttpGet("api/v1/gateways/{gatewayId:guid}/firmware-job"), Authorize(Roles = "PlatformTechnician,FarmOwner,PlatformAdmin")]
    public async Task<ActionResult<FirmwareJobView>> LatestFirmwareJob(Guid gatewayId, CancellationToken ct)
        => (await service.GetLatestFirmwareJobAsync(User.GetUserId(), gatewayId, ct)) is { } job ? Ok(job) : NoContent();
    [HttpGet("api/v1/admin/firmware/releases"), Authorize(Roles = "PlatformAdmin")]
    public async Task<ActionResult<IReadOnlyList<FirmwareReleaseView>>> FirmwareReleases(CancellationToken ct) => Ok(await service.ListFirmwareReleasesAsync(User.GetUserId(), ct));
    [HttpGet("api/v1/technician/firmware/releases"), Authorize(Roles = "PlatformTechnician,PlatformAdmin")]
    public async Task<ActionResult<IReadOnlyList<FirmwareReleaseView>>> ApprovedFirmwareReleases(CancellationToken ct) => Ok(await service.ListApprovedFirmwareReleasesAsync(ct));
    [HttpPost("api/v1/admin/firmware/releases"), Authorize(Roles = "PlatformAdmin")]
    public async Task<ActionResult<FirmwareReleaseView>> CreateFirmwareRelease(CreateFirmwareReleaseRequest body, CancellationToken ct)
    {
        var result = await service.CreateFirmwareReleaseAsync(User.GetUserId(), body.ToCommand(), ct);
        return Created($"/api/v1/admin/firmware/releases/{result.Id}", result);
    }
    [HttpPut("api/v1/admin/firmware/releases/{releaseId:guid}/status"), Authorize(Roles = "PlatformAdmin")]
    public async Task<ActionResult<FirmwareReleaseView>> SetFirmwareReleaseStatus(Guid releaseId, FirmwareReleaseStatusRequest body, CancellationToken ct)
        => Ok(await service.SetFirmwareReleaseStatusAsync(User.GetUserId(), releaseId, body.Status, body.ArtifactSha256, ct));
    // API catalog #58
    [HttpGet("api/v1/farms/{farmId:guid}/devices"), Authorize(Roles = "FarmOwner,PlatformTechnician,Farmer,PlatformAdmin")]
    [HttpGet("api/v1/farms/{farmId:guid}/nodes"), Authorize(Roles = "FarmOwner,PlatformTechnician,Farmer,PlatformAdmin")]
    public async Task<ActionResult<IReadOnlyList<DeviceView>>> FarmDevices(Guid farmId, CancellationToken ct) => Ok(await service.ListFarmDevicesAsync(User.GetUserId(), User.GetOptionalTenantId(), farmId, ct));
    // API catalog #59
    [HttpGet("api/v1/zones/{zoneId:guid}/devices"), Authorize(Roles = "FarmOwner,PlatformTechnician,Farmer,PlatformAdmin")]
    [HttpGet("api/v1/zones/{zoneId:guid}/nodes"), Authorize(Roles = "FarmOwner,PlatformTechnician,Farmer,PlatformAdmin")]
    public async Task<ActionResult<IReadOnlyList<DeviceView>>> ZoneDevices(Guid zoneId, CancellationToken ct) => Ok(await service.ListZoneDevicesAsync(User.GetUserId(), User.GetOptionalTenantId() ?? Guid.Empty, zoneId, ct));
    // API catalog #60
    [HttpGet("api/v1/devices/{deviceId:guid}"), Authorize(Roles = "FarmOwner,PlatformTechnician,Farmer,PlatformAdmin")]
    [HttpGet("api/v1/nodes/{deviceId:guid}"), Authorize(Roles = "FarmOwner,PlatformTechnician,Farmer,PlatformAdmin")]
    public async Task<ActionResult<DeviceView>> Device(Guid deviceId, CancellationToken ct) => Ok(await service.GetDeviceAsync(User.GetUserId(), User.GetOptionalTenantId(), deviceId, ct));
    // API catalog #61
    [HttpPost("api/v1/devices/provision"), Authorize(Roles = "PlatformTechnician")]
    public async Task<ActionResult<ProvisionDevicesView>> ProvisionDevices(ProvisionDevicesRequest body, CancellationToken ct) => Ok(await service.ProvisionDevicesAsync(User.GetUserId(), body.ToCommand(), ct));
    [HttpPost("api/v1/technician/hardware-preparations/{hardwareItemId:guid}/start"), Authorize(Roles = "PlatformTechnician")]
    public async Task<ActionResult<HardwarePreparationView>> StartPreparation(Guid hardwareItemId, CancellationToken ct) => Ok(await service.StartHardwarePreparationAsync(User.GetUserId(), hardwareItemId, ct));
    [HttpGet("api/v1/technician/hardware-preparations"), Authorize(Roles = "PlatformTechnician")]
    public async Task<ActionResult<IReadOnlyList<HardwarePreparationView>>> ListPreparations(CancellationToken ct) => Ok(await service.ListHardwarePreparationsAsync(User.GetUserId(), ct));
    [HttpPost("api/v1/technician/hardware-preparations/{preparationId:guid}/status"), Authorize(Roles = "PlatformTechnician")]
    public async Task<ActionResult<HardwarePreparationView>> AdvancePreparation(Guid preparationId, HardwarePreparationStatusRequest body, CancellationToken ct) => Ok(await service.AdvanceHardwarePreparationAsync(User.GetUserId(), preparationId, body.Status, body.NodeId, body.LoRaAddress, body.BoardProfile, body.Notes, ct));
    [HttpPost("api/v1/technician/hardware-preparations/{preparationId:guid}/connectivity-check"), Authorize(Roles = "PlatformTechnician")]
    public async Task<ActionResult<HardwarePreparationView>> RecordConnectivityCheck(Guid preparationId, HardwareConnectivityCheckRequest body, CancellationToken ct) => Ok(await service.RecordHardwareConnectivityCheckAsync(User.GetUserId(), preparationId, new(body.Passed, body.Evidence), ct));
    [HttpPost("api/v1/technician/hardware-preparations/{preparationId:guid}/firmware"), Authorize(Roles = "PlatformTechnician")]
    public async Task<ActionResult<FirmwareInstallationView>> RecordFirmware(Guid preparationId, FirmwareInstallationRequest body, CancellationToken ct) => Ok(await service.RecordFirmwareInstallationAsync(User.GetUserId(), preparationId, body.FirmwareReleaseId, body.UploadMethod, body.Result, body.BoardProfile, body.BootloaderProfile, body.ErrorMessage, body.Notes, ct));
    [HttpGet("api/v1/technician/hardware-preparations/{preparationId:guid}/firmware"), Authorize(Roles = "PlatformTechnician")]
    public async Task<ActionResult<IReadOnlyList<FirmwareInstallationView>>> ListFirmware(Guid preparationId, CancellationToken ct) => Ok(await service.ListFirmwareInstallationsAsync(User.GetUserId(), preparationId, ct));
    // API catalog #62
    [HttpPut("api/v1/devices/{deviceId:guid}/sensors"), Authorize(Roles = "PlatformTechnician")]
    public async Task<ActionResult<DeviceView>> Sensors(Guid deviceId, SensorConfigurationRequest body, CancellationToken ct) => Ok(await service.ConfigureSensorsAsync(User.GetUserId(), deviceId, body.Sensors.Select(x => x.ToInput()).ToList(), ct));
    // API catalog #63
    [HttpPut("api/v1/devices/{deviceId:guid}/actuators"), Authorize(Roles = "PlatformTechnician")]
    public async Task<ActionResult<DeviceView>> Actuators(Guid deviceId, ActuatorConfigurationRequest body, CancellationToken ct) => Ok(await service.ConfigureActuatorsAsync(User.GetUserId(), deviceId, body.Actuators.Select(x => x.ToInput()).ToList(), ct));
    [HttpPut("api/v1/devices/{deviceId:guid}/components"), Authorize(Roles = "PlatformTechnician")]
    public async Task<ActionResult<IReadOnlyList<DeviceComponentView>>> Components(Guid deviceId, DeviceComponentConfigurationRequest body, CancellationToken ct) => Ok(await service.ConfigureComponentsAsync(User.GetUserId(), deviceId, body.Components.Select(x => new DeviceComponentInput(x.HardwareItemId, x.ComponentType, x.Quantity, x.Unit, x.Notes)).ToList(), ct));
    [HttpGet("api/v1/devices/{deviceId:guid}/components"), Authorize(Roles = "PlatformTechnician")]
    public async Task<ActionResult<IReadOnlyList<DeviceComponentView>>> GetComponents(Guid deviceId, CancellationToken ct) => Ok(await service.GetComponentsAsync(User.GetUserId(), deviceId, ct));
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
public sealed class CancelDeploymentRequest { [StringLength(1000)] public string? Reason { get; init; } }
public sealed class FailDeploymentRequest { [Required, StringLength(100)] public string FailureCode { get; init; } = ""; [Required, StringLength(2000)] public string Description { get; init; } = ""; public Guid? DeviceId { get; init; } }
public sealed class ProvisionGatewayRequest { public Guid DeploymentRequestId { get; init; } public Guid FarmId { get; init; } [Required] public string MacAddress { get; init; } = ""; [Required] public string GatewaySerial { get; init; } = ""; [Required] public string FrequencyBand { get; init; } = ""; [Required] public string FirmwareVersion { get; init; } = ""; [Required] public string MqttClientId { get; init; } = ""; [Required] public string ClientCertificateFingerprint { get; init; } = ""; internal ProvisionGatewayCommand ToCommand() => new(DeploymentRequestId, FarmId, MacAddress, GatewaySerial, FrequencyBand, FirmwareVersion, MqttClientId, ClientCertificateFingerprint); }
public sealed class GatewayConfigurationRequest { public List<Guid> NodeIds { get; init; } = []; [Range(10, 86400)] public int TelemetryIntervalSec { get; init; } = 60; [Range(1, 60)] public int SamplesPerInterval { get; init; } = 1; [StringLength(500)] public string? InstallationLocation { get; init; } public int? PollingIntervalSeconds { get; init; } public int? HeartbeatIntervalSeconds { get; init; } public int? ResponseTimeoutMs { get; init; } public int? RetryCount { get; init; } }
public sealed class FirmwareRequest { [Required] public Guid FirmwareReleaseId { get; init; } public DateTime ScheduledAtUtc { get; init; } }
public sealed class CreateFirmwareReleaseRequest { [Required, StringLength(80)] public string HardwareTarget { get; init; } = ""; [Required, StringLength(50)] public string Version { get; init; } = ""; [Required, StringLength(50)] public string ProtocolVersion { get; init; } = ""; [Required, Url, StringLength(1500)] public string ArtifactUrl { get; init; } = ""; [StringLength(500)] public string? SourceRepository { get; init; } [StringLength(150)] public string? GitTag { get; init; } [StringLength(100)] public string? CommitSha { get; init; } [StringLength(128)] public string? ArtifactSha256 { get; init; } [StringLength(4000)] public string? ReleaseNotes { get; init; } public DateTime? PublishedAtUtc { get; init; } internal CreateFirmwareReleaseCommand ToCommand() => new(HardwareTarget, Version, ProtocolVersion, ArtifactUrl, SourceRepository, GitTag, CommitSha, ArtifactSha256, ReleaseNotes, PublishedAtUtc); }
public sealed class FirmwareReleaseStatusRequest { [Required] public FirmwareReleaseStatus Status { get; init; } [StringLength(128)] public string? ArtifactSha256 { get; init; } }
public sealed class ProvisionNodeRequest { [Required] public string HardwareAddress { get; init; } = ""; [Required] public DeviceType DeviceType { get; init; } public Guid? DeviceModelId { get; init; } public Guid? HardwareItemId { get; init; } internal ProvisionNodeInput ToInput() => new(HardwareAddress, DeviceType, DeviceModelId, HardwareItemId); }
public sealed class ProvisionDevicesRequest { public Guid DeploymentRequestId { get; init; } public Guid GatewayId { get; init; } public Guid FarmId { get; init; } [Required, MinLength(1), MaxLength(50)] public List<ProvisionNodeRequest> Nodes { get; init; } = []; internal ProvisionDevicesCommand ToCommand() => new(DeploymentRequestId, GatewayId, FarmId, Nodes.Select(x => x.ToInput()).ToList()); }
/// <summary>Biên bản nghiệm thu của KTV khi hoàn tất lắp đặt (tùy chọn).</summary>
public sealed class CompleteDeploymentBody { [StringLength(4000)] public string? Notes { get; init; } }
public sealed class HardwarePreparationStatusRequest { public HardwarePreparationStatus Status { get; init; } public string? NodeId { get; init; } public int? LoRaAddress { get; init; } public string? BoardProfile { get; init; } [StringLength(2000)] public string? Notes { get; init; } }
public sealed class HardwareConnectivityCheckRequest { public bool Passed { get; init; } [Required, StringLength(2000)] public string Evidence { get; init; } = ""; }
public sealed class FirmwareInstallationRequest { [Required] public Guid FirmwareReleaseId { get; init; } public FirmwareUploadMethod UploadMethod { get; init; } public FirmwareInstallationResult Result { get; init; } public string? BoardProfile { get; init; } public string? BootloaderProfile { get; init; } public string? ErrorMessage { get; init; } public string? Notes { get; init; } }
public sealed class SensorRequest { [Required] public string SensorType { get; init; } = ""; public string? Pin { get; init; } public string? Model { get; init; } public string? Interface { get; init; } [Required] public string Unit { get; init; } = ""; public decimal? MinValue { get; init; } public decimal? MaxValue { get; init; } [Range(10, 3600)] public int SamplingIntervalSec { get; init; } = 60; internal SensorInput ToInput() => new(SensorType, Pin, Model, Interface, Unit, MinValue, MaxValue, SamplingIntervalSec); }
public sealed class SensorConfigurationRequest { [Required, MinLength(1)] public List<SensorRequest> Sensors { get; init; } = []; }
public sealed class ActuatorRequest { [Required] public string ActuatorType { get; init; } = ""; [Range(1, 8)] public int RelayChannel { get; init; } public decimal? RatedPowerWatt { get; init; } public decimal? FlowRateLitersPerMinute { get; init; } [Range(1, 30)] public int MaxDurationMinutes { get; init; } internal ActuatorInput ToInput() => new(ActuatorType, RelayChannel, RatedPowerWatt, MaxDurationMinutes, FlowRateLitersPerMinute); }
public sealed class ActuatorConfigurationRequest { [Required, MinLength(1)] public List<ActuatorRequest> Actuators { get; init; } = []; }
public sealed class DeviceComponentConfigurationRequest { [Required] public List<DeviceComponentRequest> Components { get; init; } = []; }
public sealed class DeviceComponentRequest { public Guid HardwareItemId { get; init; } public string ComponentType { get; init; } = string.Empty; public int Quantity { get; init; } = 1; public string? Unit { get; init; } public string? Notes { get; init; } }
public sealed class AssignDeviceRequest { [StringLength(1000)] public string? InstallationNotes { get; init; } public decimal? GpsLatitude { get; init; } public decimal? GpsLongitude { get; init; } }
public sealed class UnassignDeviceRequest { [Required, StringLength(1000)] public string Reason { get; init; } = ""; }
public sealed class DiagnoseRequest { [Required] public string Action { get; init; } = ""; public decimal? NewFrequencyChannel { get; init; } public int? IncreaseTxPowerDbm { get; init; } }
public sealed class GatewayEnrollmentRequest { public Guid TechnicianUserId { get; init; } [Required] public Guid HardwareItemId { get; init; } [Required] public string MacAddress { get; init; } = ""; [Required] public string ChipId { get; init; } = ""; [Required] public string GatewaySerial { get; init; } = ""; [Required] public string BootstrapToken { get; init; } = ""; [Required] public string BootstrapFirmwareVersion { get; init; } = ""; internal GatewayEnrollmentCommand ToCommand() => new(HardwareItemId, MacAddress, ChipId, GatewaySerial, BootstrapToken, BootstrapFirmwareVersion); }
public sealed class GatewayEnrollmentHandshakeRequest { [Required] public string MacAddress { get; init; } = ""; [Required] public string ChipId { get; init; } = ""; [Required] public string BootstrapToken { get; init; } = ""; internal GatewayEnrollmentHandshakeCommand ToCommand() => new(MacAddress, ChipId, BootstrapToken); }
public sealed class AutoGatewayEnrollmentRequest { [Required] public string MacAddress { get; init; } = ""; [Required] public string ChipId { get; init; } = ""; public string? GatewaySerial { get; init; } [Required] public string BootstrapFirmwareVersion { get; init; } = ""; internal AutoGatewayEnrollmentCommand ToCommand() => new(MacAddress, ChipId, GatewaySerial, BootstrapFirmwareVersion); }
public sealed class GatewayOtaResultRequest { [Required] public string MacAddress { get; init; } = ""; [Required] public string Version { get; init; } = ""; [Required] public string Result { get; init; } = ""; public string? ErrorCode { get; init; } public string? ErrorMessage { get; init; } }
public sealed class ActivateGatewayEnrollmentRequest { [Required] public Guid FarmId { get; init; } [Required] public Guid DeploymentRequestId { get; init; } [Required] public string FrequencyBand { get; init; } = ""; internal ActivateGatewayEnrollmentCommand ToCommand() => new(FarmId, DeploymentRequestId, FrequencyBand); }
