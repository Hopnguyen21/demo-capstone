using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartFarm.Api.Extensions;
using SmartFarm.Application.Features.CropGrowth;
using SmartFarm.Domain.Entities;
using SmartFarm.Infrastructure.Persistence;

namespace SmartFarm.Api.Controllers;

[ApiController, Authorize]
public sealed class SeasonsController(SmartFarmDbContext dbContext) : ControllerBase
{
    [HttpGet("api/v1/seasons")]
    public async Task<ActionResult<IReadOnlyList<FarmingSeasonView>>> ListSeasons([FromQuery] int? year, [FromQuery] string? status, CancellationToken ct)
    {
        var tenantId = User.GetOptionalTenantId();
        await EnsureSeedSeasonsAsync(ct);

        var isPlatformAdmin = User.IsInRole("PlatformAdmin");
        var query = dbContext.FarmingSeasons
            .Include(x => x.PlantingSeasons)
            .AsNoTracking()
            .Where(x => x.IsActive);

        if (!isPlatformAdmin)
        {
            if (tenantId.HasValue && tenantId.Value != Guid.Empty)
            {
                query = query.Where(x => x.TenantId == null || x.TenantId == tenantId.Value);
            }
            else
            {
                query = query.Where(x => x.TenantId == null);
            }
        }

        if (year.HasValue) query = query.Where(x => x.Year == year.Value);
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(x => x.Status.ToLower() == status.ToLower());

        var list = await query
            .OrderByDescending(x => x.Year)
            .ThenBy(x => x.StartDate)
            .Select(x => new FarmingSeasonView(
                x.Id,
                x.Code,
                x.Name,
                x.Year,
                x.StartDate,
                x.EndDate,
                x.Description,
                x.Status,
                x.IsActive,
                x.PlantingSeasons.Count))
            .ToListAsync(ct);

        return Ok(list);
    }

    [HttpGet("api/v1/seasons/{id:guid}")]
    public async Task<ActionResult<FarmingSeasonView>> GetSeason(Guid id, CancellationToken ct)
    {
        var tenantId = User.GetOptionalTenantId();
        var isPlatformAdmin = User.IsInRole("PlatformAdmin");
        var query = dbContext.FarmingSeasons
            .Include(x => x.PlantingSeasons)
            .AsNoTracking();

        if (!isPlatformAdmin)
        {
            if (tenantId.HasValue && tenantId.Value != Guid.Empty)
            {
                query = query.Where(x => x.TenantId == null || x.TenantId == tenantId.Value);
            }
            else
            {
                query = query.Where(x => x.TenantId == null);
            }
        }

        var season = await query.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (season == null) return NotFound(new { message = "Vụ mùa không tồn tại hoặc bạn không có quyền truy cập." });

        return Ok(new FarmingSeasonView(
            season.Id,
            season.Code,
            season.Name,
            season.Year,
            season.StartDate,
            season.EndDate,
            season.Description,
            season.Status,
            season.IsActive,
            season.PlantingSeasons.Count));
    }

    [HttpPost("api/v1/seasons"), Authorize(Roles = "FarmOwner,PlatformAdmin")]
    public async Task<ActionResult<FarmingSeasonView>> CreateSeason([FromBody] CreateFarmingSeasonRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { message = "Tên vụ mùa là bắt buộc." });
        if (request.EndDate <= request.StartDate)
            return BadRequest(new { message = "Ngày kết thúc vụ mùa phải sau ngày bắt đầu." });

        var tenantId = User.GetOptionalTenantId();
        var isPlatformAdmin = User.IsInRole("PlatformAdmin");
        var effectiveTenantId = isPlatformAdmin ? null : tenantId;

        var code = string.IsNullOrWhiteSpace(request.Code)
            ? $"VU-{request.Year}-{Guid.NewGuid():N}"[..12].ToUpper()
            : request.Code.Trim().ToUpper();

