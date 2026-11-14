using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartFarm.Api.Extensions;
using SmartFarm.Application.Features.Inventory;
using SmartFarm.Domain.Enums;

namespace SmartFarm.Api.Controllers;

[ApiController]
[Route("api/v1/farms/{farmId:guid}/stock-ins")]
[Authorize]
public sealed class StockInsController(IStockInService service) : ControllerBase
{
    private Guid GetEffectiveTenantId()
    {
        var opt = User.GetOptionalTenantId();
        if (opt.HasValue && opt.Value != Guid.Empty) return opt.Value;
        if (User.IsInRole("PlatformAdmin") || User.IsInRole("PlatformTechnician")) return Guid.Empty;
        return User.GetTenantId();
    }

    /// <summary>Danh sách phiếu nhập kho theo Farm (PlatformAdmin, PlatformTechnician, FarmOwner)</summary>
    [HttpGet]
    [Authorize(Roles = "PlatformAdmin,PlatformTechnician,FarmOwner")]
    public async Task<ActionResult<IReadOnlyList<StockInView>>> GetList(
        [FromRoute] Guid farmId,
        [FromQuery] StockInStatus? status = null,
        CancellationToken ct = default)
    {
        var result = await service.GetListAsync(User.GetUserId(), GetEffectiveTenantId(), farmId, status, ct);
        return Ok(result);
    }

    /// <summary>Chi tiết một phiếu nhập kho</summary>
    [HttpGet("{id:guid}")]
    [Authorize(Roles = "PlatformAdmin,PlatformTechnician,FarmOwner")]
    public async Task<ActionResult<StockInView>> GetById(
        [FromRoute] Guid farmId,
        [FromRoute] Guid id,
        CancellationToken ct)
    {
        var result = await service.GetByIdAsync(User.GetUserId(), GetEffectiveTenantId(), farmId, id, ct);
        return Ok(result);
    }

    /// <summary>Tạo mới phiếu nhập kho</summary>
    [HttpPost]
    [Authorize(Roles = "PlatformAdmin,PlatformTechnician,FarmOwner")]
    public async Task<ActionResult<StockInView>> Create(
        [FromRoute] Guid farmId,
        [FromBody] CreateStockInCommand command,
        CancellationToken ct)
    {
        var result = await service.CreateAsync(User.GetUserId(), GetEffectiveTenantId(), farmId, command, ct);
        return Created($"/api/v1/farms/{farmId}/stock-ins/{result.Id}", result);
    }

    /// <summary>Cập nhật phiếu nhập kho khi ở trạng thái Draft hoặc Pending</summary>
    [HttpPut("{id:guid}")]
    [Authorize(Roles = "PlatformAdmin,PlatformTechnician,FarmOwner")]
    public async Task<ActionResult<StockInView>> Update(
        [FromRoute] Guid farmId,
        [FromRoute] Guid id,
        [FromBody] UpdateStockInCommand command,
        CancellationToken ct)
    {
        var result = await service.UpdateAsync(User.GetUserId(), GetEffectiveTenantId(), farmId, id, command, ct);
        return Ok(result);
    }

    /// <summary>Cập nhật trạng thái phiếu nhập kho - Duyệt, Hoàn thành, Hủy</summary>
    [HttpPut("{id:guid}/status")]
    [Authorize(Roles = "PlatformAdmin,PlatformTechnician,FarmOwner")]
    public async Task<ActionResult<StockInView>> UpdateStatus(
        [FromRoute] Guid farmId,
        [FromRoute] Guid id,
        [FromBody] UpdateStockInStatusCommand command,
        CancellationToken ct)
    {
        var result = await service.UpdateStatusAsync(User.GetUserId(), GetEffectiveTenantId(), farmId, id, command, ct);
        return Ok(result);
    }

    /// <summary>Xóa phiếu nhập kho</summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "PlatformAdmin,PlatformTechnician,FarmOwner")]
    public async Task<IActionResult> Delete(
        [FromRoute] Guid farmId,
        [FromRoute] Guid id,
        CancellationToken ct)
    {
        await service.DeleteAsync(User.GetUserId(), GetEffectiveTenantId(), farmId, id, ct);
        return NoContent();
    }
}
