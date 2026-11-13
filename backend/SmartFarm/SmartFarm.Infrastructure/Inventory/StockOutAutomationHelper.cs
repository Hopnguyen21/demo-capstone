using Microsoft.EntityFrameworkCore;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;

namespace SmartFarm.Infrastructure.Inventory;

public static class StockOutAutomationHelper
{
    public static async Task<StockOut?> AutoCreateStockOutForDepositAsync(
        SmartFarmDbContext db,
        Guid tenantId,
        Guid farmId,
        Guid? zoneId,
        string contractNumber,
        Guid creatorUserId,
        string? technicianName,
        IEnumerable<(string Code, string Name, string? Category, int Quantity)> items,
        CancellationToken ct = default)
    {
        var itemList = items.Where(i => i.Quantity > 0).ToList();
        if (itemList.Count == 0 || farmId == Guid.Empty) return null;

        // Ensure we don't duplicate stock-out for the same contract
        var alreadyExists = await db.StockOuts.AnyAsync(
            s => s.FarmId == farmId && s.Notes != null && s.Notes.Contains(contractNumber), ct);
        if (alreadyExists) return null;

        var now = DateTime.UtcNow;
        var prefix = $"PXK-{now:yyyyMM}";
        var randomNum = Random.Shared.Next(100, 999);
        var stockOutCode = $"{prefix}-{randomNum}";

        while (await db.StockOuts.AnyAsync(x => x.TenantId == tenantId && x.StockOutCode == stockOutCode, ct))
        {
            stockOutCode = $"{prefix}-{Random.Shared.Next(100, 999)}-{Guid.NewGuid().ToString("N")[..3].ToUpperInvariant()}";
        }

        var stockOut = new StockOut
        {
            TenantId = tenantId,
            FarmId = farmId,
            ZoneId = zoneId == Guid.Empty ? null : zoneId,
            StockOutCode = stockOutCode,
            Status = StockOutStatus.Pending, // Chờ duyệt xuất kho thiết bị
            CreatedByUserId = creatorUserId,
            Notes = $"[Tự động tạo từ HĐ #{contractNumber}] Xuất thiết bị IoT theo hợp đồng đã thanh toán cọc 30%. Phụ trách: {technicianName ?? "Kỹ thuật viên"}."
        };

        var allHardware = await db.PlatformHardwareItems.AsNoTracking().ToListAsync(ct);

        foreach (var item in itemList)
        {
            var hw = allHardware.FirstOrDefault(h => !string.IsNullOrWhiteSpace(h.Code) && h.Code.Equals(item.Code, StringComparison.OrdinalIgnoreCase))
                ?? allHardware.FirstOrDefault(h => !string.IsNullOrWhiteSpace(h.Name) && h.Name.Equals(item.Name, StringComparison.OrdinalIgnoreCase))
                ?? (!string.IsNullOrWhiteSpace(item.Category) ? allHardware.FirstOrDefault(h => h.Category.Equals(item.Category, StringComparison.OrdinalIgnoreCase)) : null)
                ?? allHardware.FirstOrDefault(h => !string.IsNullOrWhiteSpace(item.Name) && (h.Name.Contains(item.Name, StringComparison.OrdinalIgnoreCase) || item.Name.Contains(h.Name, StringComparison.OrdinalIgnoreCase)));

            stockOut.Details.Add(new StockOutDetail
            {
                StockOutId = stockOut.Id,
                InventoryItemId = hw?.Id ?? Guid.NewGuid(),
                Quantity = item.Quantity,
                Notes = $"Xuất theo HĐ #{contractNumber}: {item.Name} ({item.Category ?? "Thiết bị"})"
            });
        }

        db.StockOuts.Add(stockOut);
        return stockOut;
    }
}
