using Microsoft.EntityFrameworkCore;
using SmartFarm.Application.Common.Exceptions;
using SmartFarm.Application.Features.Platform;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;

namespace SmartFarm.Infrastructure.Platform;

public sealed class FieldSurveyReportService(SmartFarmDbContext db) : IFieldSurveyReportService
{
    public async Task<IReadOnlyList<FieldSurveyReportView>> GetReportsAsync(Guid userId, FieldSurveyReportFilter filter, CancellationToken ct)
    {
        var caller = await db.AppUsers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == userId && x.Status == AccountStatus.Active, ct)
            ?? throw new AuthorizationException();

        var query = db.FieldSurveyReports
            .Include(r => r.Farm)
            .Include(r => r.ServiceRequest)
            .Include(r => r.Zone)
            .Include(r => r.CreatedByUser)
            .AsNoTracking()
            .AsQueryable();

        // Tenant / Role Isolation
        if (caller.Role == UserRole.FarmOwner || caller.Role == UserRole.Farmer)
        {
            query = query.Where(r => r.TenantId == caller.TenantId);
        }
        else if (caller.Role == UserRole.PlatformTechnician)
        {
            // Technicians can view reports they created OR linked to service requests assigned to them OR across tenant/farms
            query = query.Where(r => r.CreatedByUserId == userId
                || (r.ServiceRequest != null && r.ServiceRequest.AssignedTechnicianId == userId)
                || r.TenantId == caller.TenantId
                || caller.Role == UserRole.PlatformTechnician); // Technicians are platform-level staff
        }

        // Apply filters
        if (filter.FarmId.HasValue && filter.FarmId.Value != Guid.Empty)
        {
            query = query.Where(r => r.FarmId == filter.FarmId.Value);
        }

        if (filter.ServiceRequestId.HasValue && filter.ServiceRequestId.Value != Guid.Empty)
        {
            query = query.Where(r => r.ServiceRequestId == filter.ServiceRequestId.Value);
        }

        if (filter.ZoneId.HasValue && filter.ZoneId.Value != Guid.Empty)
        {
            query = query.Where(r => r.ZoneId == filter.ZoneId.Value);
        }

        if (filter.FromDate.HasValue)
        {
            var fromUtc = DateTime.SpecifyKind(filter.FromDate.Value, DateTimeKind.Utc);
            query = query.Where(r => r.SurveyDate >= fromUtc);
        }

        if (filter.ToDate.HasValue)
        {
            var toUtc = DateTime.SpecifyKind(filter.ToDate.Value, DateTimeKind.Utc);
            query = query.Where(r => r.SurveyDate <= toUtc);
        }

        if (!string.IsNullOrWhiteSpace(filter.Status) && !filter.Status.Equals("ALL", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(r => r.Status == filter.Status);
        }

        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var s = filter.Search.Trim().ToLower();
            query = query.Where(r =>
                r.Title.ToLower().Contains(s) ||
                r.SurveyorName.ToLower().Contains(s) ||
                r.RepresentativeName.ToLower().Contains(s) ||
                r.Location.ToLower().Contains(s) ||
                r.Farm.Name.ToLower().Contains(s));
        }

        var list = await query
            .OrderByDescending(r => r.SurveyDate)
            .ThenByDescending(r => r.CreatedAtUtc)
            .ToListAsync(ct);

