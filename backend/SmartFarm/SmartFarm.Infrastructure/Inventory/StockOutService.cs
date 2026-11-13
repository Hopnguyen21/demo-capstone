using System.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using SmartFarm.Application.Common.Exceptions;
using SmartFarm.Application.Features.Inventory;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;

namespace SmartFarm.Infrastructure.Inventory;

public sealed class StockOutService(SmartFarmDbContext db, TimeProvider clock) : IStockOutService
{
    public async Task<IReadOnlyList<StockOutView>> GetListAsync(Guid userId, Guid tenantId, Guid farmId, StockOutStatus? status, CancellationToken ct)
    {
        await EnsureFarmAccess(userId, tenantId, farmId, ct);
        tenantId = await ResolveEffectiveTenantId(tenantId, farmId, ct);

        var query = db.StockOuts
            .Include(x => x.Farm)
            .Include(x => x.Zone)
            .Include(x => x.CreatedByUser)
            .Include(x => x.ApprovedByUser)
            .Include(x => x.Details)
                .ThenInclude(d => d.InventoryItem)
            .AsNoTracking()
            .Where(x => x.FarmId == farmId && x.TenantId == tenantId);

        if (status.HasValue)
        {
            query = query.Where(x => x.Status == status.Value);
        }

        var list = await query.OrderByDescending(x => x.CreatedAtUtc).ToListAsync(ct);
        var detailItemIds = list.SelectMany(s => s.Details.Select(d => d.InventoryItemId)).Distinct().ToList();
        var hardwareMap = await db.PlatformHardwareItems
            .Where(h => detailItemIds.Contains(h.Id))
            .ToDictionaryAsync(h => h.Id, ct);

        return list.Select(s => MapToView(s, hardwareMap)).ToList();
    }

    public async Task<StockOutView> GetByIdAsync(Guid userId, Guid tenantId, Guid farmId, Guid id, CancellationToken ct)
    {
        await EnsureFarmAccess(userId, tenantId, farmId, ct);
        tenantId = await ResolveEffectiveTenantId(tenantId, farmId, ct);

        var stockOut = await db.StockOuts
            .Include(x => x.Farm)
            .Include(x => x.Zone)
            .Include(x => x.CreatedByUser)
            .Include(x => x.ApprovedByUser)
            .Include(x => x.Details)
                .ThenInclude(d => d.InventoryItem)
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id && x.FarmId == farmId && x.TenantId == tenantId, ct)
            ?? throw new ResourceNotFoundException($"Không tìm thấy phiếu xuất kho #{id}");

        var detailItemIds = stockOut.Details.Select(d => d.InventoryItemId).Distinct().ToList();
        var hardwareMap = await db.PlatformHardwareItems
            .Where(h => detailItemIds.Contains(h.Id))
            .ToDictionaryAsync(h => h.Id, ct);

