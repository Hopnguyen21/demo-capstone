using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartFarm.Api.Extensions;
using SmartFarm.Application.Features.Finance;
using SmartFarm.Domain.Enums;

namespace SmartFarm.Api.Controllers;

[ApiController]
[Authorize]
public sealed class BillsController(IBillService billService) : ControllerBase
{
    private Guid? GetEnforcedTenantId()
    {
        var isPlatformStaff = User.IsInRole("PlatformAdmin") || User.IsInRole("PlatformTechnician");
        var tenantId = User.GetOptionalTenantId();
        if (!isPlatformStaff && (!tenantId.HasValue || tenantId.Value == Guid.Empty))
        {
            throw new UnauthorizedAccessException("Tài khoản yêu cầu TenantId hợp lệ.");
        }
        return isPlatformStaff ? tenantId : tenantId!.Value;
    }

    /// <summary>Danh sách hóa đơn (hỗ trợ lọc theo contract, trạng thái, ngày phát hành)</summary>
    [HttpGet("api/v1/bills")]
    [Authorize(Roles = "FarmOwner,PlatformAdmin,PlatformTechnician")]
    public async Task<ActionResult<IReadOnlyList<BillView>>> GetAll(
        [FromQuery] Guid? contractId = null,
        [FromQuery] BillStatus? status = null,
        [FromQuery] DateOnly? fromDate = null,
        [FromQuery] DateOnly? toDate = null,
        CancellationToken ct = default)
    {
        var result = await billService.GetBillsAsync(User.GetUserId(), GetEnforcedTenantId(), contractId, status, fromDate, toDate, ct);
        return Ok(result);
    }

    /// <summary>Chi tiết một hóa đơn</summary>
    [HttpGet("api/v1/bills/{id:guid}")]
    [Authorize(Roles = "FarmOwner,PlatformAdmin,PlatformTechnician")]
    public async Task<ActionResult<BillView>> GetById(Guid id, CancellationToken ct)
    {
        var result = await billService.GetBillByIdAsync(User.GetUserId(), GetEnforcedTenantId(), id, ct);
        return Ok(result);
    }

    /// <summary>Danh sách hóa đơn theo hợp đồng cụ thể</summary>
    [HttpGet("api/v1/contracts/{contractId:guid}/bills")]
    [Authorize(Roles = "FarmOwner,PlatformAdmin,PlatformTechnician")]
    public async Task<ActionResult<IReadOnlyList<BillView>>> GetByContract(Guid contractId, CancellationToken ct)
    {
        var result = await billService.GetBillsByContractAsync(User.GetUserId(), GetEnforcedTenantId(), contractId, ct);
        return Ok(result);
    }

    /// <summary>Tạo hóa đơn độc lập từ hợp đồng (Chỉ Admin và Technician)</summary>
    [HttpPost("api/v1/bills")]
    [Authorize(Roles = "PlatformAdmin,PlatformTechnician")]
    public async Task<ActionResult<BillView>> CreateFromContract(
        [FromBody] CreateBillFromContractCommand command,
        CancellationToken ct)
    {
        var result = await billService.CreateBillFromContractAsync(User.GetUserId(), GetEnforcedTenantId(), command, ct);
        return Created($"/api/v1/bills/{result.Id}", result);
    }

    /// <summary>Ghi nhận thanh toán cho hóa đơn - toàn bộ hoặc một phần (Chỉ Admin và Technician)</summary>
    [HttpPost("api/v1/bills/{id:guid}/payments")]
    [Authorize(Roles = "PlatformAdmin,PlatformTechnician")]
    public async Task<ActionResult<BillView>> RecordPayment(
        Guid id,
        [FromBody] RecordBillPaymentCommand command,
        CancellationToken ct)
    {
        var result = await billService.RecordPaymentAsync(User.GetUserId(), GetEnforcedTenantId(), id, command, ct);
        return Ok(result);
    }

    /// <summary>Cập nhật trạng thái hóa đơn (Chỉ Admin và Technician)</summary>
    [HttpPut("api/v1/bills/{id:guid}/status")]
    [Authorize(Roles = "PlatformAdmin,PlatformTechnician")]
    public async Task<ActionResult<BillView>> UpdateStatus(
        Guid id,
        [FromBody] UpdateBillStatusCommand command,
        CancellationToken ct)
    {
        var result = await billService.UpdateBillStatusAsync(User.GetUserId(), GetEnforcedTenantId(), id, command, ct);
        return Ok(result);
    }

    /// <summary>Chỉnh sửa hóa đơn khi chưa hoàn tất thanh toán (Chỉ Admin và Technician)</summary>
    [HttpPut("api/v1/bills/{id:guid}")]
    [Authorize(Roles = "PlatformAdmin,PlatformTechnician")]
    public async Task<ActionResult<BillView>> Update(
        Guid id,
        [FromBody] UpdateBillCommand command,
        CancellationToken ct)
    {
        var result = await billService.UpdateBillAsync(User.GetUserId(), GetEnforcedTenantId(), id, command, ct);
        return Ok(result);
    }

    /// <summary>Xóa hóa đơn nháp hoặc đã hủy (Chỉ Admin và Technician)</summary>
    [HttpDelete("api/v1/bills/{id:guid}")]
    [Authorize(Roles = "PlatformAdmin,PlatformTechnician")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await billService.DeleteBillAsync(User.GetUserId(), GetEnforcedTenantId(), id, ct);
        return NoContent();
    }
}