        return list.Select(MapToView).ToList();
    }

    public async Task<FieldSurveyReportView> GetReportByIdAsync(Guid userId, Guid reportId, CancellationToken ct)
    {
        var caller = await db.AppUsers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == userId && x.Status == AccountStatus.Active, ct)
            ?? throw new AuthorizationException();

        var report = await db.FieldSurveyReports
            .Include(r => r.Farm)
            .Include(r => r.ServiceRequest)
            .Include(r => r.Zone)
            .Include(r => r.CreatedByUser)
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == reportId, ct)
            ?? throw new ResourceNotFoundException("Field survey report not found.");

        if ((caller.Role == UserRole.FarmOwner || caller.Role == UserRole.Farmer) && report.TenantId != caller.TenantId)
        {
            throw new AuthorizationException("You do not have permission to view this report.");
        }

        return MapToView(report);
    }

    public async Task<FieldSurveyReportView?> GetReportByServiceRequestIdAsync(Guid userId, Guid serviceRequestId, CancellationToken ct)
    {
        var caller = await db.AppUsers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == userId && x.Status == AccountStatus.Active, ct)
            ?? throw new AuthorizationException();

        var report = await db.FieldSurveyReports
            .Include(r => r.Farm)
            .Include(r => r.ServiceRequest)
            .Include(r => r.Zone)
            .Include(r => r.CreatedByUser)
            .AsNoTracking()
            .OrderByDescending(r => r.CreatedAtUtc)
            .FirstOrDefaultAsync(r => r.ServiceRequestId == serviceRequestId, ct);

        if (report == null) return null;

        if ((caller.Role == UserRole.FarmOwner || caller.Role == UserRole.Farmer) && report.TenantId != caller.TenantId)
        {
            throw new AuthorizationException("You do not have permission to view this report.");
        }

        return MapToView(report);
    }

    public async Task<FieldSurveyReportView> CreateReportAsync(Guid userId, CreateFieldSurveyReportCommand command, CancellationToken ct)
    {
        var caller = await db.AppUsers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == userId && x.Status == AccountStatus.Active, ct)
            ?? throw new AuthorizationException();

        if (string.IsNullOrWhiteSpace(command.Title))
            throw new RequestValidationException("Title", "Tiêu đề phiếu khảo sát không được để trống.");

        var farm = await db.Farms.AsNoTracking().FirstOrDefaultAsync(f => f.Id == command.FarmId, ct)
            ?? throw new ResourceNotFoundException("Farm not found.");

        if (caller.Role == UserRole.FarmOwner && farm.TenantId != caller.TenantId)
            throw new AuthorizationException("Cannot create survey report for another tenant's farm.");

        // Check if there is an existing report for this ServiceRequest
        if (command.ServiceRequestId.HasValue && command.ServiceRequestId.Value != Guid.Empty)
        {
            var existingReport = await db.FieldSurveyReports.FirstOrDefaultAsync(r => r.ServiceRequestId == command.ServiceRequestId.Value, ct);
            if (existingReport != null)
            {
                // Prevent duplicate creation when user clicks save multiple times: update existing
                existingReport.Title = command.Title.Trim();
                existingReport.SurveyDate = DateTime.SpecifyKind(command.SurveyDate, DateTimeKind.Utc);
                existingReport.Location = command.Location?.Trim() ?? string.Empty;
                existingReport.SurveyorName = command.SurveyorName?.Trim() ?? caller.FullName;
                existingReport.RepresentativeName = command.RepresentativeName?.Trim() ?? string.Empty;
                existingReport.FarmOverview = command.FarmOverview ?? string.Empty;
                existingReport.CropAndSeasonStatus = command.CropAndSeasonStatus ?? string.Empty;
                existingReport.CultivationProcess = command.CultivationProcess ?? string.Empty;
                existingReport.EnvironmentalMonitoring = command.EnvironmentalMonitoring ?? string.Empty;
                existingReport.EnvironmentalThresholdNeeds = command.EnvironmentalThresholdNeeds ?? string.Empty;
                existingReport.EquipmentAndDataCollection = command.EquipmentAndDataCollection ?? string.Empty;
                existingReport.ManagementAndPermissions = command.ManagementAndPermissions ?? string.Empty;
                existingReport.DifficultiesAndNeeds = command.DifficultiesAndNeeds ?? string.Empty;
                existingReport.TeamAssessment = command.TeamAssessment ?? string.Empty;
                existingReport.Status = string.IsNullOrWhiteSpace(command.Status) ? "Submitted" : command.Status;
                existingReport.UpdatedAtUtc = DateTime.UtcNow;

                await db.SaveChangesAsync(ct);
                return await GetReportByIdAsync(userId, existingReport.Id, ct);
            }
        }

        var report = new FieldSurveyReport
        {
            FarmId = farm.Id,
            TenantId = farm.TenantId,
            ServiceRequestId = command.ServiceRequestId.HasValue && command.ServiceRequestId.Value != Guid.Empty ? command.ServiceRequestId.Value : null,
            ZoneId = command.ZoneId.HasValue && command.ZoneId.Value != Guid.Empty ? command.ZoneId.Value : null,
            Title = command.Title.Trim(),
            SurveyDate = DateTime.SpecifyKind(command.SurveyDate, DateTimeKind.Utc),
            Location = command.Location?.Trim() ?? farm.LocationText ?? string.Empty,
            SurveyorName = command.SurveyorName?.Trim() ?? caller.FullName,
            RepresentativeName = command.RepresentativeName?.Trim() ?? string.Empty,
            FarmOverview = command.FarmOverview ?? string.Empty,
            CropAndSeasonStatus = command.CropAndSeasonStatus ?? string.Empty,
            CultivationProcess = command.CultivationProcess ?? string.Empty,
            EnvironmentalMonitoring = command.EnvironmentalMonitoring ?? string.Empty,
            EnvironmentalThresholdNeeds = command.EnvironmentalThresholdNeeds ?? string.Empty,
            EquipmentAndDataCollection = command.EquipmentAndDataCollection ?? string.Empty,
            ManagementAndPermissions = command.ManagementAndPermissions ?? string.Empty,
            DifficultiesAndNeeds = command.DifficultiesAndNeeds ?? string.Empty,
            TeamAssessment = command.TeamAssessment ?? string.Empty,
            Status = string.IsNullOrWhiteSpace(command.Status) ? "Submitted" : command.Status,
            CreatedByUserId = userId,
            CreatedAtUtc = DateTime.UtcNow
        };

        db.FieldSurveyReports.Add(report);
        await db.SaveChangesAsync(ct);

        return await GetReportByIdAsync(userId, report.Id, ct);
    }

    public async Task<FieldSurveyReportView> UpdateReportAsync(Guid userId, Guid reportId, UpdateFieldSurveyReportCommand command, CancellationToken ct)
    {
        var caller = await db.AppUsers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == userId && x.Status == AccountStatus.Active, ct)
            ?? throw new AuthorizationException();

        var report = await db.FieldSurveyReports.FirstOrDefaultAsync(r => r.Id == reportId, ct)
            ?? throw new ResourceNotFoundException("Field survey report not found.");

        // Authorization check
        if (caller.Role != UserRole.PlatformAdmin)
        {
            if (report.CreatedByUserId != userId && caller.Role != UserRole.PlatformTechnician)
                throw new AuthorizationException("Only the technician who authored the report or platform admin can update it.");

            if (caller.Role == UserRole.FarmOwner && report.TenantId != caller.TenantId)
                throw new AuthorizationException("Cannot edit report from another tenant.");
        }

        if (string.IsNullOrWhiteSpace(command.Title))
            throw new RequestValidationException("Title", "Tiêu đề phiếu khảo sát không được để trống.");

        report.Title = command.Title.Trim();
        report.SurveyDate = DateTime.SpecifyKind(command.SurveyDate, DateTimeKind.Utc);
        report.Location = command.Location?.Trim() ?? string.Empty;
        report.SurveyorName = command.SurveyorName?.Trim() ?? report.SurveyorName;
        report.RepresentativeName = command.RepresentativeName?.Trim() ?? string.Empty;
        report.FarmOverview = command.FarmOverview ?? string.Empty;
        report.CropAndSeasonStatus = command.CropAndSeasonStatus ?? string.Empty;
        report.CultivationProcess = command.CultivationProcess ?? string.Empty;
        report.EnvironmentalMonitoring = command.EnvironmentalMonitoring ?? string.Empty;
        report.EnvironmentalThresholdNeeds = command.EnvironmentalThresholdNeeds ?? string.Empty;
        report.EquipmentAndDataCollection = command.EquipmentAndDataCollection ?? string.Empty;
        report.ManagementAndPermissions = command.ManagementAndPermissions ?? string.Empty;
        report.DifficultiesAndNeeds = command.DifficultiesAndNeeds ?? string.Empty;
        report.TeamAssessment = command.TeamAssessment ?? string.Empty;
        if (!string.IsNullOrWhiteSpace(command.Status))
        {
            report.Status = command.Status;
        }
        report.UpdatedAtUtc = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);

        return await GetReportByIdAsync(userId, report.Id, ct);
    }

    public async Task DeleteReportAsync(Guid userId, Guid reportId, CancellationToken ct)
    {
        var caller = await db.AppUsers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == userId && x.Status == AccountStatus.Active, ct)
            ?? throw new AuthorizationException();

        var report = await db.FieldSurveyReports.FirstOrDefaultAsync(r => r.Id == reportId, ct)
            ?? throw new ResourceNotFoundException("Field survey report not found.");

        if (caller.Role != UserRole.PlatformAdmin && report.CreatedByUserId != userId)
        {
            throw new AuthorizationException("Only the creator technician or platform admin can delete this report.");
        }

        db.FieldSurveyReports.Remove(report);
        await db.SaveChangesAsync(ct);
    }

    private static FieldSurveyReportView MapToView(FieldSurveyReport r) => new(
        r.Id,
        r.FarmId,
        r.Farm?.Name ?? "—",
        r.TenantId,
        r.ServiceRequestId,
        r.ServiceRequest?.Description ?? r.ServiceRequest?.FailureCode,
        r.ZoneId,
        r.Zone?.Name,
        r.Title,
        r.SurveyDate,
        r.Location,
        r.SurveyorName,
        r.RepresentativeName,
        r.FarmOverview,
        r.CropAndSeasonStatus,
        r.CultivationProcess,
        r.EnvironmentalMonitoring,
        r.EnvironmentalThresholdNeeds,
        r.EquipmentAndDataCollection,
        r.ManagementAndPermissions,
        r.DifficultiesAndNeeds,
        r.TeamAssessment,
        r.Status,
        r.CreatedByUserId,
        r.CreatedByUser?.FullName ?? "Kỹ thuật viên",
        r.CreatedAtUtc,
        r.UpdatedAtUtc
    );
}