        var exists = await dbContext.FarmingSeasons.AnyAsync(x =>
            x.Code == code && (x.TenantId == null || x.TenantId == effectiveTenantId) && x.IsActive, ct);
        if (exists)
            return Conflict(new { message = $"Mã vụ mùa '{code}' đã tồn tại trong hệ thống." });

        var season = new FarmingSeason
        {
            TenantId = effectiveTenantId,
            Code = code,
            Name = request.Name.Trim(),
            Year = request.Year > 2000 ? request.Year : DateTime.UtcNow.Year,
            StartDate = request.StartDate,
            EndDate = request.EndDate,
            Description = request.Description?.Trim(),
            Status = string.IsNullOrWhiteSpace(request.Status) ? "Active" : request.Status.Trim(),
            IsActive = true
        };

        dbContext.FarmingSeasons.Add(season);
        await dbContext.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetSeason), new { id = season.Id }, new FarmingSeasonView(
            season.Id,
            season.Code,
            season.Name,
            season.Year,
            season.StartDate,
            season.EndDate,
            season.Description,
            season.Status,
            season.IsActive,
            0));
    }

    [HttpPut("api/v1/seasons/{id:guid}"), Authorize(Roles = "FarmOwner,PlatformAdmin")]
    public async Task<ActionResult<FarmingSeasonView>> UpdateSeason(Guid id, [FromBody] UpdateFarmingSeasonRequest request, CancellationToken ct)
    {
        var tenantId = User.GetOptionalTenantId();
        var isPlatformAdmin = User.IsInRole("PlatformAdmin");

        var query = dbContext.FarmingSeasons.Include(x => x.PlantingSeasons).AsQueryable();
        if (!isPlatformAdmin)
        {
            if (!tenantId.HasValue || tenantId.Value == Guid.Empty)
            {
                return Forbid();
            }
            // FarmOwner chỉ được chỉnh sửa vụ mùa do chính tenant tạo ra, không được sửa vụ mùa toàn cục (TenantId == null)
            query = query.Where(x => x.TenantId == tenantId.Value);
        }

        var season = await query.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (season == null)
            return NotFound(new { message = "Vụ mùa không tồn tại hoặc bạn không có quyền sửa đổi vụ mùa này (vụ mùa mẫu toàn cục chỉ Admin mới có quyền cập nhật)." });

        if (string.IsNullOrWhiteSpace(request.Name)) return BadRequest(new { message = "Tên vụ mùa là bắt buộc." });
        if (request.EndDate <= request.StartDate) return BadRequest(new { message = "Ngày kết thúc vụ mùa phải sau ngày bắt đầu." });

        season.Name = request.Name.Trim();
        season.Code = string.IsNullOrWhiteSpace(request.Code) ? season.Code : request.Code.Trim().ToUpper();
        season.Year = request.Year;
        season.StartDate = request.StartDate;
        season.EndDate = request.EndDate;
        season.Description = request.Description?.Trim();
        if (!string.IsNullOrWhiteSpace(request.Status)) season.Status = request.Status.Trim();

        await dbContext.SaveChangesAsync(ct);

        return Ok(new FarmingSeasonView(
            season.Id,
            season.Code,
            season.Name,
            season.Year,
            season.StartDate,
            season.EndDate,
            season.Description,
            season.Status,
            season.IsActive,
            season.PlantingSeasons.Count));
    }

    [HttpDelete("api/v1/seasons/{id:guid}"), Authorize(Roles = "FarmOwner,PlatformAdmin")]
    public async Task<IActionResult> DeleteSeason(Guid id, CancellationToken ct)
    {
        var tenantId = User.GetOptionalTenantId();
        var isPlatformAdmin = User.IsInRole("PlatformAdmin");

        var query = dbContext.FarmingSeasons.Include(x => x.PlantingSeasons).AsQueryable();
        if (!isPlatformAdmin)
        {
            if (!tenantId.HasValue || tenantId.Value == Guid.Empty)
            {
                return Forbid();
            }
            // FarmOwner chỉ được lưu trữ/xóa vụ mùa của chính tenant mình, không được xóa vụ mùa hệ thống
            query = query.Where(x => x.TenantId == tenantId.Value);
        }

        var season = await query.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (season == null)
            return NotFound(new { message = "Vụ mùa không tồn tại hoặc bạn không có quyền xóa vụ mùa này." });

        var hasActivePlantings = await dbContext.PlantingSeasons
            .AnyAsync(p => p.FarmingSeasonId == id && p.Status == SmartFarm.Domain.Enums.PlantingSeasonStatus.InProgress, ct);
        if (hasActivePlantings)
        {
            return BadRequest(new { message = "Không thể lưu trữ hoặc xóa vụ mùa này vì vẫn còn đợt gieo trồng (Planting Season) đang trong trạng thái InProgress." });
        }

        // Soft delete / archive to preserve history
        season.IsActive = false;
        season.Status = "Completed";
        await dbContext.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpGet("api/v1/seasons/{id:guid}/planting-crops")]
    public async Task<ActionResult<IReadOnlyList<PlantingSeasonView>>> GetSeasonPlantingCrops(Guid id, CancellationToken ct)
    {
        var tenantId = User.GetOptionalTenantId();
        var isPlatformAdmin = User.IsInRole("PlatformAdmin");

        var query = dbContext.PlantingSeasons
            .Include(x => x.Zone).ThenInclude(x => x.Field).ThenInclude(x => x.Farm)
            .Include(x => x.Crop)
            .Include(x => x.Variety)
            .Include(x => x.GrowthProfile)
            .Include(x => x.CurrentGrowthStage)
            .Include(x => x.AppliedRequirements)
            .Include(x => x.StageTransitions)
            .Include(x => x.FarmingSeason)
            .AsNoTracking()
            .Where(x => x.FarmingSeasonId == id);

        if (!isPlatformAdmin)
        {
            if (!tenantId.HasValue || tenantId.Value == Guid.Empty) return Forbid();
            query = query.Where(x => x.Zone.Field.Farm.TenantId == tenantId.Value);
        }

        var batches = await query.OrderByDescending(x => x.StartDate).ToListAsync(ct);
        return Ok(batches.Select(x => x.ToView()).ToList());
    }

    [HttpGet("api/v1/farms/{farmId:guid}/planting-seasons")]
    public async Task<ActionResult<IReadOnlyList<PlantingSeasonView>>> GetFarmPlantingSeasons(Guid farmId, CancellationToken ct)
    {
        var tenantId = User.GetOptionalTenantId();
        var isPlatformAdmin = User.IsInRole("PlatformAdmin");

        var farm = await dbContext.Farms.AsNoTracking().FirstOrDefaultAsync(f => f.Id == farmId, ct);
        if (farm == null) return NotFound(new { message = "Trang trại không tồn tại." });

        if (!isPlatformAdmin)
        {
            if (!tenantId.HasValue || tenantId.Value == Guid.Empty || farm.TenantId != tenantId.Value)
            {
                return Forbid();
            }
        }

        var query = dbContext.PlantingSeasons
            .Include(x => x.Zone).ThenInclude(x => x.Field).ThenInclude(x => x.Farm)
            .Include(x => x.Crop)
            .Include(x => x.Variety)
            .Include(x => x.GrowthProfile)
            .Include(x => x.CurrentGrowthStage)
            .Include(x => x.AppliedRequirements)
            .Include(x => x.StageTransitions)
            .Include(x => x.FarmingSeason)
            .AsNoTracking()
            .Where(x => x.Zone.Field.FarmId == farmId);

        var batches = await query.OrderByDescending(x => x.StartDate).ToListAsync(ct);
        return Ok(batches.Select(x => x.ToView()).ToList());
    }

    [HttpGet("api/v1/planting-seasons")]
    public async Task<ActionResult<IReadOnlyList<PlantingSeasonView>>> GetAllPlantingSeasons([FromQuery] Guid? farmId, [FromQuery] Guid? zoneId, [FromQuery] Guid? seasonId, CancellationToken ct)
    {
        var tenantId = User.GetOptionalTenantId();
        var isPlatformAdmin = User.IsInRole("PlatformAdmin");

        var query = dbContext.PlantingSeasons
            .Include(x => x.Zone).ThenInclude(x => x.Field).ThenInclude(x => x.Farm)
            .Include(x => x.Crop)
            .Include(x => x.Variety)
            .Include(x => x.GrowthProfile)
            .Include(x => x.CurrentGrowthStage)
            .Include(x => x.AppliedRequirements)
            .Include(x => x.StageTransitions)
            .Include(x => x.FarmingSeason)
            .AsNoTracking();

        if (!isPlatformAdmin)
        {
            if (!tenantId.HasValue || tenantId.Value == Guid.Empty) return Forbid();
            query = query.Where(x => x.Zone.Field.Farm.TenantId == tenantId.Value);
        }

        if (farmId.HasValue) query = query.Where(x => x.Zone.Field.FarmId == farmId.Value);
        if (zoneId.HasValue) query = query.Where(x => x.ZoneId == zoneId.Value);
        if (seasonId.HasValue) query = query.Where(x => x.FarmingSeasonId == seasonId.Value);

        var batches = await query.OrderByDescending(x => x.StartDate).ToListAsync(ct);
        return Ok(batches.Select(x => x.ToView()).ToList());
    }

    private static bool _seasonsSeedChecked;
    private static bool IsDevelopment() =>
        string.Equals(Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"), "Development", StringComparison.OrdinalIgnoreCase);

    private async Task EnsureSeedSeasonsAsync(CancellationToken ct)
    {
        if (!IsDevelopment() || _seasonsSeedChecked) return;
        if (await dbContext.FarmingSeasons.AnyAsync(ct))
        {
            _seasonsSeedChecked = true;
            return;
        }

        // Vụ mùa seed toàn cục có TenantId = null để mọi trang trại / tenant đều xem và kế thừa được
        var seasons = new List<FarmingSeason>
        {
            new()
            {
                TenantId = null,
                Code = "DX-2026",
                Name = "Vụ Đông - Xuân 2026",
                Year = 2026,
                StartDate = new DateOnly(2025, 11, 15),
                EndDate = new DateOnly(2026, 4, 15),
                Description = "Vụ mùa chính Đông Xuân cho cà chua, dưa leo và dưa lưới công nghệ cao.",
                Status = "Active",
                IsActive = true
            },
            new()
            {
                TenantId = null,
                Code = "HT-2026",
                Name = "Vụ Hè - Thu 2026",
                Year = 2026,
                StartDate = new DateOnly(2026, 4, 20),
                EndDate = new DateOnly(2026, 8, 31),
                Description = "Vụ hè thu tập trung hoa màu chống sốc nhiệt và rau ăn lá.",
                Status = "Upcoming",
                IsActive = true
            },
            new()
            {
                TenantId = null,
                Code = "TD-2026",
                Name = "Vụ Thu - Đông 2026",
                Year = 2026,
                StartDate = new DateOnly(2026, 9, 1),
                EndDate = new DateOnly(2026, 12, 31),
                Description = "Vụ thu đông phục vụ nông sản tươi sống dịp Tết Nguyên Đán.",
                Status = "Upcoming",
                IsActive = true
            },
            new()
            {
                TenantId = null,
                Code = "QN-2026",
                Name = "Vụ Mùa Quanh Năm (Nhà Màng Tự Động)",
                Year = 2026,
                StartDate = new DateOnly(2026, 1, 1),
                EndDate = new DateOnly(2026, 12, 31),
                Description = "Canh tác liên tục nhiều lứa trong nhà màng vi khí hậu khép kín.",
                Status = "Active",
                IsActive = true
            }
        };
        dbContext.FarmingSeasons.AddRange(seasons);
        await dbContext.SaveChangesAsync(ct);
    }
}
