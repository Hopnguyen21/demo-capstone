using Microsoft.EntityFrameworkCore;
using SmartFarm.Application.Common.Exceptions;
using SmartFarm.Application.Features.Reports;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;

namespace SmartFarm.Infrastructure.Reports;

public sealed class ReportService(SmartFarmDbContext db, TimeProvider clock) : IReportService
{
    private static readonly ReportFormula WaterFormula = new("waterLiters", "sum(acknowledged TurnOn durationSeconds / 60 * actuator flowRateLitersPerMinute)", "actuator_commands + device_actuators");
    private static readonly ReportFormula ElectricityFormula = new("electricityKWh", "sum(acknowledged TurnOn durationSeconds / 3600 * actuator ratedPowerWatt / 1000)", "actuator_commands + device_actuators");

    public async Task<FarmOverviewReport> OverviewAsync(Guid owner, Guid tenant, Guid farmId, CancellationToken ct)
    {
        var farm = await OwnerFarm(owner, tenant, farmId, ct); var now = clock.GetUtcNow().UtcDateTime; var week = now.AddDays(-7); var month = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var finance = await db.FinanceTransactions.AsNoTracking().Where(x => x.TenantId == tenant && x.FarmId == farmId && x.ArchivedAtUtc == null && x.OccurredAtUtc >= month && x.OccurredAtUtc <= now).ToListAsync(ct);
        var revenue = finance.Where(x => x.TransactionType == FinanceTransactionType.Revenue).Sum(x => x.Amount); var expense = finance.Where(x => x.TransactionType == FinanceTransactionType.Expense).Sum(x => x.Amount);
        return new(farmId, farm.Name, now,
            await db.Fields.CountAsync(x => x.FarmId == farmId && x.ArchivedAtUtc == null, ct),
            await db.Zones.CountAsync(x => x.Field.FarmId == farmId && x.ArchivedAtUtc == null, ct),
            await db.PlantingSeasons.CountAsync(x => x.Zone.Field.FarmId == farmId && x.Status == PlantingSeasonStatus.InProgress, ct),
            await db.Devices.CountAsync(x => x.FarmId == farmId && x.Status == DeviceStatus.Online, ct),
            await db.Alerts.CountAsync(x => x.TenantId == tenant && x.FarmId == farmId && x.CreatedAtUtc >= week, ct),
            await db.Alerts.CountAsync(x => x.TenantId == tenant && x.FarmId == farmId && x.Status != AlertStatus.Resolved, ct),
            await db.FarmTasks.CountAsync(x => x.TenantId == tenant && x.FarmId == farmId && x.Status != FarmTaskStatus.Approved && x.Status != FarmTaskStatus.Cancelled, ct),
            await db.InventoryItems.CountAsync(x => x.TenantId == tenant && x.FarmId == farmId && x.ArchivedAtUtc == null && x.QuantityOnHand <= x.LowStockThreshold, ct),
            await db.ServiceRequests.CountAsync(x => x.TenantId == tenant && x.FarmId == farmId && x.Status != ServiceRequestStatus.Closed, ct),
            revenue, expense, revenue - expense,
            [new("alertsLast7Days", "count(alert.createdAtUtc >= generatedAtUtc - 7 days)", "alerts"), new("netCashFlowCurrentMonth", "sum(revenue) - sum(expense)", "finance_transactions")]);
    }

