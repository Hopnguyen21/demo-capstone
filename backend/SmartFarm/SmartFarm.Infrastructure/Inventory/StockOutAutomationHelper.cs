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
        CancellationToken ct = default,
        Guid? serviceRequestId = null)
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

        // Đảm bảo Kỹ thuật viên phụ trách luôn là tài khoản PlatformTechnician (tuyệt đối không gán cho FarmOwner)
        AppUser? technician = null;
        if (creatorUserId != Guid.Empty)
        {
            technician = await db.AppUsers.FirstOrDefaultAsync(u => u.Id == creatorUserId && u.Role == UserRole.PlatformTechnician, ct);
        }

        // Nếu người truyền vào không phải là Technician (ví dụ truyền ownerId khi ký HĐ), tự động tra cứu KTV đã được gán cho Farm/Zone này
        technician ??= await db.ServiceRequests
            .Where(s => s.FarmId == farmId && s.AssignedTechnicianId != null)
            .OrderByDescending(s => s.CreatedAtUtc)
            .Select(s => s.AssignedTechnician)
            .FirstOrDefaultAsync(ct);

        // Fallback: Tìm Kỹ thuật viên bất kỳ trong hệ thống, hoặc Admin
        technician ??= await db.AppUsers.FirstOrDefaultAsync(u => u.Role == UserRole.PlatformTechnician, ct)
                       ?? await db.AppUsers.FirstOrDefaultAsync(u => u.Role == UserRole.PlatformAdmin, ct);

        // Không có Kỹ thuật viên/Admin nào để đứng tên phiếu thì không tạo phiếu (không dùng ID giả; CreatedByUserId có khóa ngoại tới app_users).
        if (technician == null) return null;
        var techUserId = technician.Id;
        var techName = technician.FullName;

        // Tách bạch rõ Khách hàng (Owner/Lessee) và Kỹ thuật viên phụ trách
        string noteDescription;
        if (!string.IsNullOrWhiteSpace(technicianName) && !technicianName.Equals(techName, StringComparison.OrdinalIgnoreCase))
        {
            noteDescription = $"[Tự động tạo từ HĐ #{contractNumber}] Xuất thiết bị IoT cho trang trại (Khách hàng: {technicianName}). Kỹ thuật viên phụ trách: {techName}.";
        }
        else
        {
            noteDescription = $"[Tự động tạo từ HĐ #{contractNumber}] Xuất thiết bị IoT theo hợp đồng đã thanh toán cọc 30%. Phụ trách: {techName}.";
        }

        var stockOut = new StockOut
        {
            TenantId = tenantId,
            FarmId = farmId,
            ZoneId = zoneId == Guid.Empty ? null : zoneId,
            ServiceRequestId = serviceRequestId,
            StockOutCode = stockOutCode,
            Status = StockOutStatus.Pending, // Chờ duyệt xuất kho thiết bị
            CreatedByUserId = techUserId, // Luôn luôn là Kỹ thuật viên
            Notes = noteDescription
        };

        var allHardware = await db.PlatformHardwareItems.AsNoTracking().ToListAsync(ct);

        var unmatched = new List<string>();
        foreach (var item in itemList)
        {
            var hw = allHardware.FirstOrDefault(h => !string.IsNullOrWhiteSpace(h.Code) && h.Code.Equals(item.Code, StringComparison.OrdinalIgnoreCase))
                ?? allHardware.FirstOrDefault(h => !string.IsNullOrWhiteSpace(h.Name) && h.Name.Equals(item.Name, StringComparison.OrdinalIgnoreCase))
                ?? (!string.IsNullOrWhiteSpace(item.Category) ? allHardware.FirstOrDefault(h => h.Category.Equals(item.Category, StringComparison.OrdinalIgnoreCase)) : null)
                ?? allHardware.FirstOrDefault(h => !string.IsNullOrWhiteSpace(item.Name) && (h.Name.Contains(item.Name, StringComparison.OrdinalIgnoreCase) || item.Name.Contains(h.Name, StringComparison.OrdinalIgnoreCase)));

            // Không khớp được thiết bị trong kho phần cứng thì bỏ qua dòng này, không lưu ID ngẫu nhiên.
            if (hw == null)
            {
                unmatched.Add(item.Name);
                continue;
            }

            stockOut.Details.Add(new StockOutDetail
            {
                StockOutId = stockOut.Id,
                InventoryItemId = hw.Id,
                Quantity = item.Quantity,
                Notes = $"Xuất theo HĐ #{contractNumber}: {item.Name} ({item.Category ?? "Thiết bị"})"
            });
        }

        if (stockOut.Details.Count == 0) return null;
        if (unmatched.Count > 0)
            stockOut.Notes += $" Chưa khớp thiết bị trong kho (cần xuất thủ công): {string.Join(", ", unmatched)}.";

        db.StockOuts.Add(stockOut);
        return stockOut;
    }
}