        return MapToView(stockOut, hardwareMap);
    }

    public async Task<StockOutView> CreateAsync(Guid userId, Guid tenantId, Guid farmId, CreateStockOutCommand command, CancellationToken ct)
    {
        await EnsureFarmAccess(userId, tenantId, farmId, ct);
        tenantId = await ResolveEffectiveTenantId(tenantId, farmId, ct);

        if (command.Details == null || command.Details.Count == 0)
        {
            throw new RequestValidationException("details", "Phiếu xuất kho phải có ít nhất một vật tư.");
        }

        if (command.ZoneId.HasValue && command.ZoneId.Value != Guid.Empty)
        {
            var zoneExists = await db.Zones.AnyAsync(z => z.Id == command.ZoneId.Value && z.Field.FarmId == farmId && z.ArchivedAtUtc == null, ct);
            if (!zoneExists) throw new ResourceNotFoundException("Zone nhận vật tư không tồn tại trong Farm này.");
        }

        // Auto generate StockOutCode
        var now = clock.GetUtcNow().UtcDateTime;
        var prefix = $"PXK-{now:yyyyMM}";
        var randomNum = Random.Shared.Next(100, 999);
        var code = $"{prefix}-{randomNum}";

        while (await db.StockOuts.AnyAsync(x => x.TenantId == tenantId && x.StockOutCode == code, ct))
        {
            code = $"{prefix}-{Random.Shared.Next(100, 999)}-{Guid.NewGuid().ToString("N")[..3].ToUpperInvariant()}";
        }

        var stockOut = new StockOut
        {
            TenantId = tenantId,
            FarmId = farmId,
            ZoneId = command.ZoneId == Guid.Empty ? null : command.ZoneId,
            StockOutCode = code,
            Status = StockOutStatus.Draft,
            CreatedByUserId = userId,
            Notes = command.Notes?.Trim()
        };

        foreach (var d in command.Details)
        {
            if (d.Quantity <= 0)
                throw new RequestValidationException("quantity", "Số lượng xuất kho phải lớn hơn 0.");

            var item = await db.InventoryItems.FirstOrDefaultAsync(i => i.Id == d.InventoryItemId && i.FarmId == farmId && i.TenantId == tenantId && i.ArchivedAtUtc == null, ct);
            var hardware = item == null ? await db.PlatformHardwareItems.FirstOrDefaultAsync(h => h.Id == d.InventoryItemId, ct) : null;

            if (item == null && hardware == null)
                throw new ResourceNotFoundException($"Thiết bị/vật tư #{d.InventoryItemId} không tồn tại trong kho.");

            if (hardware != null && hardware.QuantityInStock < (int)d.Quantity)
                throw new ResourceConflictException($"Không đủ tồn kho cho thiết bị '{hardware.Name}'. Tồn kho hiện tại: {hardware.QuantityInStock}, số lượng xuất: {d.Quantity}.");

            stockOut.Details.Add(new StockOutDetail
            {
                StockOutId = stockOut.Id,
                InventoryItemId = d.InventoryItemId,
                Quantity = d.Quantity,
                Notes = d.Notes?.Trim()
            });
        }

        db.StockOuts.Add(stockOut);
        await db.SaveChangesAsync(ct);

        return await GetByIdAsync(userId, tenantId, farmId, stockOut.Id, ct);
    }

    public async Task<StockOutView> UpdateAsync(Guid userId, Guid tenantId, Guid farmId, Guid id, UpdateStockOutCommand command, CancellationToken ct)
    {
        await EnsureFarmAccess(userId, tenantId, farmId, ct);
        tenantId = await ResolveEffectiveTenantId(tenantId, farmId, ct);

        var stockOut = await db.StockOuts
            .Include(x => x.Details)
            .FirstOrDefaultAsync(x => x.Id == id && x.FarmId == farmId && x.TenantId == tenantId, ct)
            ?? throw new ResourceNotFoundException($"Không tìm thấy phiếu xuất kho #{id}");

        if (stockOut.Status != StockOutStatus.Draft && stockOut.Status != StockOutStatus.Pending)
        {
            throw new ResourceConflictException("Chỉ có thể chỉnh sửa phiếu xuất kho ở trạng thái Bản nháp (Draft) hoặc Chờ duyệt (Pending).");
        }

        if (command.Details == null || command.Details.Count == 0)
        {
            throw new RequestValidationException("details", "Phiếu xuất kho phải có ít nhất một vật tư.");
        }

        if (command.ZoneId.HasValue && command.ZoneId.Value != Guid.Empty)
        {
            var zoneExists = await db.Zones.AnyAsync(z => z.Id == command.ZoneId.Value && z.Field.FarmId == farmId && z.ArchivedAtUtc == null, ct);
            if (!zoneExists) throw new ResourceNotFoundException("Zone nhận vật tư không tồn tại trong Farm này.");
            stockOut.ZoneId = command.ZoneId.Value;
        }
        else
        {
            stockOut.ZoneId = null;
        }

        stockOut.Notes = command.Notes?.Trim();
        db.StockOutDetails.RemoveRange(stockOut.Details);
        stockOut.Details.Clear();

        foreach (var d in command.Details)
        {
            if (d.Quantity <= 0)
                throw new RequestValidationException("quantity", "Số lượng xuất kho phải lớn hơn 0.");

            var itemExists = await db.InventoryItems.AnyAsync(i => i.Id == d.InventoryItemId && i.FarmId == farmId && i.TenantId == tenantId && i.ArchivedAtUtc == null, ct);
            var hardwareExists = !itemExists && await db.PlatformHardwareItems.AnyAsync(h => h.Id == d.InventoryItemId, ct);

            if (!itemExists && !hardwareExists)
                throw new ResourceNotFoundException($"Thiết bị/vật tư #{d.InventoryItemId} không tồn tại trong kho.");

            stockOut.Details.Add(new StockOutDetail
            {
                StockOutId = stockOut.Id,
                InventoryItemId = d.InventoryItemId,
                Quantity = d.Quantity,
                Notes = d.Notes?.Trim()
            });
        }

        stockOut.UpdatedAtUtc = clock.GetUtcNow().UtcDateTime;
        await db.SaveChangesAsync(ct);

        return await GetByIdAsync(userId, tenantId, farmId, stockOut.Id, ct);
    }

    public async Task<StockOutView> UpdateStatusAsync(Guid userId, Guid tenantId, Guid farmId, Guid id, UpdateStockOutStatusCommand command, CancellationToken ct)
    {
        await EnsureFarmAccess(userId, tenantId, farmId, ct);
        tenantId = await ResolveEffectiveTenantId(tenantId, farmId, ct);

        var stockOut = await db.StockOuts
            .Include(x => x.Details)
            .FirstOrDefaultAsync(x => x.Id == id && x.FarmId == farmId && x.TenantId == tenantId, ct)
            ?? throw new ResourceNotFoundException($"Không tìm thấy phiếu xuất kho #{id}");

        if (stockOut.Status == StockOutStatus.Completed)
        {
            throw new ResourceConflictException("Phiếu xuất kho đã hoàn thành (Completed), không thể thay đổi trạng thái.");
        }

        var newStatus = command.Status;

        if (newStatus == StockOutStatus.Completed)
        {
            // Execute atomic inventory deduction
            await using var tx = db.Database.IsRelational() ? await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct) : null;

            foreach (var detail in stockOut.Details)
            {
                var item = await db.InventoryItems.FirstOrDefaultAsync(i => i.Id == detail.InventoryItemId && i.FarmId == farmId && i.TenantId == tenantId, ct);
                var hardware = item == null ? await db.PlatformHardwareItems.FirstOrDefaultAsync(h => h.Id == detail.InventoryItemId, ct) : null;

                if (item == null && hardware == null)
                    throw new ResourceNotFoundException($"Thiết bị/vật tư #{detail.InventoryItemId} không tìm thấy trong kho.");

                if (item != null)
                {
                    if (item.QuantityOnHand < detail.Quantity)
                    {
                        throw new ResourceConflictException($"Không đủ tồn kho cho vật tư '{item.Name}'. Tồn kho hiện tại: {item.QuantityOnHand} {item.Unit}, số lượng xuất: {detail.Quantity} {item.Unit}.");
                    }

                    item.QuantityOnHand -= detail.Quantity;

                    var transaction = new InventoryTransaction
                    {
                        TenantId = tenantId,
                        FarmId = farmId,
                        InventoryItemId = item.Id,
                        MovementType = InventoryMovementType.Issue,
                        Quantity = detail.Quantity,
                        BalanceAfter = item.QuantityOnHand,
                        ActorUserId = userId,
                        ZoneId = stockOut.ZoneId,
                        Notes = $"Xuất kho theo phiếu {stockOut.StockOutCode}. {(string.IsNullOrWhiteSpace(detail.Notes) ? "" : "Chi tiết: " + detail.Notes)}"
                    };
                    db.InventoryTransactions.Add(transaction);

                    // Check Low Stock
                    if (item.QuantityOnHand <= item.LowStockThreshold)
                    {
                        var hasOpenAlert = await db.LowStockAlerts.AnyAsync(a => a.InventoryItemId == item.Id && a.Status == LowStockAlertStatus.Open, ct);
                        if (!hasOpenAlert)
                        {
                            db.LowStockAlerts.Add(new LowStockAlert
                            {
                                TenantId = tenantId,
                                FarmId = farmId,
                                InventoryItemId = item.Id,
                                Status = LowStockAlertStatus.Open,
                                QuantityAtOpen = item.QuantityOnHand,
                                OpenedAtUtc = clock.GetUtcNow().UtcDateTime
                            });
                        }
                    }
                }
                else if (hardware != null)
                {
                    if (hardware.QuantityInStock < (int)detail.Quantity)
                    {
                        throw new ResourceConflictException($"Không đủ tồn kho cho thiết bị '{hardware.Name}'. Tồn kho hiện tại: {hardware.QuantityInStock} cái, số lượng xuất: {detail.Quantity} cái.");
                    }
                    hardware.QuantityInStock -= (int)detail.Quantity;
                }
            }

            stockOut.Status = StockOutStatus.Completed;
            stockOut.CompletedAtUtc = clock.GetUtcNow().UtcDateTime;
            if (!stockOut.ApprovedByUserId.HasValue)
            {
                stockOut.ApprovedByUserId = userId;
            }
            if (!string.IsNullOrWhiteSpace(command.Notes))
            {
                stockOut.Notes = (stockOut.Notes + " " + command.Notes).Trim();
            }

            await db.SaveChangesAsync(ct);
            if (tx != null) await tx.CommitAsync(ct);
        }
        else if (newStatus == StockOutStatus.Approved)
        {
            stockOut.Status = StockOutStatus.Approved;
            stockOut.ApprovedByUserId = userId;
            if (!string.IsNullOrWhiteSpace(command.Notes)) stockOut.Notes = (stockOut.Notes + " " + command.Notes).Trim();
            await db.SaveChangesAsync(ct);
        }
        else if (newStatus == StockOutStatus.Cancelled)
        {
            stockOut.Status = StockOutStatus.Cancelled;
            if (!string.IsNullOrWhiteSpace(command.Notes)) stockOut.Notes = (stockOut.Notes + " [Đã hủy: " + command.Notes + "]").Trim();
            await db.SaveChangesAsync(ct);
        }
        else
        {
            stockOut.Status = newStatus;
            if (!string.IsNullOrWhiteSpace(command.Notes)) stockOut.Notes = (stockOut.Notes + " " + command.Notes).Trim();
            await db.SaveChangesAsync(ct);
        }

        return await GetByIdAsync(userId, tenantId, farmId, stockOut.Id, ct);
    }

    public async Task DeleteAsync(Guid userId, Guid tenantId, Guid farmId, Guid id, CancellationToken ct)
    {
        await EnsureFarmAccess(userId, tenantId, farmId, ct);
        tenantId = await ResolveEffectiveTenantId(tenantId, farmId, ct);

        var stockOut = await db.StockOuts
            .Include(x => x.Details)
            .FirstOrDefaultAsync(x => x.Id == id && x.FarmId == farmId && x.TenantId == tenantId, ct)
            ?? throw new ResourceNotFoundException($"Không tìm thấy phiếu xuất kho #{id}");

        if (stockOut.Status != StockOutStatus.Draft && stockOut.Status != StockOutStatus.Cancelled)
        {
            throw new ResourceConflictException("Chỉ có thể xóa phiếu xuất kho khi ở trạng thái Bản nháp (Draft) hoặc Đã hủy (Cancelled).");
        }

        db.StockOutDetails.RemoveRange(stockOut.Details);
        db.StockOuts.Remove(stockOut);
        await db.SaveChangesAsync(ct);
    }

    private async Task EnsureFarmAccess(Guid userId, Guid tenantId, Guid farmId, CancellationToken ct)
    {
        var user = await db.AppUsers.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new AuthorizationException("Người dùng không tồn tại trong hệ thống.");

        if (user.Role == UserRole.PlatformAdmin || user.Role == UserRole.PlatformTechnician) return;

        var farmExists = await db.Farms.AnyAsync(f => f.Id == farmId && (tenantId == Guid.Empty || f.TenantId == tenantId), ct);
        if (!farmExists) throw new ResourceNotFoundException("Trang trại không tồn tại hoặc bạn không có quyền truy cập.");
    }

    private async Task<Guid> ResolveEffectiveTenantId(Guid tenantId, Guid farmId, CancellationToken ct)
    {
        if (tenantId != Guid.Empty) return tenantId;
        var farm = await db.Farms.AsNoTracking().FirstOrDefaultAsync(f => f.Id == farmId, ct);
        return farm?.TenantId ?? Guid.Empty;
    }

    private static StockOutView MapToView(StockOut s, IReadOnlyDictionary<Guid, PlatformHardwareItem>? hardwareMap = null)
    {
        var statusText = s.Status switch
        {
            StockOutStatus.Draft => "Bản nháp",
            StockOutStatus.Pending => "Chờ duyệt",
            StockOutStatus.Approved => "Đã duyệt",
            StockOutStatus.Completed => "Đã hoàn thành xuất kho",
            StockOutStatus.Cancelled => "Đã hủy",
            _ => s.Status.ToString()
        };

        return new StockOutView(
            s.Id,
            s.TenantId,
            s.FarmId,
            s.Farm?.Name ?? "Trang trại",
            s.ZoneId,
            s.Zone?.Name,
            s.StockOutCode,
            s.Status,
            statusText,
            s.CreatedByUserId,
            s.CreatedByUser?.FullName ?? "N/A",
            s.ApprovedByUserId,
            s.ApprovedByUser?.FullName,
            s.CompletedAtUtc,
            s.Notes,
            s.CreatedAtUtc,
            s.Details.Select(d => {
                var hw = hardwareMap != null && hardwareMap.TryGetValue(d.InventoryItemId, out var h) ? h : null;
                var itemName = d.InventoryItem?.Name ?? (hw != null ? $"[{hw.Code}] {hw.Name}" : "Thiết bị");
                var unit = d.InventoryItem?.Unit ?? "Cái";
                var currentStock = d.InventoryItem?.QuantityOnHand ?? (hw != null ? (decimal)hw.QuantityInStock : 0m);

                return new StockOutDetailView(
                    d.Id,
                    d.StockOutId,
                    d.InventoryItemId,
                    itemName,
                    unit,
                    d.Quantity,
                    currentStock,
                    d.Notes
                );
            }).ToList()
        );
    }
}
