using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartFarm.Api.Extensions;
using SmartFarm.Application.Features.Finance;

namespace SmartFarm.Api.Controllers;

[ApiController]
[Route("api/v1/contract-packages")]
[Authorize(Roles = "PlatformAdmin,PlatformTechnician")]
public sealed class ContractPackagesController(IContractPackageService packageService) : ControllerBase
{
    /// <summary>Danh sách gói hợp đồng (mặc định lấy tất cả gói chuẩn, hoặc lọc activeOnly=true, isCustom=false)</summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ContractPackageView>>> GetAll(
        [FromQuery] bool? activeOnly = null,
        [FromQuery] bool? isCustom = false,
        CancellationToken ct = default)
    {
        var result = await packageService.GetAllPackagesAsync(activeOnly, isCustom, ct);
        return Ok(result);
    }

    /// <summary>Xem chi tiết một gói hợp đồng</summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ContractPackageView>> GetById(Guid id, CancellationToken ct)
    {
        var result = await packageService.GetPackageByIdAsync(id, ct);
        return Ok(result);
    }

    /// <summary>Tạo mới gói hợp đồng (Admin & Technician)</summary>
    [HttpPost]
    [Authorize(Roles = "PlatformAdmin,PlatformTechnician")]
    public async Task<ActionResult<ContractPackageView>> Create(
        [FromBody] CreateContractPackageCommand command,
        CancellationToken ct)
    {
        var result = await packageService.CreatePackageAsync(User.GetUserId(), command, ct);
        return Created($"/api/v1/contract-packages/{result.Id}", result);
    }

    /// <summary>Chỉnh sửa gói hợp đồng (Admin & Technician)</summary>
    [HttpPut("{id:guid}")]
    [Authorize(Roles = "PlatformAdmin,PlatformTechnician")]
    public async Task<ActionResult<ContractPackageView>> Update(
        Guid id,
        [FromBody] UpdateContractPackageCommand command,
        CancellationToken ct)
    {
        var result = await packageService.UpdatePackageAsync(User.GetUserId(), id, command, ct);
        return Ok(result);
    }

    /// <summary>Kích hoạt / Vô hiệu hóa gói hợp đồng (Admin & Technician)</summary>
    [HttpPatch("{id:guid}/toggle-status")]
    [Authorize(Roles = "PlatformAdmin,PlatformTechnician")]
    public async Task<ActionResult<ContractPackageView>> ToggleStatus(Guid id, CancellationToken ct)
    {
        var result = await packageService.TogglePackageStatusAsync(User.GetUserId(), id, ct);
        return Ok(result);
    }

    /// <summary>Xóa gói hợp đồng (Admin, chỉ xóa được khi chưa có hợp đồng liên kết)</summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "PlatformAdmin")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await packageService.DeletePackageAsync(User.GetUserId(), id, ct);
        return NoContent();
    }
}

