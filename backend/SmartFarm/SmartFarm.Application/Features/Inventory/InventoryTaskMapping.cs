using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;

namespace SmartFarm.Application.Features.Inventory;

public static class InventoryTaskMapping
{
    public static InventoryItemView ToView(this InventoryItem x) => new(x.Id, x.FarmId, x.Name, x.MaterialType, x.Unit, x.QuantityOnHand, x.LowStockThreshold, x.QuantityOnHand <= x.LowStockThreshold,
        x.Requirements.Select(r => new MaterialRequirementView(r.Id, r.CropId, r.VarietyId, r.GrowthStageId, r.RecommendedQuantity, r.Notes)).ToList());

    /// <summary>
    /// Owner (viewerFarmerId = null) thấy mọi phân công và toàn bộ lịch sử. Farmer chỉ thấy phân công của chính mình và các sự kiện chung hoặc của mình,
    /// không thấy kết quả, ghi chú hay lịch sử riêng của Farmer khác.
    /// </summary>
    public static FarmTaskView ToView(this FarmTask x, Guid? viewerFarmerId = null)
    {
        var assignments = x.Assignments.Where(a => viewerFarmerId is null || a.FarmerId == viewerFarmerId)
            .OrderBy(a => a.AssignedAtUtc).ThenBy(a => a.Farmer?.FullName)
            .Select(a => new FarmTaskAssignmentView(a.Id, a.FarmerId, a.Farmer?.FullName ?? string.Empty, a.Status, a.ProgressPercent, a.ProgressNote, a.Result, a.FailureReason,
                a.AssignmentVersion, a.AssignedAtUtc, a.AcceptedAtUtc, a.StartedAtUtc, a.SubmittedAtUtc, a.ApprovedAtUtc)).ToList();
        var history = x.History.Where(h => viewerFarmerId is null || h.SubjectFarmerId is null || h.SubjectFarmerId == viewerFarmerId)
            .OrderBy(h => h.CreatedAtUtc)
            .Select(h => new FarmTaskHistoryView(h.Id, h.EventType, h.FromStatus, h.ToStatus, h.ActorUserId, h.SubjectFarmerId, h.Notes, h.CreatedAtUtc)).ToList();
        // Farmer thấy trạng thái của chính phân công của mình; Owner thấy trạng thái tổng hợp.
        var status = viewerFarmerId is null ? x.Status : assignments.FirstOrDefault()?.Status ?? x.Status;
        return new(x.Id, x.FarmId, x.ZoneId, x.Title, x.Description, x.Requirements, x.DueAtUtc, status, x.CreatedAtUtc, assignments, history);
    }
}

/// <summary>Quy tắc tổng hợp trạng thái công việc từ các phân công đang hiệu lực (không tính Cancelled/Declined).</summary>
public static class FarmTaskAggregate
{
    public static FarmTaskStatus Compute(IEnumerable<FarmTaskAssignment> assignments)
    {
        var all = assignments.ToList();
        var active = all.Where(a => a.Status is not (FarmTaskStatus.Cancelled or FarmTaskStatus.Declined)).Select(a => a.Status).ToList();
        if (active.Count == 0)
            // Mọi người đều từ chối: cần Owner giao lại. Mọi người bị gỡ: công việc bị hủy.
            return all.Any(a => a.Status == FarmTaskStatus.Declined) ? FarmTaskStatus.Failed : FarmTaskStatus.Cancelled;
        if (active.All(s => s == FarmTaskStatus.Approved)) return FarmTaskStatus.Approved;
        // Còn người đang làm/chưa nhận thì công việc chưa xong; chỉ khi không còn ai đang làm mới tới trạng thái chờ duyệt/quá hạn/thất bại.
        foreach (var s in new[] { FarmTaskStatus.InProgress, FarmTaskStatus.Accepted, FarmTaskStatus.Pending, FarmTaskStatus.CompletedPendingReview, FarmTaskStatus.Overdue, FarmTaskStatus.Failed })
            if (active.Contains(s)) return s;
        return FarmTaskStatus.Approved;
    }
}
