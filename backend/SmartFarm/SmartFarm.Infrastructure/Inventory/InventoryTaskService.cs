using System.Data;
using Microsoft.EntityFrameworkCore;
using SmartFarm.Application.Common.Exceptions;
using SmartFarm.Application.Features.Inventory;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;

namespace SmartFarm.Infrastructure.Inventory;

public sealed class InventoryTaskService(SmartFarmDbContext db, TimeProvider clock) : IInventoryTaskService
{
    public async Task<IReadOnlyList<InventoryItemView>> ListInventoryAsync(Guid userId, Guid tenantId, Guid farmId, CancellationToken ct)
    {
        await EnsureFarmAccess(userId, tenantId, farmId, false, ct);
        return (await db.InventoryItems.AsNoTracking().Include(x => x.Requirements)
            .Where(x => x.TenantId == tenantId && x.FarmId == farmId && x.ArchivedAtUtc == null)
            .OrderBy(x => x.Name).ToListAsync(ct)).Select(x => x.ToView()).ToList();
    }

    public async Task<InventoryItemView> CreateItemAsync(Guid ownerId, Guid tenantId, Guid farmId, CreateInventoryItemCommand c, CancellationToken ct)
    {
        await EnsureFarmAccess(ownerId, tenantId, farmId, true, ct);
        var name = Required(c.Name, "name", 160); var unit = Required(c.Unit, "unit", 30);
        if (c.InitialQuantity < 0) throw V("initialQuantity", "Initial quantity cannot be negative.");
        if (c.LowStockThreshold < 0) throw V("lowStockThreshold", "Low-stock threshold cannot be negative.");
        var normalized = name.ToUpperInvariant();
        if (await db.InventoryItems.AnyAsync(x => x.FarmId == farmId && x.NormalizedName == normalized, ct))
            throw new ResourceConflictException("A material with this name already exists in the Farm.");
        var item = new InventoryItem { TenantId = tenantId, FarmId = farmId, Name = name, NormalizedName = normalized, MaterialType = c.MaterialType, Unit = unit, QuantityOnHand = c.InitialQuantity, LowStockThreshold = c.LowStockThreshold };
        await AddRequirements(item, tenantId, c.Requirements ?? [], ct);
        db.InventoryItems.Add(item);
        if (c.InitialQuantity > 0) db.InventoryTransactions.Add(new InventoryTransaction { TenantId = tenantId, FarmId = farmId, InventoryItem = item, MovementType = InventoryMovementType.Receipt, Quantity = c.InitialQuantity, BalanceAfter = c.InitialQuantity, ActorUserId = ownerId, Notes = "Initial stock" });
        await db.SaveChangesAsync(ct);
        await SyncLowStock(item, ct); await db.SaveChangesAsync(ct);
        return item.ToView();
    }

    public async Task<InventoryMovementView> ReceiveAsync(Guid ownerId, Guid tenantId, Guid farmId, Guid itemId, ReceiveInventoryCommand c, CancellationToken ct)
    {
        await EnsureFarmAccess(ownerId, tenantId, farmId, true, ct);
        if (c.Quantity <= 0) throw V("quantity", "Receipt quantity must be positive.");
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var item = await Item(tenantId, farmId, itemId, ct); item.QuantityOnHand += c.Quantity;
        var movement = Movement(item, ownerId, InventoryMovementType.Receipt, c.Quantity, null, null, c.Notes);
        db.InventoryTransactions.Add(movement); await SyncLowStock(item, ct); await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
        return MoveView(movement);
    }

    public async Task<InventoryItemView> ReplaceRequirementsAsync(Guid ownerId, Guid tenantId, Guid farmId, Guid itemId, IReadOnlyList<MaterialRequirementCommand> requirements, CancellationToken ct)
    {
        await EnsureFarmAccess(ownerId, tenantId, farmId, true, ct);
        var item = await db.InventoryItems.Include(x => x.Requirements).SingleOrDefaultAsync(x => x.Id == itemId && x.TenantId == tenantId && x.FarmId == farmId && x.ArchivedAtUtc == null, ct) ?? throw new ResourceNotFoundException("Inventory item was not found in this Farm.");
        db.MaterialRequirementLinks.RemoveRange(item.Requirements); await AddRequirements(item, tenantId, requirements, ct); await db.SaveChangesAsync(ct); return item.ToView();
    }

