using Microsoft.EntityFrameworkCore;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;

namespace SmartFarm.Infrastructure.IoTDeployment;

internal static class DeploymentSupport
{
    /// <summary>Yêu cầu triển khai còn đang xử lý: mỗi Zone chỉ được có một (khớp chỉ mục duy nhất của deployment_requests).</summary>
    internal static readonly DeploymentRequestStatus[] ActiveStatuses =
    [
        DeploymentRequestStatus.Submitted, DeploymentRequestStatus.Accepted, DeploymentRequestStatus.Surveyed,
        DeploymentRequestStatus.PlanConfirmed, DeploymentRequestStatus.Installing
    ];

    /// <summary>Mã lỗi của phiếu dịch vụ thuộc luồng lắp đặt: INSTALLATION do luồng triển khai tạo, NEW_INSTALL do cổng dịch vụ tạo.</summary>
    internal static bool IsInstallationCode(string? failureCode) =>
        string.Equals(failureCode, "INSTALLATION", StringComparison.OrdinalIgnoreCase)
        || string.Equals(failureCode, "NEW_INSTALL", StringComparison.OrdinalIgnoreCase);

    /// <summary>Đóng phiếu lắp đặt khi luồng triển khai kết thúc (nghiệm thu hoặc hủy), có ghi lịch sử; phiếu đã đóng thì bỏ qua.</summary>
    internal static void CloseInstallationRequest(SmartFarmDbContext db, ServiceRequest sr, Guid actorUserId, DateTime nowUtc, string notes)
    {
        if (sr.Status == ServiceRequestStatus.Closed || !IsInstallationCode(sr.FailureCode)) return;
        var from = sr.Status;
        sr.Status = ServiceRequestStatus.Closed;
        sr.ClosedAtUtc = nowUtc;
        db.ServiceRequestHistories.Add(new ServiceRequestHistory
        {
            ServiceRequestId = sr.Id, ActorUserId = actorUserId, EventType = ServiceHistoryEventType.Closed,
            FromStatus = from, ToStatus = ServiceRequestStatus.Closed, Notes = notes
        });
    }

    // Save in the caller's transaction so a submitted deployment always reaches dispatch/quotations.
    internal static async Task EnsureAsync(SmartFarmDbContext db, DeploymentRequest request, CancellationToken ct)
    {
        if (await db.ServiceRequests.AnyAsync(x => x.DeploymentRequestId == request.Id && x.FailureCode == "INSTALLATION", ct)) return;
        db.ServiceRequests.Add(new ServiceRequest
        {
            TenantId = request.TenantId, FarmId = request.FarmId, ZoneId = request.ZoneId,
            DeploymentRequestId = request.Id, Source = "DeploymentRequest", FailureCode = "INSTALLATION",
            Description = request.OwnerNotes ?? "Yêu cầu khảo sát và lắp đặt IoT cho Zone."
        });
    }
}
