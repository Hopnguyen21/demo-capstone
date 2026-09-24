using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartFarm.Api.Extensions;
using SmartFarm.Application.Features.Reports;

namespace SmartFarm.Api.Controllers;

[ApiController, Authorize(Roles = "FarmOwner")]
public sealed class ReportsController(IReportService reports) : ControllerBase
{
    [HttpGet("api/v1/farms/{farmId:guid}/report/overview")] // API catalog #91
    public async Task<ActionResult<FarmOverviewReport>> Overview(Guid farmId, CancellationToken ct) => Ok(await reports.OverviewAsync(User.GetUserId(), User.GetTenantId(), farmId, ct));
    [HttpGet("api/v1/zones/{zoneId:guid}/report/season-summary")] // API catalog #92
    public async Task<ActionResult<SeasonSummaryReport>> Season(Guid zoneId, CancellationToken ct) => Ok(await reports.SeasonSummaryAsync(User.GetUserId(), User.GetTenantId(), zoneId, ct));
    [HttpGet("api/v1/farms/{farmId:guid}/report/water-usage")] // API catalog #93
    public async Task<ActionResult<ResourceUsageReport>> Water(Guid farmId, DateTime? fromUtc, DateTime? toUtc, CancellationToken ct) => Ok(await reports.WaterAsync(User.GetUserId(), User.GetTenantId(), farmId, fromUtc, toUtc, ct));
    [HttpGet("api/v1/farms/{farmId:guid}/report/electricity")] // API catalog #94
    public async Task<ActionResult<ResourceUsageReport>> Electricity(Guid farmId, DateTime? fromUtc, DateTime? toUtc, CancellationToken ct) => Ok(await reports.ElectricityAsync(User.GetUserId(), User.GetTenantId(), farmId, fromUtc, toUtc, ct));
    [HttpGet("api/v1/farms/{farmId:guid}/report/inventory")] // REPORT-V1-01
    public async Task<ActionResult<InventoryReport>> Inventory(Guid farmId, DateTime? fromUtc, DateTime? toUtc, CancellationToken ct) => Ok(await reports.InventoryAsync(User.GetUserId(), User.GetTenantId(), farmId, fromUtc, toUtc, ct));
    [HttpGet("api/v1/farms/{farmId:guid}/report/tasks")] // REPORT-V1-02
    public async Task<ActionResult<TaskReport>> Tasks(Guid farmId, DateTime? fromUtc, DateTime? toUtc, CancellationToken ct) => Ok(await reports.TasksAsync(User.GetUserId(), User.GetTenantId(), farmId, fromUtc, toUtc, ct));
    [HttpGet("api/v1/farms/{farmId:guid}/report/maintenance")] // REPORT-V1-03
    public async Task<ActionResult<MaintenanceReport>> Maintenance(Guid farmId, DateTime? fromUtc, DateTime? toUtc, CancellationToken ct) => Ok(await reports.MaintenanceAsync(User.GetUserId(), User.GetTenantId(), farmId, fromUtc, toUtc, ct));
}
