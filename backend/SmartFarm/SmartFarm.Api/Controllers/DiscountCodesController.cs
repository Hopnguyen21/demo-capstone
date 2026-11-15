using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartFarm.Api.Extensions;
using SmartFarm.Application.Features.Finance;

namespace SmartFarm.Api.Controllers;

[ApiController]
[Route("api/v1/discount-codes")]
[Authorize]
public sealed class DiscountCodesController(IDiscountCodeService service) : ControllerBase
{
    /// <summary>Lấy danh sách mã giảm giá. Admin xem tất cả; Technician chỉ xem mã đang hoạt động.</summary>
    [HttpGet]
    [Authorize(Roles = "PlatformAdmin,PlatformTechnician,FarmOwner")]
    public async Task<ActionResult<IReadOnlyList<DiscountCodeView>>> GetAll(
        [FromQuery] bool? activeOnly = null,
        CancellationToken ct = default)
    {
        var isAdmin = User.IsInRole("PlatformAdmin");
        var filterActive = !isAdmin || (activeOnly ?? false);
        var result = await service.GetAllAsync(filterActive, ct);
        return Ok(result);
    }

    /// <summary>Chi tiết một mã giảm giá</summary>
    [HttpGet("{id:guid}")]
    [Authorize(Roles = "PlatformAdmin,PlatformTechnician")]
    public async Task<ActionResult<DiscountCodeView>> GetById([FromRoute] Guid id, CancellationToken ct)
    {
        var result = await service.GetByIdAsync(id, ct);
        return Ok(result);
    }

    /// <summary>Kiểm tra tính hợp lệ của mã giảm giá với giá trị hợp đồng cụ thể (Technician / Admin)</summary>
    [HttpPost("validate")]
    [Authorize(Roles = "PlatformAdmin,PlatformTechnician,FarmOwner")]
    public async Task<ActionResult<ValidateDiscountResult>> ValidateCode(
        [FromBody] ValidateDiscountRequest request,
        CancellationToken ct)
    {
        var result = await service.ValidateCodeAsync(request.Code, request.ContractAmount, ct);
        return Ok(result);
    }

    /// <summary>Tự động tìm mã giảm giá tối ưu nhất cho giá trị hợp đồng (Technician / Admin)</summary>
    [HttpGet("best-applicable")]
    [Authorize(Roles = "PlatformAdmin,PlatformTechnician,FarmOwner")]
    public async Task<ActionResult<BestDiscountResult>> GetBestDiscount(
        [FromQuery] decimal contractAmount,
        CancellationToken ct)
    {
        var result = await service.GetBestDiscountAsync(contractAmount, ct);
        return Ok(result);
    }

    /// <summary>Chỉ Platform Admin mới có quyền TẠO mã giảm giá</summary>
    [HttpPost]
    [Authorize(Roles = "PlatformAdmin")]
    public async Task<ActionResult<DiscountCodeView>> Create(
        [FromBody] CreateDiscountCodeCommand command,
        CancellationToken ct)
    {
        var result = await service.CreateAsync(User.GetUserId(), command, ct);
        return Created($"/api/v1/discount-codes/{result.Id}", result);
    }

    /// <summary>Chỉ Platform Admin mới có quyền SỬA mã giảm giá</summary>
    [HttpPut("{id:guid}")]
    [Authorize(Roles = "PlatformAdmin")]
    public async Task<ActionResult<DiscountCodeView>> Update(
        [FromRoute] Guid id,
        [FromBody] UpdateDiscountCodeCommand command,
        CancellationToken ct)
    {
        var result = await service.UpdateAsync(User.GetUserId(), id, command, ct);
        return Ok(result);
    }

    /// <summary>Chỉ Platform Admin mới có quyền XÓA mã giảm giá</summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "PlatformAdmin")]
    public async Task<IActionResult> Delete([FromRoute] Guid id, CancellationToken ct)
    {
        await service.DeleteAsync(User.GetUserId(), id, ct);
        return NoContent();
    }
}