    public async Task<InventoryMovementView> IssueAsync(Guid userId, Guid tenantId, Guid farmId, IssueInventoryCommand c, CancellationToken ct)
    {
        var user = await EnsureFarmAccess(userId, tenantId, farmId, false, ct);
        if (c.Quantity <= 0) throw V("quantity", "Issue quantity must be positive.");
        var zoneOk = await db.Zones.AnyAsync(z => z.Id == c.ZoneId && z.ArchivedAtUtc == null && z.Field.FarmId == farmId && z.Field.Farm.TenantId == tenantId, ct);
        if (!zoneOk) throw new ResourceNotFoundException("Zone was not found in this Farm.");
        FarmTask? task = null;
        if (c.TaskId.HasValue)
        {
            task = await db.FarmTasks.SingleOrDefaultAsync(x => x.Id == c.TaskId && x.TenantId == tenantId && x.FarmId == farmId && x.ZoneId == c.ZoneId, ct) ?? throw new ResourceNotFoundException("Task was not found for this Farm and Zone.");
        }
        if (user.Role == UserRole.Farmer && task?.AssignedFarmerId != userId && !await db.UserZoneAccesses.AnyAsync(x => x.AppUserId == userId && x.ZoneId == c.ZoneId, ct))
            throw new AuthorizationException("Farmer is not authorized for this Zone or Task.");
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var item = await Item(tenantId, farmId, c.InventoryItemId, ct);
        if (item.QuantityOnHand < c.Quantity) throw new ResourceConflictException("Insufficient stock for this issue.");
        item.QuantityOnHand -= c.Quantity;
        var movement = Movement(item, userId, InventoryMovementType.Issue, c.Quantity, c.ZoneId, c.TaskId, c.Notes);
        db.InventoryTransactions.Add(movement); await SyncLowStock(item, ct); await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
        return MoveView(movement);
    }

    public async Task<IReadOnlyList<LowStockAlertView>> ListLowStockAlertsAsync(Guid ownerId, Guid tenantId, Guid farmId, CancellationToken ct)
    {
        await EnsureFarmAccess(ownerId, tenantId, farmId, true, ct);
        return await db.LowStockAlerts.AsNoTracking().Where(x => x.TenantId == tenantId && x.FarmId == farmId).OrderByDescending(x => x.OpenedAtUtc)
            .Select(x => new LowStockAlertView(x.Id, x.InventoryItemId, x.InventoryItem.Name, x.Status, x.QuantityAtOpen, x.OpenedAtUtc, x.ResolvedAtUtc)).ToListAsync(ct);
    }

    public async Task<IReadOnlyList<FarmTaskView>> ListTasksAsync(Guid userId, Guid tenantId, Guid farmId, CancellationToken ct)
    {
        var user = await EnsureFarmAccess(userId, tenantId, farmId, false, ct); await MarkOverdue(tenantId, farmId, ct);
        var query = db.FarmTasks.AsNoTracking().Include(x => x.History).Where(x => x.TenantId == tenantId && x.FarmId == farmId);
        if (user.Role == UserRole.Farmer) query = query.Where(x => x.AssignedFarmerId == userId);
        return (await query.OrderByDescending(x => x.CreatedAtUtc).ToListAsync(ct)).Select(x => x.ToView()).ToList();
    }

