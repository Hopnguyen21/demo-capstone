using SmartFarm.Domain.Entities;

namespace SmartFarm.Application.Features.Inventory;

public static class InventoryTaskMapping
{
    public static InventoryItemView ToView(this InventoryItem x) => new(x.Id, x.FarmId, x.Name, x.MaterialType, x.Unit, x.QuantityOnHand, x.LowStockThreshold, x.QuantityOnHand <= x.LowStockThreshold,
        x.Requirements.Select(r => new MaterialRequirementView(r.Id, r.CropId, r.VarietyId, r.GrowthStageId, r.RecommendedQuantity, r.Notes)).ToList());
    public static FarmTaskView ToView(this FarmTask x) => new(x.Id, x.FarmId, x.ZoneId, x.Title, x.Description, x.Requirements, x.DueAtUtc, x.AssignedFarmerId, x.Status, x.Result, x.FailureReason, x.AssignmentVersion, x.CreatedAtUtc,
        x.History.OrderBy(h => h.CreatedAtUtc).Select(h => new FarmTaskHistoryView(h.Id, h.EventType, h.FromStatus, h.ToStatus, h.ActorUserId, h.PreviousAssigneeId, h.NewAssigneeId, h.Notes, h.CreatedAtUtc)).ToList());
}
