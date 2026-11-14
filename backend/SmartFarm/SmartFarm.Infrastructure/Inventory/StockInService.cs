using System.Data;
using Microsoft.EntityFrameworkCore;
using SmartFarm.Application.Common.Exceptions;
using SmartFarm.Application.Features.Inventory;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;

namespace SmartFarm.Infrastructure.Inventory;

public sealed class StockInService(SmartFarmDbContext db, TimeProvider clock) : IStockInService
{
    public async Task<IReadOnlyList<StockInView>> GetListAsync(Guid userId, Guid tenantId, Guid farmId, StockInStatus? status, CancellationToken ct)
    {
        await EnsureFarmAccess(userId, tenantId, farmId, ct);
        tenantId = await ResolveEffectiveTenantId(tenantId, farmId, ct);

        var query = db.StockIns
            .Include(x => x.Farm)
            .Include(x => x.CreatedByUser)
            .Include(x => x.ApprovedByUser)
            .Include(x => x.Details)
            .AsNoTracking()
            .Where(x => x.FarmId == farmId && (tenantId == Guid.Empty || x.TenantId == tenantId));

        if (status.HasValue)
        {
            query = query.Where(x => x.Status == status.Value);
        }

        var list = await query.OrderByDescending(x => x.CreatedAtUtc).ToListAsync(ct);
        var detailItemIds = list.SelectMany(s => s.Details.Select(d => d.InventoryItemId)).Distinct().ToList();

        var hardwareMap = await db.PlatformHardwareItems
            .Where(h => detailItemIds.Contains(h.Id))
            .ToDictionaryAsync(h => h.Id, ct);

        var inventoryItemMap = await db.InventoryItems
            .Where(i => detailItemIds.Contains(i.Id))
            .ToDictionaryAsync(i => i.Id, ct);

        return list.Select(s => MapToView(s, hardwareMap, inventoryItemMap)).ToList();
    }

    public async Task<StockInView> GetByIdAsync(Guid userId, Guid tenantId, Guid farmId, Guid id, CancellationToken ct)
    {
        await EnsureFarmAccess(userId, tenantId, farmId, ct);
        tenantId = await ResolveEffectiveTenantId(tenantId, farmId, ct);

        var stockIn = await db.StockIns
            .Include(x => x.Farm)
            .Include(x => x.CreatedByUser)
            .Include(x => x.ApprovedByUser)
            .Include(x => x.Details)
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id && x.FarmId == farmId && (tenantId == Guid.Empty || x.TenantId == tenantId), ct)
            ?? throw new ResourceNotFoundException($"Không tìm thấy phiếu nhập kho #{id}");

        var detailItemIds = stockIn.Details.Select(d => d.InventoryItemId).Distinct().ToList();
        var hardwareMap = await db.PlatformHardwareItems
            .Where(h => detailItemIds.Contains(h.Id))
            .ToDictionaryAsync(h => h.Id, ct);

        var inventoryItemMap = await db.InventoryItems
            .Where(i => detailItemIds.Contains(i.Id))
            .ToDictionaryAsync(i => i.Id, ct);

