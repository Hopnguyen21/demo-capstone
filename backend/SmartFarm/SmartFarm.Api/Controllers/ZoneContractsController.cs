using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartFarm.Api.Extensions;
using SmartFarm.Application.Features.Finance;

namespace SmartFarm.Api.Controllers;

[ApiController]
[Authorize]
public sealed class ZoneContractsController(IZoneContractService contractService) : ControllerBase
{
    /// <summary>Danh sách tất cả hợp đồng Zone</summary>
    [HttpGet("api/v1/zone-contracts")]
    [Authorize(Roles = "FarmOwner,PlatformAdmin,PlatformTechnician")]
    public async Task<ActionResult<IReadOnlyList<ZoneContractView>>> GetAll(CancellationToken ct)
    {
        return Ok(await contractService.GetAllContractsAsync(User.GetUserId(), ct));
    }

    /// <summary>Danh sách hợp đồng thuộc Farm</summary>
    [HttpGet("api/v1/farms/{farmId:guid}/zone-contracts")]
    [Authorize(Roles = "FarmOwner,PlatformAdmin,PlatformTechnician")]
    public async Task<ActionResult<IReadOnlyList<ZoneContractView>>> GetByFarm(Guid farmId, CancellationToken ct)
    {
        return Ok(await contractService.GetContractsByFarmAsync(User.GetUserId(), farmId, ct));
    }

    /// <summary>Lịch sử hợp đồng của từng Zone (Contract History)</summary>
    [HttpGet("api/v1/zones/{zoneId:guid}/contracts")]
    [Authorize(Roles = "FarmOwner,PlatformAdmin,PlatformTechnician")]
    public async Task<ActionResult<IReadOnlyList<ZoneContractView>>> GetByZone(Guid zoneId, CancellationToken ct)
    {
        return Ok(await contractService.GetContractsByZoneAsync(User.GetUserId(), zoneId, ct));
    }

    /// <summary>Xem chi tiết một hợp đồng</summary>
    [HttpGet("api/v1/zone-contracts/{id:guid}")]
    [Authorize(Roles = "FarmOwner,PlatformAdmin,PlatformTechnician")]
    public async Task<ActionResult<ZoneContractView>> GetById(Guid id, CancellationToken ct)
    {
        return Ok(await contractService.GetContractByIdAsync(User.GetUserId(), id, ct));
    }

    /// <summary>Tạo hợp đồng mới cho Zone (hỗ trợ liên kết ParentContractId cho khách hàng cũ kèm chiết khấu)</summary>
    [HttpPost("api/v1/zones/{zoneId:guid}/contracts")]
    [Authorize(Roles = "FarmOwner,PlatformAdmin")]
    public async Task<ActionResult<ZoneContractView>> Create(
        Guid zoneId,
        [FromBody] CreateZoneContractCommand command,
        CancellationToken ct)
    {
        var result = await contractService.CreateContractAsync(
            User.GetUserId(),
            User.GetOptionalTenantId() ?? Guid.Parse("10000000-0000-0000-0000-000000000001"),
            zoneId,
            command,
            ct);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    /// <summary>Gia hạn hợp đồng (Renew Contract: 6 tháng, 1 năm, 3 năm hoặc tùy chỉnh)</summary>
    [HttpPost("api/v1/zone-contracts/{id:guid}/renew")]
    [Authorize(Roles = "FarmOwner,PlatformAdmin")]
    public async Task<ActionResult<ZoneContractView>> Renew(
        Guid id,
        [FromBody] RenewZoneContractCommand command,
        CancellationToken ct)
    {
        return Ok(await contractService.RenewContractAsync(User.GetUserId(), id, command, ct));
    }

    /// <summary>Cảnh báo các hợp đồng sắp hết hạn (mặc định nhắc trước ít nhất 30 ngày)</summary>
    [HttpGet("api/v1/zone-contracts/expiring")]
    [Authorize(Roles = "FarmOwner,PlatformAdmin,PlatformTechnician")]
    public async Task<ActionResult<IReadOnlyList<ExpiringContractAlertView>>> GetExpiring(
        [FromQuery] Guid? farmId = null,
        [FromQuery] int daysThreshold = 30,
        CancellationToken ct = default)
    {
        return Ok(await contractService.GetExpiringContractsAsync(User.GetUserId(), farmId, daysThreshold, ct));
    }

    /// <summary>Danh sách khấu hao thiết bị theo Zone</summary>
    [HttpGet("api/v1/zones/{zoneId:guid}/depreciations")]
    [Authorize(Roles = "FarmOwner,PlatformAdmin,PlatformTechnician")]
    public async Task<ActionResult<IReadOnlyList<DeviceDepreciationView>>> GetDepreciationsByZone(Guid zoneId, CancellationToken ct)
    {
        return Ok(await contractService.GetDepreciationsByZoneAsync(User.GetUserId(), zoneId, ct));
    }

    /// <summary>Danh sách khấu hao thiết bị theo Farm</summary>
    [HttpGet("api/v1/farms/{farmId:guid}/depreciations")]
    [Authorize(Roles = "FarmOwner,PlatformAdmin,PlatformTechnician")]
    public async Task<ActionResult<IReadOnlyList<DeviceDepreciationView>>> GetDepreciationsByFarm(Guid farmId, CancellationToken ct)
    {
        return Ok(await contractService.GetDepreciationsByFarmAsync(User.GetUserId(), farmId, ct));
    }

    /// <summary>Thêm hồ sơ khấu hao thiết bị cho Zone</summary>
    [HttpPost("api/v1/zones/{zoneId:guid}/depreciations")]
    [Authorize(Roles = "FarmOwner,PlatformAdmin,PlatformTechnician")]
    public async Task<ActionResult<DeviceDepreciationView>> CreateDepreciation(
        Guid zoneId,
        [FromBody] CreateDeviceDepreciationCommand command,
        CancellationToken ct)
    {
        var result = await contractService.CreateDepreciationAsync(
            User.GetUserId(),
            User.GetOptionalTenantId() ?? Guid.Parse("10000000-0000-0000-0000-000000000001"),
            zoneId,
            command,
            ct);
        return StatusCode(StatusCodes.Status201Created, result);
    }
}
