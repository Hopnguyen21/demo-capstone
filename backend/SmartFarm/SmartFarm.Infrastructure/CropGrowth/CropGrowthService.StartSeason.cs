using System.Data;
using Microsoft.EntityFrameworkCore;
using SmartFarm.Application.Common.Exceptions;
using SmartFarm.Application.Features.CropGrowth;
using SmartFarm.Domain.Enums;

namespace SmartFarm.Infrastructure.CropGrowth;

internal sealed partial class CropGrowthService
{
    public async Task<PlantingSeasonView> StartSeasonAsync(Guid userId, Guid tenantId, Guid zoneId, Guid seasonId, CancellationToken ct)
    {
        await EnsureUserAsync(userId, tenantId, true, ct);
        await EnsureZoneOwnerAsync(tenantId, zoneId, ct);
        await using var tx = await dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var season = await dbContext.PlantingSeasons.Include(x => x.AppliedRequirements).SingleOrDefaultAsync(x => x.Id == seasonId && x.ZoneId == zoneId, ct)
            ?? throw new ResourceNotFoundException("Vụ trồng không thuộc Zone này.");
        if (season.Status != PlantingSeasonStatus.Planned) throw new ResourceConflictException("Chỉ bắt đầu được vụ dự kiến.");
        if (await dbContext.PlantingSeasons.AnyAsync(x => x.ZoneId == zoneId && x.Status == PlantingSeasonStatus.InProgress, ct))
            throw new ResourceConflictException("Zone đã có vụ đang canh tác. Hãy kết thúc vụ hiện tại trước.");
        var zone = await dbContext.Zones.Include(x => x.Field).ThenInclude(x => x.Farm).SingleAsync(x => x.Id == zoneId, ct);
        var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, TimeZoneInfo.FindSystemTimeZoneById(zone.Field.Farm.TimeZone)));
        if (season.StartDate > today) throw new ResourceConflictException("Chưa đến ngày bắt đầu vụ dự kiến.");
        if (season.ExpectedEndDate < today) throw new ResourceConflictException("Vụ dự kiến đã quá ngày kết thúc; hãy tạo vụ với thời gian phù hợp.");
        var profile = await ProfileWithScheduleQuery().SingleAsync(x => x.Id == season.GrowthProfileId && (x.TenantId == null || x.TenantId == tenantId), ct);
        if (profile.CropId != season.CropId || profile.VarietyId != season.VarietyId) throw new ResourceConflictException("Hồ sơ không khớp cây và giống của vụ.");
        if (profile.TenantId == null)
        {
            profile = Clone(profile, userId, tenantId, $"{profile.Name[..Math.Min(profile.Name.Length, 100)]} · {Guid.NewGuid():N}", profile.Description, false);
            dbContext.GrowthProfiles.Add(profile);
            season.GrowthProfileId = profile.Id;
        }
        var first = profile.Stages.OrderBy(x => x.StageOrder).FirstOrDefault() ?? throw new ResourceConflictException("Hồ sơ chưa có giai đoạn.");
        // Starting the season explicitly applies its crop/profile to this Zone only.
        zone.CropId = season.CropId; zone.CropVarietyId = season.VarietyId; zone.GrowthProfileId = profile.Id;
        season.Status = PlantingSeasonStatus.InProgress; season.CurrentGrowthStageId = first.Id;
        if (season.AppliedRequirements.Count == 0) ApplyRequirements(season, first);
        await dbContext.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return (await SeasonQuery().AsNoTracking().SingleAsync(x => x.Id == season.Id, ct)).ToView();
    }
}
