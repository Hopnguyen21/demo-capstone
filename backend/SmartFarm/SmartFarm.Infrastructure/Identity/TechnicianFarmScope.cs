using Microsoft.EntityFrameworkCore;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;

namespace SmartFarm.Infrastructure.Identity;

/// <summary>
/// Phạm vi trang trại mà một kỹ thuật viên nền tảng được phép đọc. Kỹ thuật viên không thuộc tenant nào nên không có phạm vi
/// "theo tenant"; thay vào đó chỉ đọc được trang trại có yêu cầu đang xử lý được giao cho chính họ:
/// yêu cầu lắp đặt đã tiếp nhận nhưng chưa hoàn tất, hoặc yêu cầu dịch vụ/bảo trì chưa Resolved/Closed.
/// Yêu cầu mới (Submitted, chưa ai tiếp nhận) và yêu cầu đã hoàn tất không cấp quyền: thông tin cần để quyết định tiếp nhận
/// đã có trong chi tiết yêu cầu. Dùng chung cho mọi service đọc dữ liệu theo trang trại để cùng một quy tắc.
/// </summary>
internal static class TechnicianFarmScope
{
    public static async Task<List<Guid>> LoadAsync(SmartFarmDbContext db, Guid technicianUserId, CancellationToken cancellationToken)
    {
        var fromDeployments = await db.DeploymentRequests.AsNoTracking()
            .Where(x => x.TechnicianUserId == technicianUserId
                && (x.Status == DeploymentRequestStatus.Accepted
                    || x.Status == DeploymentRequestStatus.Surveyed
                    || x.Status == DeploymentRequestStatus.PlanConfirmed
                    || x.Status == DeploymentRequestStatus.Installing
                    || x.Status == DeploymentRequestStatus.MaintenanceRequired))
            .Select(x => x.FarmId).ToListAsync(cancellationToken);
        var fromServiceRequests = await db.ServiceRequests.AsNoTracking()
            .Where(x => x.AssignedTechnicianId == technicianUserId
                && x.Status != ServiceRequestStatus.Resolved
                && x.Status != ServiceRequestStatus.Closed)
            .Select(x => x.FarmId).ToListAsync(cancellationToken);
        return fromDeployments.Concat(fromServiceRequests).Distinct().ToList();
    }
}
