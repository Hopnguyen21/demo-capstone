using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartFarm.Api.Extensions;
using SmartFarm.Application.Features.Platform;

namespace SmartFarm.Api.Controllers;

[ApiController]
[Authorize]
public sealed class PlatformFeaturesController(
    IPlatformAdminService adminService,
    IQuotationService quotationService,
    IGisService gisService,
    IFarmWizardService farmWizardService,
    IWeatherService weatherService,
    IFarmerService farmerService,
    IScheduleSyncService scheduleSyncService,
    IControlAutomationService controlAutomationService) : ControllerBase
{
    // ─── 1. Audit Logs ────────────────────────────────────────────────────────
    [HttpGet("api/v1/audit-logs")]
    [Authorize(Roles = "PlatformAdmin")]
    public async Task<ActionResult<AuditLogPagedResult>> GetAuditLogs(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null,
        [FromQuery] string? action = null,
        [FromQuery] string? entity = null,
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null,
        CancellationToken ct = default)
    {
        return Ok(await adminService.GetAuditLogsAsync(page, pageSize, search, action, entity, fromDate, toDate, ct));
    }

    // ─── 2. System Health Report ──────────────────────────────────────────────
    [HttpGet("api/v1/reports/system-health")]
    [Authorize(Roles = "PlatformAdmin")]
    public async Task<ActionResult<SystemHealthView>> GetSystemHealth(CancellationToken ct)
    {
        return Ok(await adminService.GetSystemHealthAsync(ct));
    }

    // ─── 3. Platform Settings ─────────────────────────────────────────────────
    [HttpGet("api/v1/platform/settings")]
    [Authorize(Roles = "PlatformAdmin")]
    public async Task<ActionResult<IReadOnlyList<PlatformSettingView>>> GetSettings(CancellationToken ct)
    {
        return Ok(await adminService.GetSettingsAsync(ct));
    }

    [HttpPut("api/v1/platform/settings")]
    [Authorize(Roles = "PlatformAdmin")]
    public async Task<ActionResult<IReadOnlyList<PlatformSettingView>>> UpdateSettings(
        [FromBody] IReadOnlyList<UpdatePlatformSettingItem> updates,
        CancellationToken ct)
    {
        return Ok(await adminService.UpdateSettingsAsync(updates, User.GetUserId(), ct));
    }

    // ─── 4. Platform Hardware Items (Central Catalog & Inventory) ─────────────
    [HttpGet("api/v1/platform/hardware-items")]
    [Authorize(Roles = "PlatformAdmin,PlatformTechnician")]
    public async Task<ActionResult<IReadOnlyList<PlatformHardwareItemView>>> ListHardwareItems(CancellationToken ct)
    {
        return Ok(await adminService.ListHardwareItemsAsync(ct));
    }

    [HttpPost("api/v1/platform/hardware-items")]
    [Authorize(Roles = "PlatformAdmin")]
    public async Task<ActionResult<PlatformHardwareItemView>> CreateHardwareItem(
        [FromBody] CreateHardwareItemCommand command,
        CancellationToken ct)
    {
        var result = await adminService.CreateHardwareItemAsync(command, ct);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    [HttpPut("api/v1/platform/hardware-items/{id:guid}")]
    [Authorize(Roles = "PlatformAdmin")]
    public async Task<ActionResult<PlatformHardwareItemView>> UpdateHardwareItem(
        Guid id,
        [FromBody] UpdateHardwareItemCommand command,
        CancellationToken ct)
    {
        return Ok(await adminService.UpdateHardwareItemAsync(id, command, ct));
    }

    [HttpDelete("api/v1/platform/hardware-items/{id:guid}")]
    [Authorize(Roles = "PlatformAdmin")]
    public async Task<IActionResult> DeleteHardwareItem(Guid id, CancellationToken ct)
    {
        await adminService.DeleteHardwareItemAsync(id, ct);
        return NoContent();
    }

    // ─── 5. Global Growth Profiles ────────────────────────────────────────────
    [HttpGet("api/v1/growth-profiles")]
    [Authorize(Roles = "PlatformAdmin,FarmOwner")]
    public async Task<ActionResult<IReadOnlyList<AllGrowthProfileView>>> GetAllGrowthProfiles(
        [FromQuery] bool? isSystemDefined = null,
        [FromQuery] string? search = null,
        CancellationToken ct = default)
    {
        return Ok(await adminService.GetAllGrowthProfilesAsync(isSystemDefined, search, ct));
    }

    // ─── 6. Service Request Quotations & Contracts ────────────────────────────
    [HttpPost("api/v1/service-requests/{id:guid}/quotation")]
    [Authorize(Roles = "PlatformTechnician")]
    public async Task<ActionResult<QuotationView>> CreateQuotation(
        Guid id,
        [FromBody] CreateQuotationCommand command,
        CancellationToken ct)
    {
        var result = await quotationService.CreateAsync(User.GetUserId(), id, command, ct);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    [HttpGet("api/v1/service-requests/{id:guid}/quotation")]
    [Authorize(Roles = "PlatformTechnician,FarmOwner,PlatformAdmin")]
    public async Task<ActionResult<QuotationView>> GetQuotation(Guid id, CancellationToken ct)
    {
        return Ok(await quotationService.GetAsync(User.GetUserId(), id, ct));
    }

    [HttpPost("api/v1/service-requests/{id:guid}/sign-contract-deposit")]
    [Authorize(Roles = "FarmOwner")]
    public async Task<ActionResult<ServiceRequestPaymentView>> SignContractDeposit(
        Guid id,
        [FromBody] SignContractDepositCommand command,
        CancellationToken ct)
    {
        return Ok(await quotationService.SignContractDepositAsync(User.GetUserId(), id, command, ct));
    }

    [HttpPost("api/v1/service-requests/{id:guid}/sign-acceptance-final")]
    [Authorize(Roles = "FarmOwner")]
    public async Task<ActionResult<ServiceRequestPaymentView>> SignAcceptanceFinal(
        Guid id,
        [FromBody] SignAcceptanceFinalCommand command,
        CancellationToken ct)
    {
        return Ok(await quotationService.SignAcceptanceFinalAsync(User.GetUserId(), id, command, ct));
    }

    // ─── 7. GIS Node Placement & Mapping ──────────────────────────────────────
    [HttpPut("api/v1/zones/{zoneId:guid}/devices/bulk-locations")]
    [Authorize(Roles = "PlatformTechnician")]
    public async Task<IActionResult> BulkUpdateNodeLocations(
        Guid zoneId,
        [FromBody] BulkUpdateNodeLocationsCommand command,
        CancellationToken ct)
    {
        await gisService.BulkUpdateNodeLocationsAsync(User.GetUserId(), zoneId, command, ct);
        return NoContent();
    }

    [HttpGet("api/v1/zones/{zoneId:guid}/devices/map-locations")]
    public async Task<ActionResult<IReadOnlyList<DeviceMapLocationView>>> GetMapLocations(Guid zoneId, CancellationToken ct)
    {
        return Ok(await gisService.GetMapLocationsAsync(User.GetUserId(), zoneId, ct));
    }

    // ─── 8. Technician Spare Parts ────────────────────────────────────────────
    [HttpGet("api/v1/platform/technicians/me/spare-parts")]
    [Authorize(Roles = "PlatformTechnician")]
    public async Task<ActionResult<IReadOnlyList<PlatformHardwareItemView>>> GetMySpareParts(CancellationToken ct)
    {
        return Ok(await farmerService.GetMySparePartsAsync(User.GetUserId(), ct));
    }

    // ─── 9. Create Farm Wizard (Atomic Bulk Setup) ────────────────────────────
    [HttpPost("api/v1/farms/wizard-setup")]
    [Authorize(Roles = "FarmOwner")]
    public async Task<ActionResult<FarmWizardResult>> WizardSetup(
        [FromBody] FarmWizardSetupCommand command,
        CancellationToken ct)
    {
        var result = await farmWizardService.SetupAsync(User.GetUserId(), User.GetTenantId(), command, ct);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    // ─── 10. Farm Weather Forecast ────────────────────────────────────────────
    [HttpGet("api/v1/farms/{farmId:guid}/weather")]
    public async Task<ActionResult<FarmWeatherView>> GetFarmWeather(Guid farmId, CancellationToken ct)
    {
        return Ok(await weatherService.GetFarmWeatherAsync(User.GetUserId(), User.GetTenantId(), farmId, ct));
    }

    // ─── 11. Farmer Tasks & Assigned Zones ────────────────────────────────────
    [HttpGet("api/v1/farmer/my-tasks")]
    [Authorize(Roles = "Farmer")]
    public async Task<ActionResult<IReadOnlyList<object>>> GetFarmerTasks(CancellationToken ct)
    {
        return Ok(await farmerService.GetMyTasksAsync(User.GetUserId(), ct));
    }

    [HttpPut("api/v1/farmer/tasks/{taskId:guid}/complete")]
    [Authorize(Roles = "Farmer")]
    public async Task<IActionResult> CompleteFarmerTask(
        Guid taskId,
        [FromBody] FarmerCompleteTaskCommand command,
        CancellationToken ct)
    {
        await farmerService.CompleteTaskAsync(User.GetUserId(), taskId, command, ct);
        return NoContent();
    }

    [HttpGet("api/v1/farmer/my-zones")]
    [Authorize(Roles = "Farmer")]
    public async Task<ActionResult<IReadOnlyList<FarmerZoneView>>> GetFarmerZones(CancellationToken ct)
    {
        return Ok(await farmerService.GetMyZonesAsync(User.GetUserId(), ct));
    }

    // ─── 12. Schedule Sync from Crop Profile ──────────────────────────────────
    [HttpPost("api/v1/zones/{zoneId:guid}/schedules/sync-from-crop")]
    [Authorize(Roles = "FarmOwner")]
    public async Task<ActionResult<IReadOnlyList<object>>> SyncCropSchedule(
        Guid zoneId,
        [FromBody] SyncCropScheduleRequest request,
        CancellationToken ct)
    {
        var result = await scheduleSyncService.SyncFromCropAsync(User.GetUserId(), User.GetTenantId(), zoneId, request.CropId, request.ActuatorId, ct);
        return Ok(result);
    }

    // ─── 13. Emergency Stop (All Actuators) ──────────────────────────────────
    [HttpPost("api/v1/control/emergency-stop")]
    [Authorize(Roles = "FarmOwner,Farmer")]
    public async Task<ActionResult<EmergencyStopResult>> EmergencyStop(
        [FromBody] EmergencyStopRequest request,
        CancellationToken ct)
    {
        var result = await controlAutomationService.EmergencyStopAllAsync(User.GetUserId(), User.GetTenantId(), request.ZoneId, ct);
        return Ok(result);
    }

    // ─── 14. Environmental Target Configurations ──────────────────────────────
    [HttpGet("api/v1/control/environmental-configs")]
    [Authorize(Roles = "FarmOwner,Farmer,PlatformAdmin")]
    public async Task<ActionResult<IReadOnlyList<EnvironmentalTargetConfigView>>> GetEnvironmentalConfigs(
        [FromQuery] Guid? zoneId = null,
        CancellationToken ct = default)
    {
        return Ok(await controlAutomationService.GetEnvironmentalConfigsAsync(User.GetUserId(), User.GetTenantId(), zoneId, ct));
    }

    [HttpPut("api/v1/control/environmental-configs")]
    [Authorize(Roles = "FarmOwner")]
    public async Task<ActionResult<EnvironmentalTargetConfigView>> UpdateEnvironmentalConfig(
        [FromBody] UpdateEnvironmentalTargetConfigCommand command,
        CancellationToken ct)
    {
        return Ok(await controlAutomationService.UpdateEnvironmentalConfigAsync(User.GetUserId(), User.GetTenantId(), command, ct));
    }
}

public sealed class EmergencyStopRequest
{
    public Guid? ZoneId { get; init; }
    public string? Notes { get; init; }
}

public sealed class SyncCropScheduleRequest
{
    [Required]
    public Guid CropId { get; init; }

    [Required]
    public Guid ActuatorId { get; init; }
}

