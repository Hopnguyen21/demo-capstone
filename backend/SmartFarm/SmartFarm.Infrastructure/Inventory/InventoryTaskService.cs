using System.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using SmartFarm.Application.Common.Exceptions;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Application.Features.Inventory;
using SmartFarm.Application.Features.Notifications;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;

namespace SmartFarm.Infrastructure.Inventory;

public sealed class InventoryTaskService(SmartFarmDbContext db, TimeProvider clock, INotificationService notifications, ILogger<InventoryTaskService> logger) : IInventoryTaskService
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
            task = await db.FarmTasks.Include(x => x.Assignments).SingleOrDefaultAsync(x => x.Id == c.TaskId && x.TenantId == tenantId && x.FarmId == farmId && x.ZoneId == c.ZoneId, ct) ?? throw new ResourceNotFoundException("Task was not found for this Farm and Zone.");
        }
        var assignedToCaller = task?.Assignments.Any(a => a.FarmerId == userId && a.Status != FarmTaskStatus.Cancelled && a.Status != FarmTaskStatus.Declined) ?? false;
        if (user.Role == UserRole.Farmer && !assignedToCaller && !await db.UserZoneAccesses.AnyAsync(x => x.AppUserId == userId && x.ZoneId == c.ZoneId, ct))
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
        var query = TaskQuery().AsNoTracking().Where(x => x.TenantId == tenantId && x.FarmId == farmId);
        // Farmer chỉ thấy công việc mình có phân công còn hiệu lực, và chỉ thấy phân công/lịch sử của chính mình.
        if (user.Role == UserRole.Farmer) query = query.Where(x => x.Assignments.Any(a => a.FarmerId == userId && a.Status != FarmTaskStatus.Cancelled));
        var rows = await query.OrderByDescending(x => x.CreatedAtUtc).ToListAsync(ct);
        var viewer = user.Role == UserRole.Farmer ? userId : (Guid?)null;
        return rows.Select(x => x.ToView(viewer)).ToList();
    }

    public async Task<FarmTaskView> CreateTaskAsync(Guid ownerId, Guid tenantId, Guid farmId, CreateFarmTaskCommand c, CancellationToken ct)
    {
        await EnsureFarmAccess(ownerId, tenantId, farmId, true, ct);
        var now = clock.GetUtcNow().UtcDateTime;
        if (c.DueAtUtc.Kind != DateTimeKind.Utc || c.DueAtUtc <= now) throw V("dueAtUtc", "Deadline must be a future UTC timestamp.");
        var zone = await EnsureZone(farmId, tenantId, c.ZoneId, ct);
        var farmerIds = NormalizeFarmerIds(c.FarmerIds);
        var farmers = await EnsureEligibleFarmers(farmerIds, tenantId, farmId, c.ZoneId, ct);

        var task = new FarmTask
        {
            TenantId = tenantId, FarmId = farmId, ZoneId = c.ZoneId, Zone = zone, Title = Required(c.Title, "title", 200), Description = Optional(c.Description, 2000),
            Requirements = Optional(c.Requirements, 2000), DueAtUtc = c.DueAtUtc, CreatedByOwnerId = ownerId, Status = FarmTaskStatus.Pending
        };
        AddHistory(task, History(task, ownerId, FarmTaskEventType.Created, null, FarmTaskStatus.Pending, null));
        foreach (var farmerId in farmerIds) AddAssignment(task, farmers[farmerId], ownerId, now);

        // Công việc và mọi phân công được lưu cùng một transaction: hoặc có đủ, hoặc không có gì.
        await using var transaction = db.Database.IsRelational() ? await db.Database.BeginTransactionAsync(ct) : null;
        db.FarmTasks.Add(task);
        await db.SaveChangesAsync(ct);
        if (transaction is not null) await transaction.CommitAsync(ct);

        // Thông báo chỉ gửi sau khi công việc đã lưu; lỗi thông báo không làm mất công việc.
        foreach (var assignment in task.Assignments) await NotifyAssignedAsync(task, assignment, ct);
        return task.ToView();
    }

    public async Task<FarmTaskView> UpdateTaskAsync(Guid userId, Guid tenantId, Guid farmId, Guid taskId, UpdateFarmTaskCommand c, CancellationToken ct)
    {
        var user = await EnsureFarmAccess(userId, tenantId, farmId, false, ct); await MarkOverdue(tenantId, farmId, ct);
        var task = await LoadTaskAsync(tenantId, farmId, taskId, ct);
        var now = clock.GetUtcNow().UtcDateTime;

        if (user.Role == UserRole.Farmer)
        {
            // Farmer chỉ tác động lên phân công của chính mình; phân công của Farmer khác không thể bị thay đổi qua API này.
            var mine = task.Assignments.SingleOrDefault(a => a.FarmerId == userId && a.Status != FarmTaskStatus.Cancelled)
                ?? throw new AuthorizationException("Only an assigned Farmer may update this Task.");
            var (from, eventType) = ApplyFarmerAction(mine, c, now);
            AddHistory(task, History(task, userId, eventType, from, mine.Status, c.Notes ?? c.FailureReason, mine.FarmerId));
            task.Status = FarmTaskAggregate.Compute(task.Assignments);
            await db.SaveChangesAsync(ct);
            await NotifyOwnerOfFarmerEventAsync(task, mine, eventType, ct);
            return task.ToView(userId);
        }

        if (user.Role != UserRole.FarmOwner) throw new AuthorizationException();
        if (c.Action == FarmTaskAction.Approve)
        {
            var target = ResolveApprovalTarget(task, c.FarmerId);
            if (target.Status != FarmTaskStatus.CompletedPendingReview) throw new ResourceConflictException("This Farmer's result is not waiting for approval.");
            var from = target.Status;
            target.Status = FarmTaskStatus.Approved; target.ApprovedAtUtc = now;
            AddHistory(task, History(task, userId, FarmTaskEventType.Approved, from, target.Status, c.Notes, target.FarmerId));
            task.Status = FarmTaskAggregate.Compute(task.Assignments);
            await db.SaveChangesAsync(ct);
            await NotifyFarmerAsync(task, target, "Kết quả đã được duyệt", $"Chủ trang trại đã duyệt kết quả của bạn cho công việc “{task.Title}”.", "approved", ct);
            return task.ToView();
        }
        if (c.Action == FarmTaskAction.Reassign)
        {
            // Giữ tương thích: giao lại = thêm lại Farmer (đưa phân công thất bại/quá hạn/từ chối/đã gỡ về Chờ nhận).
            if (!c.FarmerId.HasValue) throw V("farmerId", "A Farmer is required for reassignment.");
            return await AddAssigneesCoreAsync(userId, tenantId, farmId, task, [c.FarmerId.Value], null, ct);
        }
        throw new ResourceConflictException("This Owner action is invalid for the current Task state.");
    }

    public async Task<FarmTaskView> AddAssigneesAsync(Guid ownerId, Guid tenantId, Guid farmId, Guid taskId, AddTaskAssigneesCommand c, CancellationToken ct)
    {
        await EnsureFarmAccess(ownerId, tenantId, farmId, true, ct); await MarkOverdue(tenantId, farmId, ct);
        var task = await LoadTaskAsync(tenantId, farmId, taskId, ct);
        return await AddAssigneesCoreAsync(ownerId, tenantId, farmId, task, NormalizeFarmerIds(c.FarmerIds), c.NewDueAtUtc, ct);
    }

    public async Task<FarmTaskView> RemoveAssigneeAsync(Guid ownerId, Guid tenantId, Guid farmId, Guid taskId, Guid farmerId, CancellationToken ct)
    {
        await EnsureFarmAccess(ownerId, tenantId, farmId, true, ct); await MarkOverdue(tenantId, farmId, ct);
        var task = await LoadTaskAsync(tenantId, farmId, taskId, ct);
        var assignment = task.Assignments.SingleOrDefault(a => a.FarmerId == farmerId && a.Status != FarmTaskStatus.Cancelled)
            ?? throw new ResourceNotFoundException("This Farmer is not assigned to the Task.");
        if (assignment.Status == FarmTaskStatus.Approved) throw new ResourceConflictException("Không thể gỡ Farmer đã được duyệt kết quả.");
        var from = assignment.Status;
        assignment.Status = FarmTaskStatus.Cancelled;
        AddHistory(task, History(task, ownerId, FarmTaskEventType.AssigneeRemoved, from, assignment.Status, null, assignment.FarmerId));
        task.Status = FarmTaskAggregate.Compute(task.Assignments);
        await db.SaveChangesAsync(ct);
        await NotifyFarmerAsync(task, assignment, "Bạn không còn được giao công việc", $"Chủ trang trại đã gỡ bạn khỏi công việc “{task.Title}”.", "removed", ct);
        return task.ToView();
    }

    private async Task<FarmTaskView> AddAssigneesCoreAsync(Guid ownerId, Guid tenantId, Guid farmId, FarmTask task, IReadOnlyList<Guid> farmerIds, DateTime? newDueAtUtc, CancellationToken ct)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        if (newDueAtUtc.HasValue)
        {
            if (newDueAtUtc.Value.Kind != DateTimeKind.Utc || newDueAtUtc.Value <= now) throw V("newDueAtUtc", "Deadline must be a future UTC timestamp.");
            task.DueAtUtc = newDueAtUtc.Value;
        }
        if (task.DueAtUtc <= now) throw new ResourceConflictException("Hạn hoàn thành của công việc đã qua. Hãy đặt hạn mới khi giao.");

        var stillActive = new[] { FarmTaskStatus.Pending, FarmTaskStatus.Accepted, FarmTaskStatus.InProgress, FarmTaskStatus.CompletedPendingReview, FarmTaskStatus.Approved };
        var existing = task.Assignments.ToDictionary(a => a.FarmerId);
        var toAdd = farmerIds.Where(id => !existing.TryGetValue(id, out var a) || !stillActive.Contains(a.Status)).ToList();
        if (toAdd.Count == 0) throw new ResourceConflictException("Các Farmer đã chọn đang được giao công việc này.");
        var farmers = await EnsureEligibleFarmers(toAdd, tenantId, farmId, task.ZoneId, ct);

        var changed = new List<FarmTaskAssignment>();
        foreach (var id in toAdd)
        {
            if (existing.TryGetValue(id, out var assignment))
            {
                // Giao lại cho cùng Farmer: dùng lại bản ghi (cặp Task–Farmer là duy nhất), xóa kết quả cũ và tăng phiên bản.
                var from = assignment.Status;
                assignment.Status = FarmTaskStatus.Pending; assignment.ProgressPercent = 0; assignment.ProgressNote = null; assignment.Result = null; assignment.FailureReason = null;
                assignment.AcceptedAtUtc = assignment.StartedAtUtc = assignment.SubmittedAtUtc = assignment.ApprovedAtUtc = null;
                assignment.AssignedAtUtc = now; assignment.AssignedByOwnerId = ownerId; assignment.AssignmentVersion++;
                AddHistory(task, History(task, ownerId, FarmTaskEventType.AssigneeAdded, from, assignment.Status, null, id));
                changed.Add(assignment);
            }
            else changed.Add(AddAssignment(task, farmers[id], ownerId, now));
        }
        task.Status = FarmTaskAggregate.Compute(task.Assignments);
        await db.SaveChangesAsync(ct);
        foreach (var assignment in changed) await NotifyAssignedAsync(task, assignment, ct);
        return task.ToView();
    }

    private (FarmTaskStatus From, FarmTaskEventType Event) ApplyFarmerAction(FarmTaskAssignment a, UpdateFarmTaskCommand c, DateTime now)
    {
        var from = a.Status;
        switch (c.Action)
        {
            case FarmTaskAction.Accept when from == FarmTaskStatus.Pending:
                a.Status = FarmTaskStatus.Accepted; a.AcceptedAtUtc = now; return (from, FarmTaskEventType.Accepted);
            case FarmTaskAction.Decline when from is FarmTaskStatus.Pending or FarmTaskStatus.Accepted:
                a.Status = FarmTaskStatus.Declined; a.FailureReason = Optional(c.FailureReason ?? c.Notes, 2000); return (from, FarmTaskEventType.Declined);
            case FarmTaskAction.Start when from == FarmTaskStatus.Accepted:
                a.Status = FarmTaskStatus.InProgress; a.StartedAtUtc = now; return (from, FarmTaskEventType.Started);
            case FarmTaskAction.UpdateProgress when from is FarmTaskStatus.Accepted or FarmTaskStatus.InProgress:
                if (c.ProgressPercent is not (>= 0 and <= 100)) throw V("progressPercent", "Progress must be between 0 and 100.");
                a.ProgressPercent = c.ProgressPercent.Value; a.ProgressNote = Optional(c.Notes, 1000);
                if (from == FarmTaskStatus.Accepted) { a.Status = FarmTaskStatus.InProgress; a.StartedAtUtc = now; }
                return (from, FarmTaskEventType.ProgressUpdated);
            case FarmTaskAction.Complete when from == FarmTaskStatus.InProgress:
                a.Result = Required(c.Result, "result", 2000); a.ProgressPercent = 100; a.SubmittedAtUtc = now; a.Status = FarmTaskStatus.CompletedPendingReview;
                return (from, FarmTaskEventType.Completed);
            case FarmTaskAction.Fail when from is FarmTaskStatus.Pending or FarmTaskStatus.Accepted or FarmTaskStatus.InProgress:
                a.FailureReason = Required(c.FailureReason, "failureReason", 2000); a.Status = FarmTaskStatus.Failed; return (from, FarmTaskEventType.Failed);
            default:
                throw new ResourceConflictException("This Farmer action is invalid for the current Task state.");
        }
    }

    private static FarmTaskAssignment ResolveApprovalTarget(FarmTask task, Guid? farmerId)
    {
        if (farmerId.HasValue)
            return task.Assignments.SingleOrDefault(a => a.FarmerId == farmerId.Value) ?? throw new ResourceNotFoundException("This Farmer is not assigned to the Task.");
        var waiting = task.Assignments.Where(a => a.Status == FarmTaskStatus.CompletedPendingReview).ToList();
        return waiting.Count == 1 ? waiting[0] : throw V("farmerId", "Hãy chọn Farmer có kết quả cần duyệt.");
    }

    // Bản ghi con có khóa tạo sẵn phía client: gắn vào công việc đã được theo dõi thì phải Add rõ ràng, nếu không EF coi là bản ghi đã có và cập nhật thay vì thêm.
    private bool IsTracked(FarmTask task) => db.Entry(task).State is EntityState.Unchanged or EntityState.Modified;

    private void AddHistory(FarmTask task, FarmTaskHistory history)
    {
        task.History.Add(history);
        if (IsTracked(task)) db.FarmTaskHistory.Add(history);
    }

    private FarmTaskAssignment AddAssignment(FarmTask task, AppUser farmer, Guid ownerId, DateTime now)
    {
        var assignment = new FarmTaskAssignment { FarmTask = task, FarmerId = farmer.Id, Farmer = farmer, AssignedByOwnerId = ownerId, AssignedAtUtc = now, Status = FarmTaskStatus.Pending };
        task.Assignments.Add(assignment);
        if (IsTracked(task)) db.FarmTaskAssignments.Add(assignment);
        AddHistory(task, History(task, ownerId, FarmTaskEventType.AssigneeAdded, null, FarmTaskStatus.Pending, null, farmer.Id));
        return assignment;
    }

    private IQueryable<FarmTask> TaskQuery() => db.FarmTasks.Include(x => x.Zone).Include(x => x.History).Include(x => x.Assignments).ThenInclude(a => a.Farmer);

    private async Task<FarmTask> LoadTaskAsync(Guid tenantId, Guid farmId, Guid taskId, CancellationToken ct) =>
        await TaskQuery().SingleOrDefaultAsync(x => x.Id == taskId && x.TenantId == tenantId && x.FarmId == farmId, ct)
            ?? throw new ResourceNotFoundException("Task was not found in this Farm.");

    private static IReadOnlyList<Guid> NormalizeFarmerIds(IReadOnlyList<Guid>? ids)
    {
        var distinct = (ids ?? []).Where(x => x != Guid.Empty).Distinct().ToList();
        if (distinct.Count == 0) throw V("farmerIds", "Cần chọn ít nhất một Farmer.");
        if (distinct.Count > 50) throw V("farmerIds", "Mỗi công việc giao tối đa 50 Farmer.");
        return distinct;
    }

    private async Task<AppUser> EnsureFarmAccess(Guid userId, Guid tenantId, Guid farmId, bool ownerOnly, CancellationToken ct)
    {
        if (!await db.Farms.AnyAsync(x => x.Id == farmId && x.TenantId == tenantId && x.ArchivedAtUtc == null, ct)) throw new ResourceNotFoundException("Farm was not found in the authenticated Tenant.");
        var user = await db.AppUsers.SingleOrDefaultAsync(x => x.Id == userId && x.TenantId == tenantId && x.Status == AccountStatus.Active, ct) ?? throw new AuthorizationException();
        if (ownerOnly && user.Role != UserRole.FarmOwner) throw new AuthorizationException("FarmOwner role is required.");
        if (user.Role == UserRole.Farmer && user.FarmId != farmId) throw new AuthorizationException("Farmer belongs to a different Farm.");
        if (user.Role is not (UserRole.FarmOwner or UserRole.Farmer)) throw new AuthorizationException(); return user;
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
    private async Task<Zone> EnsureZone(Guid farmId, Guid tenantId, Guid zoneId, CancellationToken ct) =>
        await db.Zones.SingleOrDefaultAsync(z => z.Id == zoneId && z.ArchivedAtUtc == null && z.Field.FarmId == farmId && z.Field.Farm.TenantId == tenantId, ct)
            ?? throw new ResourceNotFoundException("Zone was not found in this Farm.");

    /// <summary>
    /// Mỗi Farmer được giao phải là nhân công đang hoạt động của Farm và đã được Owner cấp quyền truy cập Zone của công việc.
    /// Giao việc không bao giờ tự cấp quyền Zone hay quyền điều khiển thiết bị: thiếu quyền thì báo Owner biết ai còn thiếu.
    /// </summary>
    private async Task<Dictionary<Guid, AppUser>> EnsureEligibleFarmers(IReadOnlyList<Guid> ids, Guid tenantId, Guid farmId, Guid zoneId, CancellationToken ct)
    {
        var users = await db.AppUsers.Where(x => ids.Contains(x.Id) && x.TenantId == tenantId && x.FarmId == farmId && x.Role == UserRole.Farmer && x.Status == AccountStatus.Active).ToListAsync(ct);
        if (users.Count != ids.Count) throw new ResourceConflictException("Mỗi Farmer được giao phải là nhân công đang hoạt động của Farm này.");
        var withAccess = await db.UserZoneAccesses.Where(x => ids.Contains(x.AppUserId) && x.ZoneId == zoneId).Select(x => x.AppUserId).ToListAsync(ct);
        var missing = users.Where(u => !withAccess.Contains(u.Id)).Select(u => u.FullName).OrderBy(n => n).ToList();
        if (missing.Count > 0)
            throw new ResourceConflictException($"Các Farmer sau chưa được cấp quyền truy cập Zone này: {string.Join(", ", missing)}. Hãy cấp quyền Zone ở trang quản lý nhân công trước khi giao việc.");
        return users.ToDictionary(u => u.Id);
    }

    private async Task MarkOverdue(Guid tenantId, Guid farmId, CancellationToken ct)
    {
        var now = clock.GetUtcNow().UtcDateTime; var active = new[] { FarmTaskStatus.Pending, FarmTaskStatus.Accepted, FarmTaskStatus.InProgress };
        var rows = await db.FarmTasks.Include(x => x.History).Include(x => x.Assignments)
            .Where(x => x.TenantId == tenantId && x.FarmId == farmId && x.DueAtUtc < now && x.Assignments.Any(a => active.Contains(a.Status))).ToListAsync(ct);
        foreach (var task in rows)
        {
            foreach (var assignment in task.Assignments.Where(a => active.Contains(a.Status)).ToList())
            {
                var from = assignment.Status; assignment.Status = FarmTaskStatus.Overdue;
                AddHistory(task, History(task, task.CreatedByOwnerId, FarmTaskEventType.Overdue, from, assignment.Status, "Deadline elapsed.", assignment.FarmerId));
            }
            task.Status = FarmTaskAggregate.Compute(task.Assignments);
        }
        if (rows.Count > 0) await db.SaveChangesAsync(ct);
    }

    private static FarmTaskHistory History(FarmTask t, Guid actor, FarmTaskEventType e, FarmTaskStatus? from, FarmTaskStatus to, string? notes, Guid? subjectFarmerId = null) =>
        new() { FarmTask = t, ActorUserId = actor, EventType = e, FromStatus = from, ToStatus = to, SubjectFarmerId = subjectFarmerId, Notes = notes is { Length: > 1000 } ? notes[..1000] : notes };

    // ── Thông báo trong ứng dụng: gửi sau khi dữ liệu đã lưu, không bao giờ làm hỏng thao tác chính, ReferenceId chống gửi trùng khi thử lại ──
    private string? farmTimeZone;

    private async Task<string> DueTextAsync(FarmTask task, CancellationToken ct)
    {
        farmTimeZone ??= await db.Farms.Where(f => f.Id == task.FarmId).Select(f => f.TimeZone).SingleOrDefaultAsync(ct) ?? "UTC";
        try
        {
            var tz = TimeZoneInfo.FindSystemTimeZoneById(farmTimeZone);
            return TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(task.DueAtUtc, DateTimeKind.Utc), tz).ToString("HH:mm dd/MM/yyyy");
        }
        catch (Exception ex) when (ex is TimeZoneNotFoundException or InvalidTimeZoneException)
        {
            return DateTime.SpecifyKind(task.DueAtUtc, DateTimeKind.Utc).ToString("HH:mm dd/MM/yyyy 'UTC'");
        }
    }

    private async Task NotifyAssignedAsync(FarmTask task, FarmTaskAssignment assignment, CancellationToken ct) =>
        await NotifyFarmerAsync(task, assignment, "Công việc mới được giao",
            $"Bạn được giao công việc “{task.Title}” tại {task.Zone?.Name ?? "Zone"}, hạn hoàn thành {await DueTextAsync(task, ct)}.", "assigned", ct);

    private Task NotifyFarmerAsync(FarmTask task, FarmTaskAssignment assignment, string title, string message, string kind, CancellationToken ct) =>
        SendNotificationAsync(assignment.FarmerId, task.TenantId, title, message, $"/farmer/tasks?taskId={task.Id}",
            $"ft:{task.Id:N}:f:{assignment.FarmerId:N}:v{assignment.AssignmentVersion}:{kind}", AlertSeverity.Info, ct);

    private async Task NotifyOwnerOfFarmerEventAsync(FarmTask task, FarmTaskAssignment assignment, FarmTaskEventType eventType, CancellationToken ct)
    {
        var who = assignment.Farmer?.FullName ?? "Farmer";
        var (kind, title, message, severity) = eventType switch
        {
            FarmTaskEventType.Declined => ("declined", "Farmer từ chối công việc", $"{who} đã từ chối công việc “{task.Title}”. Hãy giao cho người khác.", AlertSeverity.Warning),
            FarmTaskEventType.Completed => ("completed", "Farmer nộp kết quả", $"{who} đã nộp kết quả công việc “{task.Title}”, đang chờ bạn duyệt.", AlertSeverity.Info),
            FarmTaskEventType.Failed => ("failed", "Farmer báo không hoàn thành", $"{who} báo không thể hoàn thành công việc “{task.Title}”.", AlertSeverity.Warning),
            _ => (null as string, string.Empty, string.Empty, AlertSeverity.Info)
        };
        if (kind is null) return;
        await SendNotificationAsync(task.CreatedByOwnerId, task.TenantId, title, message, $"/owner/tasks?taskId={task.Id}",
            $"ft:{task.Id:N}:o:{assignment.FarmerId:N}:v{assignment.AssignmentVersion}:{kind}", severity, ct);
    }

    private async Task SendNotificationAsync(Guid userId, Guid tenantId, string title, string message, string targetUrl, string reference, AlertSeverity severity, CancellationToken ct)
    {
        try
        {
            await notifications.CreateNotificationAsync(new CreateNotificationCommand(userId, tenantId, title, message, NotificationType.Task, severity, targetUrl, reference, null, DeduplicateByReference: true), ct);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
        catch (Exception ex) { logger.LogWarning(ex, "Task notification could not be created; the task change was already saved."); }
    }

    private static InventoryTransaction Movement(InventoryItem i, Guid actor, InventoryMovementType type, decimal qty, Guid? zone, Guid? task, string? notes) => new() { TenantId = i.TenantId, FarmId = i.FarmId, InventoryItem = i, MovementType = type, Quantity = qty, BalanceAfter = i.QuantityOnHand, ActorUserId = actor, ZoneId = zone, FarmTaskId = task, Notes = Optional(notes, 500) };
    private static InventoryMovementView MoveView(InventoryTransaction x) => new(x.Id, x.InventoryItemId, x.MovementType, x.Quantity, x.BalanceAfter, x.ZoneId, x.FarmTaskId, x.CreatedAtUtc);
    private static RequestValidationException V(string field, string text) => new(field, text);
    private static string Required(string? s, string field, int max) { s = s?.Trim(); if (string.IsNullOrWhiteSpace(s) || s.Length > max) throw V(field, $"{field} is required and must not exceed {max} characters."); return s; }
    private static string? Optional(string? s, int max) { s = s?.Trim(); if (string.IsNullOrEmpty(s)) return null; if (s.Length > max) throw V("value", $"Value must not exceed {max} characters."); return s; }
}
