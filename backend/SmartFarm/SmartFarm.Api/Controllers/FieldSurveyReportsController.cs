using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartFarm.Api.Extensions;
using SmartFarm.Application.Features.Platform;

namespace SmartFarm.Api.Controllers;

[ApiController]
[Authorize]
public sealed class FieldSurveyReportsController(IFieldSurveyReportService reportService) : ControllerBase
{
    [HttpGet("api/v1/field-survey-reports")]
    [Authorize(Roles = "PlatformAdmin,PlatformTechnician,FarmOwner,Farmer")]
    public async Task<ActionResult<IReadOnlyList<FieldSurveyReportView>>> GetReports(
        [FromQuery] Guid? farmId,
        [FromQuery] Guid? serviceRequestId,
        [FromQuery] Guid? zoneId,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate,
        [FromQuery] string? status,
        [FromQuery] string? search,
        CancellationToken ct)
    {
        var filter = new FieldSurveyReportFilter(farmId, serviceRequestId, zoneId, fromDate, toDate, status, search);
        var reports = await reportService.GetReportsAsync(User.GetUserId(), filter, ct);
        return Ok(reports);
    }

    [HttpGet("api/v1/field-survey-reports/{id:guid}")]
    [Authorize(Roles = "PlatformAdmin,PlatformTechnician,FarmOwner,Farmer")]
    public async Task<ActionResult<FieldSurveyReportView>> GetReportById(Guid id, CancellationToken ct)
    {
        var report = await reportService.GetReportByIdAsync(User.GetUserId(), id, ct);
        return Ok(report);
    }

    [HttpGet("api/v1/field-survey-reports/by-service-request/{serviceRequestId:guid}")]
    [Authorize(Roles = "PlatformAdmin,PlatformTechnician,FarmOwner,Farmer")]
    public async Task<ActionResult<FieldSurveyReportView?>> GetReportByServiceRequest(Guid serviceRequestId, CancellationToken ct)
    {
        var report = await reportService.GetReportByServiceRequestIdAsync(User.GetUserId(), serviceRequestId, ct);
        return Ok(report);
    }

    [HttpPost("api/v1/field-survey-reports")]
    [Authorize(Roles = "PlatformAdmin,PlatformTechnician")]
    public async Task<ActionResult<FieldSurveyReportView>> CreateReport([FromBody] CreateFieldSurveyReportCommand command, CancellationToken ct)
    {
        var report = await reportService.CreateReportAsync(User.GetUserId(), command, ct);
        return CreatedAtAction(nameof(GetReportById), new { id = report.Id }, report);
    }

    [HttpPut("api/v1/field-survey-reports/{id:guid}")]
    [Authorize(Roles = "PlatformAdmin,PlatformTechnician")]
    public async Task<ActionResult<FieldSurveyReportView>> UpdateReport(Guid id, [FromBody] UpdateFieldSurveyReportCommand command, CancellationToken ct)
    {
        var report = await reportService.UpdateReportAsync(User.GetUserId(), id, command, ct);
        return Ok(report);
    }

    [HttpDelete("api/v1/field-survey-reports/{id:guid}")]
    [Authorize(Roles = "PlatformAdmin,PlatformTechnician")]
    public async Task<IActionResult> DeleteReport(Guid id, CancellationToken ct)
    {
        await reportService.DeleteReportAsync(User.GetUserId(), id, ct);
        return NoContent();
    }
}