    public async Task<SeasonSummaryReport> SeasonSummaryAsync(Guid owner, Guid tenant, Guid zoneId, CancellationToken ct)
    {
        await Owner(owner, tenant, ct); var zone = await db.Zones.AsNoTracking().Include(x => x.Field).SingleOrDefaultAsync(x => x.Id == zoneId && x.Field.Farm.TenantId == tenant && x.ArchivedAtUtc == null, ct) ?? throw new ResourceNotFoundException("Zone was not found in the authenticated Tenant.");
        var seasons = await db.PlantingSeasons.AsNoTracking().Include(x => x.Crop).Include(x => x.Variety).Include(x => x.CurrentGrowthStage).Where(x => x.ZoneId == zoneId).OrderByDescending(x => x.Status == PlantingSeasonStatus.InProgress).ThenByDescending(x => x.StartDate).ToListAsync(ct);
        var season = seasons.FirstOrDefault() ?? throw new ResourceNotFoundException("No Planting Season exists in this Zone."); var from = season.StartDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc); var toDate = season.ActualEndDate ?? season.ExpectedEndDate; var to = toDate.ToDateTime(TimeOnly.MaxValue, DateTimeKind.Utc); if (season.Status == PlantingSeasonStatus.InProgress) to = clock.GetUtcNow().UtcDateTime;
        var commands = await Commands(zone.Field.FarmId, from, to, ct); var seasonCommands = commands.Where(x => x.ZoneId == zoneId).ToList(); var water = seasonCommands.Where(x => x.Actuator.FlowRateLitersPerMinute.HasValue).Sum(x => x.DurationSeconds / 60m * x.Actuator.FlowRateLitersPerMinute!.Value); var power = seasonCommands.Where(x => x.Actuator.RatedPowerWatt.HasValue).Sum(x => x.DurationSeconds / 3600m * x.Actuator.RatedPowerWatt!.Value / 1000m);
        var previous = seasons.Where(x => x.Id != season.Id && x.Status == PlantingSeasonStatus.Completed).OrderByDescending(x => x.ActualEndDate).FirstOrDefault();
        return new(zone.Field.FarmId, zoneId, season.Id, season.Name, season.Crop.Name, season.Variety?.Name, season.CurrentGrowthStage.Name, season.Status, season.StartDate, season.ActualEndDate, season.ActualYieldKg,
            await db.Alerts.CountAsync(x => x.TenantId == tenant && x.PlantingSeasonId == season.Id, ct), seasonCommands.Count, water, power,
            await db.InventoryTransactions.Where(x => x.TenantId == tenant && x.ZoneId == zoneId && x.MovementType == InventoryMovementType.Issue && x.CreatedAtUtc >= from && x.CreatedAtUtc <= to).SumAsync(x => x.Quantity, ct), previous?.ActualYieldKg,
            [WaterFormula, ElectricityFormula, new("materialIssuedQuantity", "sum(issue.quantity during season)", "inventory_transactions")]);
    }

    public Task<ResourceUsageReport> WaterAsync(Guid owner, Guid tenant, Guid farm, DateTime? from, DateTime? to, CancellationToken ct) => Resource(owner, tenant, farm, from, to, true, ct);
    public Task<ResourceUsageReport> ElectricityAsync(Guid owner, Guid tenant, Guid farm, DateTime? from, DateTime? to, CancellationToken ct) => Resource(owner, tenant, farm, from, to, false, ct);

    private async Task<ResourceUsageReport> Resource(Guid owner, Guid tenant, Guid farmId, DateTime? fromArg, DateTime? toArg, bool water, CancellationToken ct)
    {
        await OwnerFarm(owner, tenant, farmId, ct); var (from, to) = Range(fromArg, toArg); var commands = await Commands(farmId, from, to, ct); var zones = await db.Zones.AsNoTracking().Where(x => x.Field.FarmId == farmId).ToDictionaryAsync(x => x.Id, x => x.Name, ct);
        decimal Value(ActuatorCommand x) => water ? x.DurationSeconds / 60m * x.Actuator.FlowRateLitersPerMinute!.Value : x.DurationSeconds / 3600m * x.Actuator.RatedPowerWatt!.Value / 1000m;
        bool Rated(ActuatorCommand x) => water ? x.Actuator.FlowRateLitersPerMinute.HasValue : x.Actuator.RatedPowerWatt.HasValue;
        var buckets = commands.GroupBy(x => new { x.ZoneId, x.AcknowledgedAtUtc!.Value.Year, x.AcknowledgedAtUtc.Value.Month }).Select(g => new ResourceUsageBucket(g.Key.ZoneId, zones.GetValueOrDefault(g.Key.ZoneId, "Unknown"), g.Key.Year, g.Key.Month, g.Where(Rated).Sum(Value), g.Count(Rated), g.Count(x => !Rated(x)))).OrderBy(x => x.Year).ThenBy(x => x.Month).ThenBy(x => x.ZoneName).ToList();
        return new(farmId, water ? "WaterUsage" : "ElectricityUsage", water ? "liter" : "kWh", from, to, buckets.Sum(x => x.Value), buckets.Sum(x => x.CountedCommandCount), buckets.Sum(x => x.UnmeasuredCommandCount), buckets, [water ? WaterFormula : ElectricityFormula]);
    }

    public async Task<InventoryReport> InventoryAsync(Guid owner, Guid tenant, Guid farmId, DateTime? fromArg, DateTime? toArg, CancellationToken ct)
    {
        await OwnerFarm(owner, tenant, farmId, ct); var (from, to) = Range(fromArg, toArg); var items = await db.InventoryItems.AsNoTracking().Where(x => x.TenantId == tenant && x.FarmId == farmId && x.ArchivedAtUtc == null).OrderBy(x => x.Name).ToListAsync(ct); var moves = await db.InventoryTransactions.AsNoTracking().Where(x => x.TenantId == tenant && x.FarmId == farmId && x.CreatedAtUtc >= from && x.CreatedAtUtc <= to).ToListAsync(ct);
        var rows = items.Select(x => new InventoryReportItem(x.Id, x.Name, x.Unit, x.QuantityOnHand, x.LowStockThreshold, x.QuantityOnHand <= x.LowStockThreshold, moves.Where(m => m.InventoryItemId == x.Id && m.MovementType == InventoryMovementType.Receipt).Sum(m => m.Quantity), moves.Where(m => m.InventoryItemId == x.Id && m.MovementType == InventoryMovementType.Issue).Sum(m => m.Quantity))).ToList();
        return new(farmId, from, to, rows.Count, rows.Count(x => x.IsLowStock), rows, [new("quantityOnHand", "initial receipts + receipts - issues", "inventory_transactions / inventory_items"), new("isLowStock", "quantityOnHand <= lowStockThreshold", "inventory_items")]);
    }

    public async Task<TaskReport> TasksAsync(Guid owner, Guid tenant, Guid farmId, DateTime? fromArg, DateTime? toArg, CancellationToken ct)
    {
        await OwnerFarm(owner, tenant, farmId, ct); var (from, to) = Range(fromArg, toArg); var tasks = await db.FarmTasks.AsNoTracking().Where(x => x.TenantId == tenant && x.FarmId == farmId && x.CreatedAtUtc >= from && x.CreatedAtUtc <= to).ToListAsync(ct); var farmerIds = tasks.Select(x => x.AssignedFarmerId).Distinct().ToList(); var names = await db.AppUsers.AsNoTracking().Where(x => farmerIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, x => x.FullName, ct); var denominator = tasks.Count(x => x.Status != FarmTaskStatus.Cancelled); var approved = tasks.Count(x => x.Status == FarmTaskStatus.Approved);
        var by = tasks.GroupBy(x => x.AssignedFarmerId).Select(g => new AssigneeTaskCount(g.Key, names.GetValueOrDefault(g.Key, "Unknown"), g.Count(x => x.Status is FarmTaskStatus.Pending or FarmTaskStatus.Accepted), g.Count(x => x.Status == FarmTaskStatus.InProgress || x.Status == FarmTaskStatus.CompletedPendingReview), g.Count(x => x.Status == FarmTaskStatus.Approved), g.Count(x => x.Status == FarmTaskStatus.Failed), g.Count(x => x.Status == FarmTaskStatus.Overdue))).ToList();
        return new(farmId, from, to, tasks.Count, approved, tasks.Count(x => x.Status == FarmTaskStatus.Failed), tasks.Count(x => x.Status == FarmTaskStatus.Overdue), denominator == 0 ? 0 : decimal.Round(approved * 100m / denominator, 2), by, [new("completionRatePercent", "Approved / non-Cancelled * 100", "farm_tasks")]);
    }

    public async Task<MaintenanceReport> MaintenanceAsync(Guid owner, Guid tenant, Guid farmId, DateTime? fromArg, DateTime? toArg, CancellationToken ct)
    {
        await OwnerFarm(owner, tenant, farmId, ct); var (from, to) = Range(fromArg, toArg); var now = clock.GetUtcNow().UtcDateTime; var requests = await db.ServiceRequests.AsNoTracking().Include(x => x.Replacements).Where(x => x.TenantId == tenant && x.FarmId == farmId && x.CreatedAtUtc >= from && x.CreatedAtUtc <= to).ToListAsync(ct); var ids = requests.SelectMany(x => new[] { x.CurrentDeviceId, x.DeviceId }).Where(x => x.HasValue).Select(x => x!.Value).Distinct().ToList(); var tests = await db.DeviceConnectionTests.AsNoTracking().Where(x => ids.Contains(x.DeviceId)).ToListAsync(ct);
        var rows = requests.Select(x => { var device = x.CurrentDeviceId ?? x.DeviceId; var dt = device.HasValue ? tests.Where(t => t.DeviceId == device).OrderByDescending(t => t.ObservedAtUtc).ToList() : []; return new MaintenanceReportItem(x.Id, x.ZoneId, x.DeviceId, x.CurrentDeviceId ?? x.DeviceId, x.Status, x.ResolutionAction, decimal.Round((decimal)((x.ClosedAtUtc ?? now) - x.CreatedAtUtc).TotalHours, 2), dt.Count, dt.FirstOrDefault()?.Succeeded, x.Replacements.Count); }).ToList(); var closed = requests.Where(x => x.ClosedAtUtc.HasValue).ToList();
        return new(farmId, from, to, rows.Count, rows.Count(x => x.Status != ServiceRequestStatus.Closed), rows.Count(x => x.Status == ServiceRequestStatus.Closed), closed.Count == 0 ? 0 : decimal.Round((decimal)closed.Average(x => (x.ClosedAtUtc!.Value - x.CreatedAtUtc).TotalHours), 2), rows, [new("serviceElapsedHours", "(closedAtUtc ?? generatedAtUtc) - createdAtUtc", "service_requests"), new("replacementCount", "count(oldDeviceId -> newDeviceId links)", "device_replacements")]);
    }

    private async Task<List<ActuatorCommand>> Commands(Guid farm, DateTime from, DateTime to, CancellationToken ct) => await db.ActuatorCommands.AsNoTracking().Include(x => x.Actuator).Where(x => x.FarmId == farm && x.Action == ActuatorCommandAction.TurnOn && x.Status == ActuatorCommandStatus.Acknowledged && x.AcknowledgedAtUtc >= from && x.AcknowledgedAtUtc <= to).ToListAsync(ct);
    private (DateTime From, DateTime To) Range(DateTime? from, DateTime? to) { var end = to ?? clock.GetUtcNow().UtcDateTime; var start = from ?? end.AddYears(-1); if (start.Kind != DateTimeKind.Utc || end.Kind != DateTimeKind.Utc || start > end) throw new RequestValidationException("range", "Use a valid inclusive UTC range."); return (start, end); }
    private async Task<Farm> OwnerFarm(Guid owner, Guid tenant, Guid farm, CancellationToken ct) { await Owner(owner, tenant, ct); return await db.Farms.AsNoTracking().SingleOrDefaultAsync(x => x.Id == farm && x.TenantId == tenant && x.ArchivedAtUtc == null, ct) ?? throw new ResourceNotFoundException("Farm was not found in the authenticated Tenant."); }
    private async Task Owner(Guid owner, Guid tenant, CancellationToken ct) { if (!await db.AppUsers.AnyAsync(x => x.Id == owner && x.TenantId == tenant && x.Role == UserRole.FarmOwner && x.Status == AccountStatus.Active, ct)) throw new AuthorizationException(); }
}
