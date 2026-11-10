using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartFarm.Api.Extensions;
using SmartFarm.Application.Features.Inventory;
using SmartFarm.Domain.Enums;

namespace SmartFarm.Api.Controllers;

[ApiController]
[Route("api/v1/farms/{farmId:guid}/stock-outs")]
[Authorize]
public sealed class StockOutsController(IStockOutService service) : ControllerBase
{
    private Guid GetEffectiveTenantId()
    {
        var opt = User.GetOptionalTenantId();
        if (opt.HasValue && opt.Value != Guid.Empty) return opt.Value;
        if (User.IsInRole("PlatformAdmin") || User.IsInRole("PlatformTechnician")) return Guid.Empty;
        return User.GetTenantId();
    }

    /// <summary>Danh sách phiếu xuất kho theo Farm (Chỉ Admin và Technician)</summary>
    [HttpGet]
    [Authorize(Roles = "PlatformAdmin,PlatformTechnician")]
    public async Task<ActionResult<IReadOnlyList<StockOutView>>> GetList(
        [FromRoute] Guid farmId,
        [FromQuery] StockOutStatus? status = null,
        CancellationToken ct = default)
    {
        var result = await service.GetListAsync(User.GetUserId(), GetEffectiveTenantId(), farmId, status, ct);
        return Ok(result);
    }

    /// <summary>Chi tiết một phiếu xuất kho (Chỉ Admin và Technician)</summary>
    [HttpGet("{id:guid}")]
    [Authorize(Roles = "PlatformAdmin,PlatformTechnician")]
    public async Task<ActionResult<StockOutView>> GetById(
        [FromRoute] Guid farmId,
        [FromRoute] Guid id,
        CancellationToken ct)
    {
        var result = await service.GetByIdAsync(User.GetUserId(), GetEffectiveTenantId(), farmId, id, ct);
        return Ok(result);
    }

    /// <summary>Tạo mới phiếu xuất kho (Chỉ Admin và Technician)</summary>
    [HttpPost]
    [Authorize(Roles = "PlatformAdmin,PlatformTechnician")]
    public async Task<ActionResult<StockOutView>> Create(
        [FromRoute] Guid farmId,
        [FromBody] CreateStockOutCommand command,
        CancellationToken ct)
    {
        var result = await service.CreateAsync(User.GetUserId(), GetEffectiveTenantId(), farmId, command, ct);
        return Created($"/api/v1/farms/{farmId}/stock-outs/{result.Id}", result);
    }

    /// <summary>Cập nhật phiếu xuất kho khi ở trạng thái Draft hoặc Pending (Chỉ Admin và Technician)</summary>
    [HttpPut("{id:guid}")]
    [Authorize(Roles = "PlatformAdmin,PlatformTechnician")]
    public async Task<ActionResult<StockOutView>> Update(
        [FromRoute] Guid farmId,
        [FromRoute] Guid id,
        [FromBody] UpdateStockOutCommand command,
        CancellationToken ct)
    {
        var result = await service.UpdateAsync(User.GetUserId(), GetEffectiveTenantId(), farmId, id, command, ct);
        return Ok(result);
    }

    /// <summary>Cập nhật trạng thái phiếu xuất kho - Duyệt, Hoàn thành, Hủy (Chỉ Admin và Technician)</summary>
    [HttpPut("{id:guid}/status")]
    [Authorize(Roles = "PlatformAdmin,PlatformTechnician")]
    public async Task<ActionResult<StockOutView>> UpdateStatus(
        [FromRoute] Guid farmId,
        [FromRoute] Guid id,
        [FromBody] UpdateStockOutStatusCommand command,
        CancellationToken ct)
    {
        var result = await service.UpdateStatusAsync(User.GetUserId(), GetEffectiveTenantId(), farmId, id, command, ct);
        return Ok(result);
    }

    /// <summary>Xóa phiếu xuất kho (Chỉ Admin và Technician)</summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "PlatformAdmin,PlatformTechnician")]
    public async Task<IActionResult> Delete(
        [FromRoute] Guid farmId,
        [FromRoute] Guid id,
        CancellationToken ct)
    {
        await service.DeleteAsync(User.GetUserId(), GetEffectiveTenantId(), farmId, id, ct);
        return NoContent();
    }
}