    public async Task<FarmTaskView> CreateTaskAsync(Guid ownerId, Guid tenantId, Guid farmId, CreateFarmTaskCommand c, CancellationToken ct)
    {
        await EnsureFarmAccess(ownerId, tenantId, farmId, true, ct);
        if (c.DueAtUtc.Kind != DateTimeKind.Utc || c.DueAtUtc <= clock.GetUtcNow().UtcDateTime) throw V("dueAtUtc", "Deadline must be a future UTC timestamp.");
        await EnsureZone(farmId, tenantId, c.ZoneId, ct); await EnsureEligibleFarmer(c.AssignedFarmerId, tenantId, farmId, c.ZoneId, ct);
        var task = new FarmTask { TenantId = tenantId, FarmId = farmId, ZoneId = c.ZoneId, Title = Required(c.Title, "title", 200), Description = Optional(c.Description, 2000), Requirements = Optional(c.Requirements, 2000), DueAtUtc = c.DueAtUtc, AssignedFarmerId = c.AssignedFarmerId, CreatedByOwnerId = ownerId };
        task.History.Add(new FarmTaskHistory { ActorUserId = ownerId, EventType = FarmTaskEventType.Created, ToStatus = FarmTaskStatus.Pending, NewAssigneeId = c.AssignedFarmerId });
        db.FarmTasks.Add(task); await db.SaveChangesAsync(ct); return task.ToView();
    }

    public async Task<FarmTaskView> UpdateTaskAsync(Guid userId, Guid tenantId, Guid farmId, Guid taskId, UpdateFarmTaskCommand c, CancellationToken ct)
    {
        var user = await EnsureFarmAccess(userId, tenantId, farmId, false, ct); await MarkOverdue(tenantId, farmId, ct);
        var task = await db.FarmTasks.Include(x => x.History).SingleOrDefaultAsync(x => x.Id == taskId && x.TenantId == tenantId && x.FarmId == farmId, ct) ?? throw new ResourceNotFoundException("Task was not found in this Farm.");
        var from = task.Status; var now = clock.GetUtcNow().UtcDateTime; FarmTaskEventType eventType;
        if (user.Role == UserRole.Farmer)
        {
            if (task.AssignedFarmerId != userId) throw new AuthorizationException("Only the assigned Farmer may update this Task.");
            (task.Status, eventType) = c.Action switch
            {
                FarmTaskAction.Accept when from == FarmTaskStatus.Pending => (FarmTaskStatus.Accepted, FarmTaskEventType.Accepted),
                FarmTaskAction.Start when from == FarmTaskStatus.Accepted => (FarmTaskStatus.InProgress, FarmTaskEventType.Started),
                FarmTaskAction.Complete when from == FarmTaskStatus.InProgress => (FarmTaskStatus.CompletedPendingReview, FarmTaskEventType.Completed),
                FarmTaskAction.Fail when from is FarmTaskStatus.Pending or FarmTaskStatus.Accepted or FarmTaskStatus.InProgress => (FarmTaskStatus.Failed, FarmTaskEventType.Failed),
                _ => throw new ResourceConflictException("This Farmer action is invalid for the current Task state.")
            };
            if (c.Action == FarmTaskAction.Complete) { task.Result = Required(c.Result, "result", 2000); task.SubmittedAtUtc = now; }
            if (c.Action == FarmTaskAction.Fail) task.FailureReason = Required(c.FailureReason, "failureReason", 2000);
            if (c.Action == FarmTaskAction.Accept) task.AcceptedAtUtc = now;
            if (c.Action == FarmTaskAction.Start) task.StartedAtUtc = now;
        }
        else
        {
            if (user.Role != UserRole.FarmOwner) throw new AuthorizationException();
            if (c.Action == FarmTaskAction.Approve && from == FarmTaskStatus.CompletedPendingReview) { task.Status = FarmTaskStatus.Approved; task.ApprovedAtUtc = now; eventType = FarmTaskEventType.Approved; }
            else if (c.Action == FarmTaskAction.Reassign && from is FarmTaskStatus.Failed or FarmTaskStatus.Overdue)
            {
                if (!c.AssignedFarmerId.HasValue) throw V("assignedFarmerId", "A Farmer is required for reassignment.");
                await EnsureEligibleFarmer(c.AssignedFarmerId.Value, tenantId, farmId, task.ZoneId, ct);
                var old = task.AssignedFarmerId; task.AssignedFarmerId = c.AssignedFarmerId.Value; task.Status = FarmTaskStatus.Pending; task.AssignmentVersion++; task.AcceptedAtUtc = task.StartedAtUtc = task.SubmittedAtUtc = null; task.Result = task.FailureReason = null; eventType = FarmTaskEventType.Reassigned;
                var reassigned = History(task, userId, eventType, from, task.Status, c.Notes, old, task.AssignedFarmerId); task.History.Add(reassigned); db.FarmTaskHistory.Add(reassigned); await db.SaveChangesAsync(ct); return task.ToView();
            }
            else throw new ResourceConflictException("This Owner action is invalid for the current Task state.");
        }
        var history = History(task, userId, eventType, from, task.Status, c.Notes); task.History.Add(history); db.FarmTaskHistory.Add(history); await db.SaveChangesAsync(ct); return task.ToView();
    }