        return MapToView(stockIn, hardwareMap, inventoryItemMap);
    }

    public async Task<StockInView> CreateAsync(Guid userId, Guid tenantId, Guid farmId, CreateStockInCommand command, CancellationToken ct)
    {
        await EnsureFarmAccess(userId, tenantId, farmId, ct);
        tenantId = await ResolveEffectiveTenantId(tenantId, farmId, ct);

        if (command.Details == null || command.Details.Count == 0)
        {
            throw new RequestValidationException("details", "Phiếu nhập kho phải có ít nhất một vật tư/thiết bị.");
        }

        var now = clock.GetUtcNow().UtcDateTime;
        var prefix = $"PNK-{now:yyyyMM}";
        var randomNum = Random.Shared.Next(100, 999);
        var code = $"{prefix}-{randomNum}";

        while (await db.StockIns.AnyAsync(x => x.TenantId == tenantId && x.StockInCode == code, ct))
        {
            code = $"{prefix}-{Random.Shared.Next(100, 999)}-{Guid.NewGuid().ToString("N")[..3].ToUpperInvariant()}";
        }

        var stockIn = new StockIn
        {
            TenantId = tenantId,
            FarmId = farmId,
            StockInCode = code,
            SupplierName = command.SupplierName?.Trim(),
            Status = StockInStatus.Draft,
            CreatedByUserId = userId,
            Notes = command.Notes?.Trim()
        };

        foreach (var d in command.Details)
        {
            if (d.Quantity <= 0)
                throw new RequestValidationException("quantity", "Số lượng nhập kho phải lớn hơn 0.");

            var item = await db.InventoryItems.FirstOrDefaultAsync(i => i.Id == d.InventoryItemId && i.FarmId == farmId, ct);
            var hardware = item == null ? await db.PlatformHardwareItems.FirstOrDefaultAsync(h => h.Id == d.InventoryItemId, ct) : null;

            if (item == null && hardware == null)
                throw new ResourceNotFoundException($"Thiết bị/vật tư #{d.InventoryItemId} không tồn tại trong hệ thống.");

            stockIn.Details.Add(new StockInDetail
            {
                StockInId = stockIn.Id,
                InventoryItemId = d.InventoryItemId,
                Quantity = d.Quantity,
                UnitPrice = d.UnitPrice >= 0 ? d.UnitPrice : (hardware?.UnitPrice ?? 0),
                Notes = d.Notes?.Trim()
            });
        }

        db.StockIns.Add(stockIn);
        await db.SaveChangesAsync(ct);

        return await GetByIdAsync(userId, tenantId, farmId, stockIn.Id, ct);
    }

    public async Task<StockInView> UpdateAsync(Guid userId, Guid tenantId, Guid farmId, Guid id, UpdateStockInCommand command, CancellationToken ct)
    {
        await EnsureFarmAccess(userId, tenantId, farmId, ct);
        tenantId = await ResolveEffectiveTenantId(tenantId, farmId, ct);

        var stockIn = await db.StockIns
            .Include(x => x.Details)
            .FirstOrDefaultAsync(x => x.Id == id && x.FarmId == farmId && (tenantId == Guid.Empty || x.TenantId == tenantId), ct)
            ?? throw new ResourceNotFoundException($"Không tìm thấy phiếu nhập kho #{id}");

        if (stockIn.Status != StockInStatus.Draft && stockIn.Status != StockInStatus.Pending)
        {
            throw new ResourceConflictException("Chỉ có thể chỉnh sửa phiếu nhập kho ở trạng thái Bản nháp (Draft) hoặc Chờ duyệt (Pending).");
        }

        if (command.Details == null || command.Details.Count == 0)
        {
            throw new RequestValidationException("details", "Phiếu nhập kho phải có ít nhất một vật tư/thiết bị.");
        }

        stockIn.SupplierName = command.SupplierName?.Trim();
        stockIn.Notes = command.Notes?.Trim();
        db.StockInDetails.RemoveRange(stockIn.Details);
        stockIn.Details.Clear();

        foreach (var d in command.Details)
        {
            if (d.Quantity <= 0)
                throw new RequestValidationException("quantity", "Số lượng nhập kho phải lớn hơn 0.");

            var itemExists = await db.InventoryItems.AnyAsync(i => i.Id == d.InventoryItemId && i.FarmId == farmId, ct);
            var hardware = !itemExists ? await db.PlatformHardwareItems.FirstOrDefaultAsync(h => h.Id == d.InventoryItemId, ct) : null;

            if (!itemExists && hardware == null)
                throw new ResourceNotFoundException($"Thiết bị/vật tư #{d.InventoryItemId} không tồn tại trong hệ thống.");

            stockIn.Details.Add(new StockInDetail
            {
                StockInId = stockIn.Id,
                InventoryItemId = d.InventoryItemId,
                Quantity = d.Quantity,
                UnitPrice = d.UnitPrice >= 0 ? d.UnitPrice : (hardware?.UnitPrice ?? 0),
                Notes = d.Notes?.Trim()
            });
        }

        stockIn.UpdatedAtUtc = clock.GetUtcNow().UtcDateTime;
        await db.SaveChangesAsync(ct);

        return await GetByIdAsync(userId, tenantId, farmId, stockIn.Id, ct);
    }

    public async Task<StockInView> UpdateStatusAsync(Guid userId, Guid tenantId, Guid farmId, Guid id, UpdateStockInStatusCommand command, CancellationToken ct)
    {
        await EnsureFarmAccess(userId, tenantId, farmId, ct);
        tenantId = await ResolveEffectiveTenantId(tenantId, farmId, ct);

        var stockIn = await db.StockIns
            .Include(x => x.Details)
            .FirstOrDefaultAsync(x => x.Id == id && x.FarmId == farmId && (tenantId == Guid.Empty || x.TenantId == tenantId), ct)
            ?? throw new ResourceNotFoundException($"Không tìm thấy phiếu nhập kho #{id}");

        if (stockIn.Status == StockInStatus.Completed)
        {
            throw new ResourceConflictException("Phiếu nhập kho đã hoàn thành (Completed), không thể thay đổi trạng thái.");
        }

        var newStatus = command.Status;

        if (newStatus == StockInStatus.Completed)
        {
            await using var tx = db.Database.IsRelational() ? await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct) : null;

            foreach (var detail in stockIn.Details)
            {
                var item = await db.InventoryItems.FirstOrDefaultAsync(i => i.Id == detail.InventoryItemId && i.FarmId == farmId, ct);
                var hardware = item == null ? await db.PlatformHardwareItems.FirstOrDefaultAsync(h => h.Id == detail.InventoryItemId, ct) : null;

                if (item != null)
                {
                    item.QuantityOnHand += detail.Quantity;

                    var transaction = new InventoryTransaction
                    {
                        TenantId = tenantId,
                        FarmId = farmId,
                        InventoryItemId = item.Id,
                        MovementType = InventoryMovementType.Receipt,
                        Quantity = detail.Quantity,
                        BalanceAfter = item.QuantityOnHand,
                        ActorUserId = userId,
                        Notes = $"Nhập kho theo phiếu {stockIn.StockInCode}. {(string.IsNullOrWhiteSpace(detail.Notes) ? "" : "Chi tiết: " + detail.Notes)}"
                    };
                    db.InventoryTransactions.Add(transaction);
                }
                else if (hardware != null)
                {
                    hardware.QuantityInStock += (int)detail.Quantity;
                    hardware.Status = "InStock";
                }
            }

            stockIn.Status = StockInStatus.Completed;
            stockIn.CompletedAtUtc = clock.GetUtcNow().UtcDateTime;
            if (!stockIn.ApprovedByUserId.HasValue)
            {
                stockIn.ApprovedByUserId = userId;
            }
            if (!string.IsNullOrWhiteSpace(command.Notes))
            {
                stockIn.Notes = (stockIn.Notes + " " + command.Notes).Trim();
            }

            await db.SaveChangesAsync(ct);
            if (tx != null) await tx.CommitAsync(ct);
        }
        else if (newStatus == StockInStatus.Approved)
        {
            stockIn.Status = StockInStatus.Approved;
            stockIn.ApprovedByUserId = userId;
            if (!string.IsNullOrWhiteSpace(command.Notes)) stockIn.Notes = (stockIn.Notes + " " + command.Notes).Trim();
            await db.SaveChangesAsync(ct);
        }
        else if (newStatus == StockInStatus.Cancelled)
        {
            stockIn.Status = StockInStatus.Cancelled;
            if (!string.IsNullOrWhiteSpace(command.Notes)) stockIn.Notes = (stockIn.Notes + " [Đã hủy: " + command.Notes + "]").Trim();
            await db.SaveChangesAsync(ct);
        }
        else
        {
            stockIn.Status = newStatus;
            if (!string.IsNullOrWhiteSpace(command.Notes)) stockIn.Notes = (stockIn.Notes + " " + command.Notes).Trim();
            await db.SaveChangesAsync(ct);
        }

        return await GetByIdAsync(userId, tenantId, farmId, stockIn.Id, ct);
    }

    public async Task DeleteAsync(Guid userId, Guid tenantId, Guid farmId, Guid id, CancellationToken ct)
    {
        await EnsureFarmAccess(userId, tenantId, farmId, ct);
        tenantId = await ResolveEffectiveTenantId(tenantId, farmId, ct);

        var stockIn = await db.StockIns
            .Include(x => x.Details)
            .FirstOrDefaultAsync(x => x.Id == id && x.FarmId == farmId && (tenantId == Guid.Empty || x.TenantId == tenantId), ct)
            ?? throw new ResourceNotFoundException($"Không tìm thấy phiếu nhập kho #{id}");

        if (stockIn.Status != StockInStatus.Draft && stockIn.Status != StockInStatus.Cancelled)
        {
            throw new ResourceConflictException("Chỉ có thể xóa phiếu nhập kho khi ở trạng thái Bản nháp (Draft) hoặc Đã hủy (Cancelled).");
        }

        db.StockInDetails.RemoveRange(stockIn.Details);
        db.StockIns.Remove(stockIn);
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

    private static StockInView MapToView(
        StockIn s,
        IReadOnlyDictionary<Guid, PlatformHardwareItem>? hardwareMap = null,
        IReadOnlyDictionary<Guid, InventoryItem>? inventoryItemMap = null)
    {
        var statusText = s.Status switch
        {
            StockInStatus.Draft => "Bản nháp",
            StockInStatus.Pending => "Chờ duyệt",
            StockInStatus.Approved => "Đã duyệt",
            StockInStatus.Completed => "Đã hoàn thành nhập kho",
            StockInStatus.Cancelled => "Đã hủy",
            _ => s.Status.ToString()
        };

        var details = s.Details.Select(d =>
        {
            string itemName = "Vật tư không xác định";
            string unit = "Cái";
            decimal currentStock = 0;

            if (hardwareMap != null && hardwareMap.TryGetValue(d.InventoryItemId, out var hw))
            {
                itemName = $"[{hw.Code}] {hw.Name}";
                unit = "Cái";
                currentStock = hw.QuantityInStock;
            }
            else if (inventoryItemMap != null && inventoryItemMap.TryGetValue(d.InventoryItemId, out var inv))
            {
                itemName = inv.Name;
                unit = inv.Unit;
                currentStock = inv.QuantityOnHand;
            }

            var totalAmount = d.Quantity * d.UnitPrice;

            return new StockInDetailView(
                d.Id,
                d.StockInId,
                d.InventoryItemId,
                itemName,
                unit,
                d.Quantity,
                d.UnitPrice,
                totalAmount,
                currentStock,
                d.Notes);
        }).ToList();

        var totalAmountSum = details.Sum(d => d.TotalAmount);
        var totalItemsSum = (int)details.Sum(d => d.Quantity);

        return new StockInView(
            s.Id,
            s.TenantId,
            s.FarmId,
            s.Farm?.Name ?? "Trang trại SmartFarm",
            s.StockInCode,
            s.SupplierName,
            s.Status,
            statusText,
            totalAmountSum,
            totalItemsSum,
            s.CreatedByUserId,
            s.CreatedByUser?.FullName ?? "Quản trị viên kho",
            s.ApprovedByUserId,
            s.ApprovedByUser?.FullName,
            s.CompletedAtUtc,
            s.Notes,
            s.CreatedAtUtc,
            details);
    }
}
