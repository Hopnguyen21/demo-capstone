using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartFarm.Api.Extensions;
using SmartFarm.Application.Features.Inventory;
using SmartFarm.Domain.Enums;

namespace SmartFarm.Api.Controllers;

[ApiController, Route("api/v1/farms/{farmId:guid}")]
[Authorize(Roles = "FarmOwner,Farmer")]
public sealed class InventoryTasksController(IInventoryTaskService service) : ControllerBase
{
    // API catalog #96
    [HttpGet("inventory")]
    public async Task<ActionResult<IReadOnlyList<InventoryItemView>>> Inventory(Guid farmId, CancellationToken ct) => Ok(await service.ListInventoryAsync(User.GetUserId(), User.GetTenantId(), farmId, ct));

    // API catalog #97. Creation is not an implicit upsert; receipts use the endpoint below.
    [HttpPost("inventory"), Authorize(Roles = "FarmOwner")]
    public async Task<ActionResult<InventoryItemView>> CreateItem(Guid farmId, CreateInventoryItemRequest r, CancellationToken ct)
    {
        var result = await service.CreateItemAsync(User.GetUserId(), User.GetTenantId(), farmId, new(r.Name, r.MaterialType, r.Unit, r.LowStockThreshold, r.InitialQuantity, r.Requirements?.Select(x => x.Command()).ToList()), ct);
        return Created($"/api/v1/farms/{farmId}/inventory/{result.Id}", result);
    }

    [HttpPost("inventory/{itemId:guid}/receipts"), Authorize(Roles = "FarmOwner")]
    public async Task<ActionResult<InventoryMovementView>> Receive(Guid farmId, Guid itemId, ReceiveInventoryRequest r, CancellationToken ct) => Ok(await service.ReceiveAsync(User.GetUserId(), User.GetTenantId(), farmId, itemId, new(r.Quantity, r.Notes), ct));

    [HttpPut("inventory/{itemId:guid}/requirements"), Authorize(Roles = "FarmOwner")]
    public async Task<ActionResult<InventoryItemView>> Requirements(Guid farmId, Guid itemId, IReadOnlyList<MaterialRequirementRequest> r, CancellationToken ct) => Ok(await service.ReplaceRequirementsAsync(User.GetUserId(), User.GetTenantId(), farmId, itemId, r.Select(x => x.Command()).ToList(), ct));

    // API catalog #98
    [HttpPost("inventory/issues")]
    public async Task<ActionResult<InventoryMovementView>> Issue(Guid farmId, IssueInventoryRequest r, CancellationToken ct) => Ok(await service.IssueAsync(User.GetUserId(), User.GetTenantId(), farmId, new(r.InventoryItemId, r.Quantity, r.ZoneId, r.TaskId, r.Notes), ct));

    [HttpGet("inventory/low-stock-alerts"), Authorize(Roles = "FarmOwner")]
    public async Task<ActionResult<IReadOnlyList<LowStockAlertView>>> LowStock(Guid farmId, CancellationToken ct) => Ok(await service.ListLowStockAlertsAsync(User.GetUserId(), User.GetTenantId(), farmId, ct));

    // API catalog #99
    [HttpGet("tasks")]
    public async Task<ActionResult<IReadOnlyList<FarmTaskView>>> Tasks(Guid farmId, CancellationToken ct) => Ok(await service.ListTasksAsync(User.GetUserId(), User.GetTenantId(), farmId, ct));

    // API catalog #100
    [HttpPost("tasks"), Authorize(Roles = "FarmOwner")]
    public async Task<ActionResult<FarmTaskView>> CreateTask(Guid farmId, CreateFarmTaskRequest r, CancellationToken ct)
    {
        var result = await service.CreateTaskAsync(User.GetUserId(), User.GetTenantId(), farmId, new(r.ZoneId, r.Title, r.Description, r.Requirements, r.DueAtUtc, r.AssignedFarmerId), ct);
        return Created($"/api/v1/farms/{farmId}/tasks/{result.Id}", result);
    }

    // API catalog #101
    [HttpPut("tasks/{taskId:guid}")]
    public async Task<ActionResult<FarmTaskView>> UpdateTask(Guid farmId, Guid taskId, UpdateFarmTaskRequest r, CancellationToken ct) => Ok(await service.UpdateTaskAsync(User.GetUserId(), User.GetTenantId(), farmId, taskId, new(r.Action, r.Result, r.FailureReason, r.AssignedFarmerId, r.Notes), ct));
}

public sealed class CreateInventoryItemRequest { [Required, StringLength(160)] public string Name { get; init; } = ""; public MaterialType MaterialType { get; init; } [Required, StringLength(30)] public string Unit { get; init; } = ""; [Range(typeof(decimal), "0", "999999999999")] public decimal LowStockThreshold { get; init; } [Range(typeof(decimal), "0", "999999999999")] public decimal InitialQuantity { get; init; } public IReadOnlyList<MaterialRequirementRequest>? Requirements { get; init; } }
public sealed class MaterialRequirementRequest { public Guid? CropId { get; init; } public Guid? VarietyId { get; init; } public Guid? GrowthStageId { get; init; } public decimal? RecommendedQuantity { get; init; } [StringLength(500)] public string? Notes { get; init; } internal MaterialRequirementCommand Command() => new(CropId, VarietyId, GrowthStageId, RecommendedQuantity, Notes); }
public sealed class ReceiveInventoryRequest { public decimal Quantity { get; init; } [StringLength(500)] public string? Notes { get; init; } }
public sealed class IssueInventoryRequest { public Guid InventoryItemId { get; init; } public decimal Quantity { get; init; } public Guid ZoneId { get; init; } public Guid? TaskId { get; init; } [StringLength(500)] public string? Notes { get; init; } }
public sealed class CreateFarmTaskRequest { public Guid ZoneId { get; init; } [Required, StringLength(200)] public string Title { get; init; } = ""; [StringLength(2000)] public string? Description { get; init; } [StringLength(2000)] public string? Requirements { get; init; } public DateTime DueAtUtc { get; init; } public Guid AssignedFarmerId { get; init; } }
public sealed class UpdateFarmTaskRequest { public FarmTaskAction Action { get; init; } [StringLength(2000)] public string? Result { get; init; } [StringLength(2000)] public string? FailureReason { get; init; } public Guid? AssignedFarmerId { get; init; } [StringLength(1000)] public string? Notes { get; init; } }