    private async Task<AppUser> EnsureFarmAccess(Guid userId, Guid tenantId, Guid farmId, bool ownerOnly, CancellationToken ct)
    {
        if (!await db.Farms.AnyAsync(x => x.Id == farmId && x.TenantId == tenantId && x.ArchivedAtUtc == null, ct)) throw new ResourceNotFoundException("Farm was not found in the authenticated Tenant.");
        var user = await db.AppUsers.SingleOrDefaultAsync(x => x.Id == userId && x.TenantId == tenantId && x.Status == AccountStatus.Active, ct) ?? throw new AuthorizationException();
        if (ownerOnly && user.Role != UserRole.FarmOwner) throw new AuthorizationException("FarmOwner role is required.");
        if (user.Role == UserRole.Farmer && user.FarmId != farmId) throw new AuthorizationException("Farmer belongs to a different Farm.");
        if (user.Role is not (UserRole.FarmOwner or UserRole.Farmer)) throw new AuthorizationException(); return user;
    }
    private async Task EnsureZone(Guid farmId, Guid tenantId, Guid zoneId, CancellationToken ct) { if (!await db.Zones.AnyAsync(z => z.Id == zoneId && z.ArchivedAtUtc == null && z.Field.FarmId == farmId && z.Field.Farm.TenantId == tenantId, ct)) throw new ResourceNotFoundException("Zone was not found in this Farm."); }
    private async Task EnsureEligibleFarmer(Guid id, Guid tenantId, Guid farmId, Guid zoneId, CancellationToken ct)
    {
        var ok = await db.AppUsers.AnyAsync(x => x.Id == id && x.TenantId == tenantId && x.FarmId == farmId && x.Role == UserRole.Farmer && x.Status == AccountStatus.Active, ct);
        if (!ok) throw new ResourceConflictException("Assigned Farmer must be active and belong to this Farm.");
        if (!await db.UserZoneAccesses.AnyAsync(x => x.AppUserId == id && x.ZoneId == zoneId, ct)) throw new ResourceConflictException("Assigned Farmer has no access to the Task Zone.");
    }
    private async Task<InventoryItem> Item(Guid tenantId, Guid farmId, Guid itemId, CancellationToken ct) => await db.InventoryItems.SingleOrDefaultAsync(x => x.Id == itemId && x.TenantId == tenantId && x.FarmId == farmId && x.ArchivedAtUtc == null, ct) ?? throw new ResourceNotFoundException("Inventory item was not found in this Farm.");
    private async Task AddRequirements(InventoryItem item, Guid tenantId, IEnumerable<MaterialRequirementCommand> requirements, CancellationToken ct)
    {
        foreach (var r in requirements)
        {
            if ((r.CropId.HasValue ? 1 : 0) + (r.VarietyId.HasValue ? 1 : 0) + (r.GrowthStageId.HasValue ? 1 : 0) != 1) throw V("requirements", "Each requirement must target exactly one Crop, Variety, or Growth Stage.");
            if (r.RecommendedQuantity is <= 0) throw V("recommendedQuantity", "Recommended quantity must be positive.");
            var valid = r.CropId.HasValue ? await db.Crops.AnyAsync(x => x.Id == r.CropId && (x.TenantId == null || x.TenantId == tenantId), ct)
                : r.VarietyId.HasValue ? await db.CropVarieties.AnyAsync(x => x.Id == r.VarietyId && (x.TenantId == null || x.TenantId == tenantId), ct)
                : await db.GrowthStages.AnyAsync(x => x.Id == r.GrowthStageId && (x.GrowthProfile.TenantId == null || x.GrowthProfile.TenantId == tenantId), ct);
            if (!valid) throw new ResourceNotFoundException("Requirement target was not found for this Tenant.");
            item.Requirements.Add(new MaterialRequirementLink { CropId = r.CropId, VarietyId = r.VarietyId, GrowthStageId = r.GrowthStageId, RecommendedQuantity = r.RecommendedQuantity, Notes = Optional(r.Notes, 500) });
        }
    }
    private async Task SyncLowStock(InventoryItem item, CancellationToken ct)
    {
        var open = await db.LowStockAlerts.SingleOrDefaultAsync(x => x.InventoryItemId == item.Id && x.Status == LowStockAlertStatus.Open, ct);
        if (item.QuantityOnHand <= item.LowStockThreshold && open is null) db.LowStockAlerts.Add(new LowStockAlert { TenantId = item.TenantId, FarmId = item.FarmId, InventoryItem = item, Status = LowStockAlertStatus.Open, QuantityAtOpen = item.QuantityOnHand, OpenedAtUtc = clock.GetUtcNow().UtcDateTime });
        else if (item.QuantityOnHand > item.LowStockThreshold && open is not null) { open.Status = LowStockAlertStatus.Resolved; open.ResolvedAtUtc = clock.GetUtcNow().UtcDateTime; }
    }
    private async Task MarkOverdue(Guid tenantId, Guid farmId, CancellationToken ct)
    {
        var now = clock.GetUtcNow().UtcDateTime; var active = new[] { FarmTaskStatus.Pending, FarmTaskStatus.Accepted, FarmTaskStatus.InProgress };
        var rows = await db.FarmTasks.Include(x => x.History).Where(x => x.TenantId == tenantId && x.FarmId == farmId && x.DueAtUtc < now && active.Contains(x.Status)).ToListAsync(ct);
        foreach (var task in rows) { var from = task.Status; task.Status = FarmTaskStatus.Overdue; var history = History(task, task.CreatedByOwnerId, FarmTaskEventType.Overdue, from, task.Status, "Deadline elapsed."); task.History.Add(history); db.FarmTaskHistory.Add(history); }
        if (rows.Count > 0) await db.SaveChangesAsync(ct);
    }
    private static FarmTaskHistory History(FarmTask t, Guid actor, FarmTaskEventType e, FarmTaskStatus? from, FarmTaskStatus to, string? notes, Guid? old = null, Guid? next = null) => new() { FarmTask = t, ActorUserId = actor, EventType = e, FromStatus = from, ToStatus = to, Notes = Optional(notes, 1000), PreviousAssigneeId = old, NewAssigneeId = next };
    private static InventoryTransaction Movement(InventoryItem i, Guid actor, InventoryMovementType type, decimal qty, Guid? zone, Guid? task, string? notes) => new() { TenantId = i.TenantId, FarmId = i.FarmId, InventoryItem = i, MovementType = type, Quantity = qty, BalanceAfter = i.QuantityOnHand, ActorUserId = actor, ZoneId = zone, FarmTaskId = task, Notes = Optional(notes, 500) };
    private static InventoryMovementView MoveView(InventoryTransaction x) => new(x.Id, x.InventoryItemId, x.MovementType, x.Quantity, x.BalanceAfter, x.ZoneId, x.FarmTaskId, x.CreatedAtUtc);
    private static RequestValidationException V(string field, string text) => new(field, text);
    private static string Required(string? s, string field, int max) { s = s?.Trim(); if (string.IsNullOrWhiteSpace(s) || s.Length > max) throw V(field, $"{field} is required and must not exceed {max} characters."); return s; }
    private static string? Optional(string? s, int max) { s = s?.Trim(); if (string.IsNullOrEmpty(s)) return null; if (s.Length > max) throw V("value", $"Value must not exceed {max} characters."); return s; }
}
