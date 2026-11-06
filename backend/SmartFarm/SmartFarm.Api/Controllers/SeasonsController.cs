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
        await EnsureSeedSeasonsAsync(tenantId, ct);

        var query = dbContext.FarmingSeasons
            .Include(x => x.PlantingSeasons)
            .AsNoTracking()
            .Where(x => x.IsActive && (x.TenantId == null || x.TenantId == tenantId));

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
        var season = await dbContext.FarmingSeasons
            .Include(x => x.PlantingSeasons)
            .AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == id && (x.TenantId == null || x.TenantId == tenantId), ct);

        if (season == null) return NotFound(new { message = "Vụ mùa không tồn tại." });

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
        var code = string.IsNullOrWhiteSpace(request.Code)
            ? $"VU-{request.Year}-{Guid.NewGuid():N}"[..12].ToUpper()
            : request.Code.Trim().ToUpper();

        var exists = await dbContext.FarmingSeasons.AnyAsync(x =>
            x.Code == code && (x.TenantId == null || x.TenantId == tenantId) && x.IsActive, ct);
        if (exists)
            return Conflict(new { message = $"Mã vụ mùa '{code}' đã tồn tại trong hệ thống." });

        var season = new FarmingSeason
        {
            TenantId = tenantId,
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
        var season = await dbContext.FarmingSeasons
            .Include(x => x.PlantingSeasons)
            .SingleOrDefaultAsync(x => x.Id == id && (x.TenantId == null || x.TenantId == tenantId), ct);

        if (season == null) return NotFound(new { message = "Vụ mùa không tồn tại." });
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
        var season = await dbContext.FarmingSeasons
            .Include(x => x.PlantingSeasons)
            .SingleOrDefaultAsync(x => x.Id == id && (x.TenantId == null || x.TenantId == tenantId), ct);

        if (season == null) return NotFound(new { message = "Vụ mùa không tồn tại." });

        // Soft delete / archive to preserve history
        season.IsActive = false;
        season.Status = "Completed";
        await dbContext.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpGet("api/v1/seasons/{id:guid}/planting-crops")]
    public async Task<ActionResult<IReadOnlyList<PlantingSeasonView>>> GetSeasonPlantingCrops(Guid id, CancellationToken ct)
    {
        var batches = await dbContext.PlantingSeasons
            .Include(x => x.Zone).ThenInclude(x => x.Field).ThenInclude(x => x.Farm)
            .Include(x => x.Crop)
            .Include(x => x.Variety)
            .Include(x => x.GrowthProfile)
            .Include(x => x.CurrentGrowthStage)
            .Include(x => x.AppliedRequirements)
            .Include(x => x.StageTransitions)
            .Include(x => x.FarmingSeason)
            .AsNoTracking()
            .Where(x => x.FarmingSeasonId == id)
            .OrderByDescending(x => x.StartDate)
            .ToListAsync(ct);

        return Ok(batches.Select(x => x.ToView()).ToList());
    }

    [HttpGet("api/v1/farms/{farmId:guid}/planting-seasons")]
    public async Task<ActionResult<IReadOnlyList<PlantingSeasonView>>> GetFarmPlantingSeasons(Guid farmId, CancellationToken ct)
    {
        var batches = await dbContext.PlantingSeasons
            .Include(x => x.Zone).ThenInclude(x => x.Field).ThenInclude(x => x.Farm)
            .Include(x => x.Crop)
            .Include(x => x.Variety)
            .Include(x => x.GrowthProfile)
            .Include(x => x.CurrentGrowthStage)
            .Include(x => x.AppliedRequirements)
            .Include(x => x.StageTransitions)
            .Include(x => x.FarmingSeason)
            .AsNoTracking()
            .Where(x => x.Zone.Field.FarmId == farmId)
            .OrderByDescending(x => x.StartDate)
            .ToListAsync(ct);

        return Ok(batches.Select(x => x.ToView()).ToList());
    }

    [HttpGet("api/v1/planting-seasons")]
    public async Task<ActionResult<IReadOnlyList<PlantingSeasonView>>> GetAllPlantingSeasons([FromQuery] Guid? farmId, [FromQuery] Guid? zoneId, [FromQuery] Guid? seasonId, CancellationToken ct)
    {
        var tenantId = User.GetOptionalTenantId();
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
            .Where(x => tenantId == null || x.Zone.Field.Farm.TenantId == tenantId);

        if (farmId.HasValue) query = query.Where(x => x.Zone.Field.FarmId == farmId.Value);
        if (zoneId.HasValue) query = query.Where(x => x.ZoneId == zoneId.Value);
        if (seasonId.HasValue) query = query.Where(x => x.FarmingSeasonId == seasonId.Value);

        var batches = await query.OrderByDescending(x => x.StartDate).ToListAsync(ct);
        return Ok(batches.Select(x => x.ToView()).ToList());
    }

    private async Task EnsureSeedSeasonsAsync(Guid? tenantId, CancellationToken ct)
    {
        if (await dbContext.FarmingSeasons.AnyAsync(ct)) return;

        var seasons = new List<FarmingSeason>
        {
            new()
            {
                TenantId = tenantId,
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
                TenantId = tenantId,
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
                TenantId = tenantId,
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
                TenantId = tenantId,
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
