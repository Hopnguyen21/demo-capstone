using Microsoft.EntityFrameworkCore;
using SmartFarm.Application.Common.Exceptions;
using SmartFarm.Application.Features.Platform;
using SmartFarm.Domain.Entities;
using SmartFarm.Infrastructure.Persistence;

namespace SmartFarm.Infrastructure.Platform;

/// <summary>
/// Dựng các dòng dự toán thiết bị của Owner để lưu kèm Deployment Request (dùng chung cho wizard CF1 và gửi yêu cầu cho Zone đã có).
/// Thiết bị lấy mã/tên/model/ĐƠN GIÁ từ kho (không tin giá client); vai trò phải khớp vai trò cấu hình của bản ghi kho. Dòng thi công
/// (Installation) không có bản ghi kho nên cần đơn giá do ứng dụng gửi, có chặn trên. Dữ liệu sai ném RequestValidationException.
/// </summary>
internal static class EstimateItemBuilder
{
    public const int MaxItems = 50;

    public static async Task<List<DeploymentEstimateItem>> BuildAsync(SmartFarmDbContext db, IReadOnlyList<FarmWizardEstimateItemInput>? items, CancellationToken ct)
    {
        var result = new List<DeploymentEstimateItem>();
        if (items is null || items.Count == 0) return result;
        if (items.Count > MaxItems) throw new RequestValidationException("estimateItems", $"Tối đa {MaxItems} dòng dự toán.");
        var ids = items.Where(i => i.HardwareItemId.HasValue).Select(i => i.HardwareItemId!.Value).ToList();
        if (ids.Distinct().Count() != ids.Count) throw new RequestValidationException("estimateItems", "Một thiết bị chỉ được xuất hiện một lần trong dự toán.");
        var catalog = await db.PlatformHardwareItems.AsNoTracking().Where(x => ids.Contains(x.Id)).ToDictionaryAsync(x => x.Id, ct);
        var order = 0;
        foreach (var i in items)
        {
            if (i.Quantity is < 1 or > 1000) throw new RequestValidationException("estimateItems", "Số lượng mỗi dòng phải từ 1 đến 1000.");
            var note = string.IsNullOrWhiteSpace(i.Notes) ? null : i.Notes.Trim();
            if (note is { Length: > 1000 }) throw new RequestValidationException("estimateItems", "Ghi chú mỗi dòng tối đa 1000 ký tự.");
            if (i.HardwareItemId is { } hid)
            {
                if (!catalog.TryGetValue(hid, out var hw)) throw new RequestValidationException("estimateItems", "Có thiết bị trong dự toán không còn tồn tại trong danh mục.");
                var role = PlatformAdminService.EstimateRoles.FirstOrDefault(r => string.Equals(r, i.Role?.Trim(), StringComparison.OrdinalIgnoreCase))
                    ?? throw new RequestValidationException("estimateItems", "Vai trò dòng dự toán không hợp lệ.");
                if (hw.EstimateRole is not null && !string.Equals(hw.EstimateRole, role, StringComparison.OrdinalIgnoreCase))
                    throw new RequestValidationException("estimateItems", $"Thiết bị {hw.Code} không có vai trò {role} trong danh mục.");
                if (hw.UnitPrice <= 0) throw new RequestValidationException("estimateItems", $"Thiết bị {hw.Code} chưa có đơn giá hợp lệ trong danh mục.");
                result.Add(new DeploymentEstimateItem { HardwareItemId = hw.Id, SortOrder = order++, Code = hw.Code, Name = hw.Name, Model = hw.Model, Role = role, Quantity = i.Quantity, UnitPrice = hw.UnitPrice, Notes = note });
            }
            else
            {
                if (!string.Equals(i.Role?.Trim(), "Installation", StringComparison.OrdinalIgnoreCase)) throw new RequestValidationException("estimateItems", "Dòng không gắn thiết bị trong kho chỉ được là chi phí thi công (Installation).");
                if (i.UnitPrice is null or < 0 or > 10_000_000m) throw new RequestValidationException("estimateItems", "Chi phí thi công phải từ 0 đến 10.000.000 đ.");
                var name = string.IsNullOrWhiteSpace(i.Name) ? "Thi công, định vị GPS & cấu hình mạng mesh" : i.Name.Trim();
                if (name.Length > 300) throw new RequestValidationException("estimateItems", "Tên dòng tối đa 300 ký tự.");
                result.Add(new DeploymentEstimateItem { HardwareItemId = null, SortOrder = order++, Code = "INSTALLATION", Name = name, Role = "Installation", Quantity = i.Quantity, UnitPrice = i.UnitPrice.Value, Notes = note });
            }
        }
        return result;
    }
}
