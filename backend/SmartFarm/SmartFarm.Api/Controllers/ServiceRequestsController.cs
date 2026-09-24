using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartFarm.Api.Extensions;
using SmartFarm.Application.Features.Finance;
using SmartFarm.Domain.Enums;

namespace SmartFarm.Api.Controllers;

[ApiController, Authorize]
public sealed class ServiceRequestsController(IServiceRequestService service) : ControllerBase
{
    [HttpPost("api/v1/farms/{farmId:guid}/service-requests"), Authorize(Roles = "FarmOwner")] // SERVICE-V1-01
    public async Task<ActionResult<ServiceRequestView>> Create(Guid farmId, CreateServiceRequest r, CancellationToken ct) { var x = await service.CreateAsync(User.GetUserId(), User.GetTenantId(), farmId, new(r.ZoneId, r.DeviceId, r.FailureCode, r.Description), ct); return Created($"/api/v1/service-requests/{x.Id}", x); }
    [HttpGet("api/v1/service-requests"), Authorize(Roles = "FarmOwner,PlatformAdmin,PlatformTechnician")] // SERVICE-V1-02
    public async Task<ActionResult<IReadOnlyList<ServiceRequestView>>> List(CancellationToken ct) => Ok(await service.ListAsync(User.GetUserId(), User.GetOptionalTenantId(), ct));
    [HttpGet("api/v1/service-requests/{id:guid}"), Authorize(Roles = "FarmOwner,PlatformAdmin,PlatformTechnician")] // SERVICE-V1-03
    public async Task<ActionResult<ServiceRequestView>> Get(Guid id, CancellationToken ct) => Ok(await service.GetAsync(User.GetUserId(), User.GetOptionalTenantId(), id, ct));
    [HttpPost("api/v1/service-requests/{id:guid}/assign"), Authorize(Roles = "PlatformAdmin")] // SERVICE-V1-04
    public async Task<ActionResult<ServiceRequestView>> Assign(Guid id, AssignServiceRequest r, CancellationToken ct) => Ok(await service.AssignAsync(User.GetUserId(), id, new(r.TechnicianUserId, r.Notes), ct));
    [HttpPost("api/v1/service-requests/{id:guid}/accept"), Authorize(Roles = "PlatformTechnician")] // SERVICE-V1-05
    public async Task<ActionResult<ServiceRequestView>> Accept(Guid id, CancellationToken ct) => Ok(await service.AcceptAsync(User.GetUserId(), id, ct));
    [HttpPost("api/v1/service-requests/{id:guid}/diagnosis"), Authorize(Roles = "PlatformTechnician")] // SERVICE-V1-06
    public async Task<ActionResult<ServiceRequestView>> Diagnose(Guid id, DiagnoseServiceRequest r, CancellationToken ct) => Ok(await service.DiagnoseAsync(User.GetUserId(), id, new(r.InspectionNotes, r.Diagnosis, r.ResolutionAction), ct));
    [HttpPost("api/v1/service-requests/{id:guid}/work"), Authorize(Roles = "PlatformTechnician")] // SERVICE-V1-07
    public async Task<ActionResult<ServiceRequestView>> Work(Guid id, ServiceWorkRequest r, CancellationToken ct) => Ok(await service.RecordWorkAsync(User.GetUserId(), id, new(r.WorkPerformed), ct));
    [HttpPost("api/v1/service-requests/{id:guid}/replacement"), Authorize(Roles = "PlatformTechnician")]
    public async Task<ActionResult<ServiceRequestView>> Replace(Guid id, ReplaceServiceDeviceRequest r, CancellationToken ct) => Ok(await service.ReplaceAsync(User.GetUserId(), id, new(r.NewDeviceId, r.Notes), ct));
    [HttpPost("api/v1/zones/{zoneId:guid}/devices/{oldDeviceId:guid}/hot-swap"), Authorize(Roles = "PlatformTechnician")] // API catalog #95
    public async Task<ActionResult<ServiceRequestView>> HotSwap(Guid zoneId, Guid oldDeviceId, ReplaceServiceDeviceRequest r, CancellationToken ct) => Ok(await service.HotSwapAsync(User.GetUserId(), zoneId, oldDeviceId, r.ServiceRequestId, new(r.NewDeviceId, r.Notes), ct));
    [HttpPost("api/v1/service-requests/{id:guid}/connection-tests"), Authorize(Roles = "PlatformTechnician")] // SERVICE-V1-08
    public async Task<ActionResult<ServiceRequestView>> Test(Guid id, ServiceConnectionTestRequest r, CancellationToken ct) => Ok(await service.TestAsync(User.GetUserId(), id, new(r.Succeeded, r.Rssi, r.Snr, r.RoundTripLatencyMs, r.ObservedAtUtc, r.ErrorCode, r.ErrorMessage), ct));
    [HttpPost("api/v1/service-requests/{id:guid}/close"), Authorize(Roles = "PlatformTechnician")] // SERVICE-V1-09
    public async Task<ActionResult<ServiceRequestView>> Close(Guid id, CancellationToken ct) => Ok(await service.CloseAsync(User.GetUserId(), id, ct));
}

public sealed class CreateServiceRequest { public Guid ZoneId { get; init; } public Guid DeviceId { get; init; } [Required, StringLength(100)] public string FailureCode { get; init; } = ""; [Required, StringLength(2000)] public string Description { get; init; } = ""; }
public sealed class AssignServiceRequest { public Guid TechnicianUserId { get; init; } [StringLength(1000)] public string? Notes { get; init; } }
public sealed class DiagnoseServiceRequest { [Required, StringLength(2000)] public string InspectionNotes { get; init; } = ""; [Required, StringLength(2000)] public string Diagnosis { get; init; } = ""; public ServiceResolutionAction ResolutionAction { get; init; } }
public sealed class ServiceWorkRequest { [Required, StringLength(2000)] public string WorkPerformed { get; init; } = ""; }
public sealed class ReplaceServiceDeviceRequest { public Guid ServiceRequestId { get; init; } public Guid NewDeviceId { get; init; } [StringLength(2000)] public string? Notes { get; init; } }
public sealed class ServiceConnectionTestRequest { public bool Succeeded { get; init; } public decimal? Rssi { get; init; } public decimal? Snr { get; init; } public int? RoundTripLatencyMs { get; init; } public DateTime ObservedAtUtc { get; init; } [StringLength(100)] public string? ErrorCode { get; init; } [StringLength(1000)] public string? ErrorMessage { get; init; } }
