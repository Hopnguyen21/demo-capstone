using System.Data;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using SmartFarm.Application.Common.Exceptions;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Application.Features.CropGrowth;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;

namespace SmartFarm.Infrastructure.CropGrowth;

internal sealed partial class CropGrowthService(SmartFarmDbContext dbContext) : ICropGrowthService
{
    private static readonly EnvironmentalParameterCode[] CoreParameters =
        [EnvironmentalParameterCode.Temperature, EnvironmentalParameterCode.SoilMoisture, EnvironmentalParameterCode.AirHumidity, EnvironmentalParameterCode.Ph];

    public async Task<IReadOnlyList<CropView>> ListCropsAsync(Guid userId, Guid? tenantId, bool? systemDefined, CancellationToken ct)
    {
        await EnsureUserAsync(userId, tenantId, false, ct);
        var query = dbContext.Crops.AsNoTracking().Where(x => x.TenantId == null || x.TenantId == tenantId);
        if (systemDefined.HasValue) query = query.Where(x => x.IsSystemDefined == systemDefined.Value);
        return (await query.OrderBy(x => x.Name).ToListAsync(ct)).Select(x => x.ToView()).ToList();
    }

    public async Task<CropView> CreateCropAsync(Guid userId, Guid? tenantId, CreateCropCommand command, CancellationToken ct)
    {
        var user = await EnsureUserAsync(userId, tenantId, true, ct);
        var name = Required(command.Name, nameof(command.Name), 150);
        var scientific = command.ScientificName?.Trim();
        if (string.IsNullOrWhiteSpace(scientific))
        {
            scientific = name;
        }
        var normalized = Normalize(name);
        if (await dbContext.Crops.AnyAsync(x => (x.TenantId == null || x.TenantId == tenantId) && x.NormalizedName == normalized, ct))
            throw new ResourceConflictException("A Crop with this name already exists in the visible catalog.");
        var isSystemDefined = user.Role == UserRole.PlatformAdmin || tenantId == null;
        var crop = new Crop
        {
            TenantId = isSystemDefined ? null : tenantId,
            CreatedByUserId = userId,
            Name = name,
            NormalizedName = normalized,
            ScientificName = scientific,
            Description = Optional(command.Description, 4000),
            IsSystemDefined = isSystemDefined,
            Category = Optional(command.Category, 100),
            GrowthCycleDays = command.GrowthCycleDays,
            OptimalTemperatureMin = command.OptimalTemperatureMin,
            OptimalTemperatureMax = command.OptimalTemperatureMax,
            OptimalSoilMoistureMin = command.OptimalSoilMoistureMin,
            OptimalSoilMoistureMax = command.OptimalSoilMoistureMax,
            OptimalPhMin = command.OptimalPhMin,
            OptimalPhMax = command.OptimalPhMax,
            OptimalEcMin = command.OptimalEcMin,
            OptimalEcMax = command.OptimalEcMax,
            OptimalLux = command.OptimalLux,
            CalendarIrrigationPlan = command.CalendarIrrigationPlan
        };
        dbContext.Crops.Add(crop); await dbContext.SaveChangesAsync(ct); return crop.ToView();
    }

    public async Task<CropView> UpdateCropAsync(Guid userId, Guid? tenantId, Guid cropId, UpdateCropCommand command, CancellationToken ct)
    {
        var user = await EnsureUserAsync(userId, tenantId, true, ct);
        var crop = await dbContext.Crops.SingleOrDefaultAsync(x => x.Id == cropId && (user.Role == UserRole.PlatformAdmin || x.TenantId == tenantId), ct)
            ?? throw new ResourceNotFoundException("Crop was not found.");
        var name = Required(command.Name, nameof(command.Name), 150);
        var normalized = Normalize(name);
        if (await dbContext.Crops.AnyAsync(x => x.Id != cropId && (x.TenantId == null || x.TenantId == tenantId) && x.NormalizedName == normalized, ct))
            throw new ResourceConflictException("A Crop with this name already exists in the visible catalog.");
        crop.Name = name;
        crop.NormalizedName = normalized;
        if (!string.IsNullOrWhiteSpace(command.ScientificName)) crop.ScientificName = command.ScientificName.Trim();
        crop.Description = Optional(command.Description, 4000);
        crop.Category = Optional(command.Category, 100);
        crop.GrowthCycleDays = command.GrowthCycleDays;
        crop.OptimalTemperatureMin = command.OptimalTemperatureMin;
        crop.OptimalTemperatureMax = command.OptimalTemperatureMax;
        crop.OptimalSoilMoistureMin = command.OptimalSoilMoistureMin;
        crop.OptimalSoilMoistureMax = command.OptimalSoilMoistureMax;
        crop.OptimalPhMin = command.OptimalPhMin;
        crop.OptimalPhMax = command.OptimalPhMax;
        crop.OptimalEcMin = command.OptimalEcMin;
        crop.OptimalEcMax = command.OptimalEcMax;
        crop.OptimalLux = command.OptimalLux;
        if (command.CalendarIrrigationPlan != null) crop.CalendarIrrigationPlan = command.CalendarIrrigationPlan;
        await dbContext.SaveChangesAsync(ct);
        return crop.ToView();
    }

    public async Task DeleteCropAsync(Guid userId, Guid? tenantId, Guid cropId, CancellationToken ct)
    {
        var user = await EnsureUserAsync(userId, tenantId, true, ct);
        var crop = await dbContext.Crops.SingleOrDefaultAsync(x => x.Id == cropId && (user.Role == UserRole.PlatformAdmin || x.TenantId == tenantId), ct)
            ?? throw new ResourceNotFoundException("Crop was not found.");
        var hasProfiles = await dbContext.GrowthProfiles.AnyAsync(p => p.CropId == cropId, ct);
        var hasVarieties = await dbContext.CropVarieties.AnyAsync(v => v.CropId == cropId, ct);
        var hasSeasons = await dbContext.PlantingSeasons.AnyAsync(s => s.CropId == cropId, ct);
        if (hasProfiles || hasVarieties || hasSeasons)
        {
            throw new ResourceConflictException("Không thể xóa cây trồng này vì đang có Hồ sơ sinh trưởng, Giống cây hoặc Mùa vụ liên kết.");
        }

        dbContext.Crops.Remove(crop);
        await dbContext.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<VarietyView>> ListVarietiesAsync(Guid userId, Guid? tenantId, Guid cropId, CancellationToken ct)
    {
        await EnsureUserAsync(userId, tenantId, false, ct); await VisibleCropAsync(cropId, tenantId, ct);
        var rows = await dbContext.CropVarieties.AsNoTracking().Where(x => x.CropId == cropId && (x.TenantId == null || x.TenantId == tenantId)).OrderBy(x => x.Name).ToListAsync(ct);
        return rows.Select(x => x.ToView()).ToList();
    }

    public async Task<IReadOnlyList<VarietyView>> ListAllVarietiesAsync(Guid userId, Guid? tenantId, CancellationToken ct)
    {
        await EnsureUserAsync(userId, tenantId, false, ct);
        var rows = await dbContext.CropVarieties
            .AsNoTracking()
            .Where(x => x.Crop.TenantId == null || x.Crop.TenantId == tenantId)
            .Where(x => x.TenantId == null || x.TenantId == tenantId)
            .OrderBy(x => x.Name)
            .ToListAsync(ct);
        return rows.Select(x => x.ToView()).ToList();
    }

    public async Task<VarietyView> CreateVarietyAsync(Guid userId, Guid? tenantId, Guid cropId, CreateVarietyCommand command, CancellationToken ct)
    {
        var user = await EnsureUserAsync(userId, tenantId, true, ct); await VisibleCropAsync(cropId, tenantId, ct);
        var name = Required(command.Name, nameof(command.Name), 150); var normalized = Normalize(name);
        if (await dbContext.CropVarieties.AnyAsync(x => x.CropId == cropId && (x.TenantId == null || x.TenantId == tenantId) && x.NormalizedName == normalized, ct))
            throw new ResourceConflictException("A Variety with this name already exists for the Crop.");
        var isSystemDefined = user.Role == UserRole.PlatformAdmin || tenantId == null;
        var variety = new CropVariety { CropId = cropId, TenantId = isSystemDefined ? null : tenantId, CreatedByUserId = userId, Name = name, NormalizedName = normalized, Description = Optional(command.Description, 4000), IsSystemDefined = isSystemDefined };
        dbContext.CropVarieties.Add(variety); await dbContext.SaveChangesAsync(ct); return variety.ToView();
    }

    public async Task<IReadOnlyList<GrowthProfileView>> ListProfilesAsync(Guid userId, Guid? tenantId, Guid cropId, Guid? varietyId, CancellationToken ct)
    {
        await EnsureUserAsync(userId, tenantId, false, ct); await VisibleCropAsync(cropId, tenantId, ct);
        var query = ProfileQuery().Where(x => x.CropId == cropId && (x.TenantId == null || x.TenantId == tenantId));
        if (varietyId.HasValue) query = query.Where(x => x.VarietyId == null || x.VarietyId == varietyId);
        return (await query.AsNoTracking().OrderByDescending(x => x.IsDefault).ThenBy(x => x.Name).ToListAsync(ct)).Select(x => x.ToView()).ToList();
    }

        public async Task<IReadOnlyList<GrowthProfileView>> ListAllProfilesAsync(Guid userId, Guid? tenantId, Guid? cropId, Guid? varietyId, bool? isSystemDefined, string? search, CancellationToken ct)
    {
        await EnsureUserAsync(userId, tenantId, false, ct);
        var query = ProfileQuery().Where(x => x.TenantId == null || x.TenantId == tenantId);
        if (cropId.HasValue) query = query.Where(x => x.CropId == cropId.Value);
        if (varietyId.HasValue) query = query.Where(x => x.VarietyId == null || x.VarietyId == varietyId.Value);
        if (isSystemDefined.HasValue) query = query.Where(x => x.IsSystemDefined == isSystemDefined.Value);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToUpperInvariant();
            query = query.Where(x => x.NormalizedName.Contains(term) || x.Crop.NormalizedName.Contains(term));
        }

        return (await query.AsNoTracking().OrderByDescending(x => x.IsDefault).ThenBy(x => x.Name).ToListAsync(ct))
            .Select(x => x.ToView()).ToList();
    }

public async Task<GrowthProfileView> CreateProfileAsync(Guid userId, Guid? tenantId, CreateGrowthProfileCommand command, CancellationToken ct)
    {
        var user = await EnsureUserAsync(userId, tenantId, true, ct); await VisibleCropAsync(command.CropId, tenantId, ct);
        if (command.VarietyId.HasValue) await VisibleVarietyAsync(command.VarietyId.Value, command.CropId, tenantId, ct);
        if (command.SourceProfileId.HasValue == (command.Stages is { Count: > 0 }))
            throw new RequestValidationException("sourceProfileId", "Provide exactly one of sourceProfileId or stages.");
        var name = Required(command.Name, nameof(command.Name), 200); var normalized = Normalize(name);
        if (await dbContext.GrowthProfiles.AnyAsync(x => x.TenantId == tenantId && x.CropId == command.CropId && x.VarietyId == command.VarietyId && x.NormalizedName == normalized, ct))
            throw new ResourceConflictException("A Growth Profile with this name already exists.");
        GrowthProfile profile;
        var isSystemDefined = user.Role == UserRole.PlatformAdmin || tenantId == null;
        if (command.SourceProfileId.HasValue)
        {
            var source = await ProfileQuery().AsNoTracking().SingleOrDefaultAsync(x => x.Id == command.SourceProfileId && x.TenantId == null, ct)
                ?? throw new ResourceNotFoundException("System Growth Profile was not found.");
            if (source.CropId != command.CropId || source.VarietyId != command.VarietyId) throw new RequestValidationException("sourceProfileId", "Source Profile does not match Crop and Variety.");
            profile = Clone(source, userId, isSystemDefined ? Guid.Empty : tenantId!.Value, name, command.Description, command.IsDefault);
            if (isSystemDefined) { profile.TenantId = null; profile.IsSystemDefined = true; }
        }
        else
        {
            ValidateStages(command.Stages!);
            profile = new GrowthProfile { CropId = command.CropId, VarietyId = command.VarietyId, TenantId = isSystemDefined ? null : tenantId, CreatedByUserId = userId, Name = name, NormalizedName = normalized, Description = Optional(command.Description, 4000), IsDefault = command.IsDefault, IsSystemDefined = isSystemDefined };
            AddStages(profile, command.Stages!);
        }
        await using var tx = await dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        if (profile.IsDefault) await UnsetDefaultsAsync(profile.TenantId, profile.CropId, profile.VarietyId, ct);
        dbContext.GrowthProfiles.Add(profile); await dbContext.SaveChangesAsync(ct); await tx.CommitAsync(ct); return profile.ToView();
    }

    public async Task<GrowthProfileView> UpdateProfileAsync(Guid userId, Guid? tenantId, Guid profileId, UpdateGrowthProfileCommand command, CancellationToken ct)
    {
        var user = await EnsureUserAsync(userId, tenantId, true, ct);
        // PlatformAdmin sửa profile hệ thống; profile của tenant chỉ sửa trong đúng tenant đó.
        var profile = await ProfileQuery().SingleOrDefaultAsync(x => x.Id == profileId
                && (x.TenantId == tenantId || (x.TenantId == null && user.Role == UserRole.PlatformAdmin)), ct)
            ?? throw new ResourceNotFoundException("Growth Profile was not found.");

        var name = Required(command.Name, nameof(command.Name), 200); var normalized = Normalize(name);
        if (await dbContext.GrowthProfiles.AnyAsync(x => x.Id != profileId && x.TenantId == profile.TenantId && x.CropId == profile.CropId
                && x.VarietyId == profile.VarietyId && x.NormalizedName == normalized, ct))
            throw new ResourceConflictException("A Growth Profile with this name already exists.");

        await using var tx = await dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        // Mỗi cây/giống chỉ có một profile mặc định: đặt mặc định thì bỏ cờ ở các profile khác cùng phạm vi.
        if (command.IsDefault && !profile.IsDefault) await UnsetDefaultsAsync(profile.TenantId, profile.CropId, profile.VarietyId, ct);
        profile.Name = name;
        profile.NormalizedName = normalized;
        profile.Description = Optional(command.Description, 4000);
        profile.IsDefault = command.IsDefault;
        profile.UpdatedAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return profile.ToView();
    }

    public async Task<GrowthProfileView> GetProfileAsync(Guid userId, Guid? tenantId, Guid profileId, CancellationToken ct)
    {
        await EnsureUserAsync(userId, tenantId, false, ct);
        var profile = await ProfileQuery().AsNoTracking().SingleOrDefaultAsync(x => x.Id == profileId && (x.TenantId == null || x.TenantId == tenantId), ct)
            ?? throw new ResourceNotFoundException("Growth Profile was not found in the visible catalog.");
        return profile.ToView();
    }

    public async Task<RequirementUpdateView> UpdateRequirementsAsync(Guid userId, Guid? tenantId, Guid stageId, IReadOnlyList<RequirementInput> requirements, CancellationToken ct)
    {
        var user = await EnsureUserAsync(userId, tenantId, true, ct); ValidateRequirements(requirements, false);
        var stage = await dbContext.GrowthStages.Include(x => x.Requirements).Include(x => x.GrowthProfile).SingleOrDefaultAsync(x => x.Id == stageId, ct)
            ?? throw new ResourceNotFoundException("Growth Stage was not found.");
        var cloned = false;
        if (stage.GrowthProfile.IsSystemDefined)
        {
            if (user.Role == UserRole.PlatformAdmin)
            {
                // PlatformAdmin directly updates system profile requirements
            }
            else
            {
                var source = await ProfileQuery().AsNoTracking().SingleAsync(x => x.Id == stage.GrowthProfileId, ct);
                var profile = await ProfileQuery().SingleOrDefaultAsync(x => x.TenantId == tenantId && x.SourceProfileId == source.Id, ct);
                if (profile is null) { profile = Clone(source, userId, tenantId!.Value, source.Name + " - Custom", source.Description, false); dbContext.GrowthProfiles.Add(profile); await dbContext.SaveChangesAsync(ct); cloned = true; }
                stage = profile.Stages.Single(x => x.StageOrder == stage.StageOrder);
            }
        }
        else if (user.Role != UserRole.PlatformAdmin && stage.GrowthProfile.TenantId != tenantId) throw new ResourceNotFoundException("Growth Stage was not found in the current Tenant.");
        foreach (var input in requirements)
        {
            var item = stage.Requirements.SingleOrDefault(x => x.ParameterCode == input.ParameterCode);
            if (item is null) { item = new EnvironmentalRequirement { ParameterCode = input.ParameterCode }; stage.Requirements.Add(item); }
            item.MinValue = input.MinValue; item.MaxValue = input.MaxValue; item.TargetValue = input.TargetValue; item.Unit = Required(input.Unit, "unit", 30);
        }
        await dbContext.SaveChangesAsync(ct);
        return new(stage.GrowthProfileId, stage.Id, cloned, stage.Requirements.OrderBy(x => x.ParameterCode).Select(x => x.ToView()).ToList());
    }

    public async Task<IReadOnlyList<PlantingSeasonView>> ListSeasonsAsync(Guid userId, Guid tenantId, Guid zoneId, CancellationToken ct)
    {
        await EnsureZoneReadAsync(userId, tenantId, zoneId, ct);
        return (await SeasonQuery().AsNoTracking().Where(x => x.ZoneId == zoneId).OrderByDescending(x => x.StartDate).ToListAsync(ct)).Select(x => x.ToView()).ToList();
    }

    public async Task<PlantingSeasonView> CreateSeasonAsync(Guid userId, Guid tenantId, Guid zoneId, CreatePlantingSeasonCommand command, CancellationToken ct)
    {
        await EnsureUserAsync(userId, tenantId, true, ct); await EnsureZoneOwnerAsync(tenantId, zoneId, ct);
        var name = Required(command.Name, nameof(command.Name), 200);
        if (command.ExpectedEndDate < command.StartDate.AddDays(20)) throw new RequestValidationException(nameof(command.ExpectedEndDate), "Expected end date must be at least 20 days after start date.");
        await VisibleCropAsync(command.CropId, tenantId, ct); if (command.VarietyId.HasValue) await VisibleVarietyAsync(command.VarietyId.Value, command.CropId, tenantId, ct);
        var profile = await ProfileQuery().SingleOrDefaultAsync(x => x.Id == command.GrowthProfileId && (x.TenantId == null || x.TenantId == tenantId), ct) ?? throw new ResourceNotFoundException("Growth Profile was not found.");
        if (profile.CropId != command.CropId || profile.VarietyId != command.VarietyId) throw new RequestValidationException(nameof(command.GrowthProfileId), "Growth Profile does not match Crop and Variety.");
        var first = profile.Stages.OrderBy(x => x.StageOrder).FirstOrDefault() ?? throw new ResourceConflictException("Growth Profile has no stages.");
        await using var tx = await dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        if (await dbContext.PlantingSeasons.AnyAsync(x => x.ZoneId == zoneId && x.Status == PlantingSeasonStatus.InProgress, ct)) throw new ResourceConflictException("Zone already has an InProgress Planting Season.");
        var season = new PlantingSeason { ZoneId = zoneId, CropId = command.CropId, VarietyId = command.VarietyId, GrowthProfileId = profile.Id, CurrentGrowthStageId = first.Id, Name = name, StartDate = command.StartDate, ExpectedEndDate = command.ExpectedEndDate, FarmingSeasonId = command.FarmingSeasonId };
        ApplyRequirements(season, first); dbContext.PlantingSeasons.Add(season); await dbContext.SaveChangesAsync(ct); await tx.CommitAsync(ct);
        return (await SeasonQuery().AsNoTracking().SingleAsync(x => x.Id == season.Id, ct)).ToView();
    }

    public async Task<PlantingSeasonView> GetSeasonAsync(Guid userId, Guid tenantId, Guid zoneId, Guid seasonId, CancellationToken ct)
    {
        await EnsureZoneReadAsync(userId, tenantId, zoneId, ct);
        var season = await SeasonQuery().AsNoTracking().SingleOrDefaultAsync(x => x.Id == seasonId && x.ZoneId == zoneId, ct) ?? throw new ResourceNotFoundException("Planting Season was not found under this Zone."); return season.ToView();
    }

    public async Task<PlantingSeasonView> TransitionStageAsync(Guid userId, Guid tenantId, Guid zoneId, Guid seasonId, TransitionStageCommand command, CancellationToken ct)
    {
        await EnsureUserAsync(userId, tenantId, true, ct);
        var season = await SeasonQuery().SingleOrDefaultAsync(x => x.Id == seasonId && x.ZoneId == zoneId && x.Zone.Field.Farm.TenantId == tenantId, ct) ?? throw new ResourceNotFoundException("Planting Season was not found under this Zone in the current Tenant.");
        if (season.Status != PlantingSeasonStatus.InProgress) throw new ResourceConflictException("Only an InProgress season can change stage.");
        var stage = await dbContext.GrowthStages.Include(x => x.Requirements).SingleOrDefaultAsync(x => x.Id == command.GrowthStageId && x.GrowthProfileId == season.GrowthProfileId, ct) ?? throw new RequestValidationException(nameof(command.GrowthStageId), "Stage does not belong to the season Growth Profile.");
        if (stage.Id == season.CurrentGrowthStageId) throw new ResourceConflictException("Season is already in this stage.");
        await using var tx = await dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var transition = new SeasonStageTransition { PlantingSeasonId = season.Id, PreviousGrowthStageId = season.CurrentGrowthStageId, CurrentGrowthStageId = stage.Id, ChangedByUserId = userId, Notes = Optional(command.Notes, 1000) };
        dbContext.SeasonStageTransitions.Add(transition);
        season.StageTransitions.Add(transition);
        season.CurrentGrowthStageId = stage.Id;
        season.CurrentGrowthStage = stage;
        dbContext.SeasonAppliedRequirements.RemoveRange(season.AppliedRequirements);
        await dbContext.SaveChangesAsync(ct);
        season.AppliedRequirements.Clear();
        ApplyRequirements(season, stage);
        await dbContext.SaveChangesAsync(ct); await tx.CommitAsync(ct); return season.ToView();
    }

    public async Task<PlantingSeasonView> CloseSeasonAsync(Guid userId, Guid tenantId, Guid zoneId, Guid seasonId, CloseSeasonCommand command, CancellationToken ct)
    {
        await EnsureUserAsync(userId, tenantId, true, ct);
        var season = await SeasonQuery().SingleOrDefaultAsync(x => x.Id == seasonId && x.ZoneId == zoneId && x.Zone.Field.Farm.TenantId == tenantId, ct) ?? throw new ResourceNotFoundException("Planting Season was not found under this Zone in the current Tenant.");
        if (season.Status != PlantingSeasonStatus.InProgress) throw new ResourceConflictException("Only an InProgress season can be closed.");
        if (command.ActualEndDate < season.StartDate) throw new RequestValidationException(nameof(command.ActualEndDate), "Actual end date cannot precede start date.");
        if (command.ActualYieldKg < 0) throw new RequestValidationException(nameof(command.ActualYieldKg), "Yield cannot be negative.");
        season.ActualEndDate = command.ActualEndDate; season.ActualYieldKg = command.ActualYieldKg; season.CloseNotes = Optional(command.Notes, 1000); season.Status = PlantingSeasonStatus.Completed;
        await dbContext.SaveChangesAsync(ct); return season.ToView();
    }

    public async Task<PlantingSeasonView> RecordSeasonYieldAsync(Guid userId, Guid tenantId, Guid zoneId, Guid seasonId, RecordSeasonYieldCommand command, CancellationToken ct)
    {
        await EnsureUserAsync(userId, tenantId, false, ct);
        var season = await SeasonQuery().SingleOrDefaultAsync(x => x.Id == seasonId && x.ZoneId == zoneId && x.Zone.Field.Farm.TenantId == tenantId, ct) ?? throw new ResourceNotFoundException("Planting Season was not found under this Zone in the current Tenant.");
        if (command.ActualYieldKg < 0) throw new RequestValidationException(nameof(command.ActualYieldKg), "Yield cannot be negative.");
        season.ActualYieldKg = command.ActualYieldKg;
        if (command.ActualEndDate.HasValue) season.ActualEndDate = command.ActualEndDate.Value;
        if (!string.IsNullOrWhiteSpace(command.Notes)) season.CloseNotes = Optional(command.Notes, 1000);
        if (command.MarkCompleted && season.Status == PlantingSeasonStatus.InProgress)
        {
            season.Status = PlantingSeasonStatus.Completed;
            if (!season.ActualEndDate.HasValue) season.ActualEndDate = DateOnly.FromDateTime(DateTime.UtcNow);
        }
        await dbContext.SaveChangesAsync(ct);
        return season.ToView();
    }

    private IQueryable<GrowthProfile> ProfileQuery() => dbContext.GrowthProfiles.Include(x => x.Crop).Include(x => x.Variety).Include(x => x.Stages).ThenInclude(x => x.Requirements);
    private IQueryable<PlantingSeason> SeasonQuery() => dbContext.PlantingSeasons
        .AsSplitQuery()
        .Include(x => x.Zone).ThenInclude(x => x.Field).ThenInclude(x => x.Farm)
        .Include(x => x.Crop)
        .Include(x => x.Variety)
        .Include(x => x.GrowthProfile)
        .Include(x => x.CurrentGrowthStage)
        .Include(x => x.AppliedRequirements)
        .Include(x => x.StageTransitions)
        .Include(x => x.FarmingSeason);
    private async Task<AppUser> EnsureUserAsync(Guid id, Guid? tenantId, bool ownerRequired, CancellationToken ct)
    {
        var user = await dbContext.AppUsers.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw new AuthorizationException();
        if (user.Role == UserRole.PlatformAdmin) return user;
        if (ownerRequired && (user.Role != UserRole.FarmOwner || user.TenantId != tenantId)) throw new AuthorizationException("FarmOwner role in the current Tenant is required.");
        if (user.Role is UserRole.FarmOwner or UserRole.Farmer && user.TenantId != tenantId) throw new AuthorizationException("Token Tenant scope is stale.");
        return user;
    }
    private async Task EnsureZoneOwnerAsync(Guid tenantId, Guid zoneId, CancellationToken ct) { if (!await dbContext.Zones.AnyAsync(x => x.Id == zoneId && x.Field.Farm.TenantId == tenantId, ct)) throw new ResourceNotFoundException("Zone was not found in the current Tenant."); }
    private async Task EnsureZoneReadAsync(Guid userId, Guid tenantId, Guid zoneId, CancellationToken ct)
    {
        var user = await dbContext.AppUsers.AsNoTracking().SingleOrDefaultAsync(x => x.Id == userId, ct) ?? throw new AuthorizationException();
        if (user.Role == UserRole.PlatformAdmin)
        {
            if (!await dbContext.Zones.AnyAsync(x => x.Id == zoneId, ct)) throw new ResourceNotFoundException("Zone was not found.");
            return;
        }
        if (user.TenantId != tenantId) throw new AuthorizationException("Token Tenant scope is stale.");
        if (!await dbContext.Zones.AnyAsync(x => x.Id == zoneId && x.Field.Farm.TenantId == tenantId, ct)) throw new ResourceNotFoundException("Zone was not found in the current Tenant.");
        if (user.Role == UserRole.Farmer && !await dbContext.UserZoneAccesses.AnyAsync(x => x.AppUserId == userId && x.ZoneId == zoneId, ct)) throw new ResourceNotFoundException("Zone was not found in the current Tenant.");
        if (user.Role is not (UserRole.FarmOwner or UserRole.Farmer)) throw new AuthorizationException();
    }
    private async Task<Crop> VisibleCropAsync(Guid id, Guid? tenant, CancellationToken ct) => await dbContext.Crops.SingleOrDefaultAsync(x => x.Id == id && (x.TenantId == null || x.TenantId == tenant), ct) ?? throw new ResourceNotFoundException("Crop was not found in the visible catalog.");
    private async Task<CropVariety> VisibleVarietyAsync(Guid id, Guid crop, Guid? tenant, CancellationToken ct) => await dbContext.CropVarieties.SingleOrDefaultAsync(x => x.Id == id && x.CropId == crop && (x.TenantId == null || x.TenantId == tenant), ct) ?? throw new ResourceNotFoundException("Variety was not found for this Crop.");
    private static GrowthProfile Clone(GrowthProfile source, Guid user, Guid tenant, string name, string? description, bool isDefault)
    {
        var result = new GrowthProfile { CropId = source.CropId, VarietyId = source.VarietyId, TenantId = tenant, SourceProfileId = source.Id, CreatedByUserId = user, Name = name, NormalizedName = Normalize(name), Description = Optional(description, 4000), IsDefault = isDefault };
        foreach (var s in source.Stages.OrderBy(x => x.StageOrder)) { var target = new GrowthStage { Name = s.Name, StageOrder = s.StageOrder, DurationDays = s.DurationDays, Description = s.Description, FertilizerAction = s.FertilizerAction, IpmAction = s.IpmAction }; foreach (var r in s.Requirements) target.Requirements.Add(new EnvironmentalRequirement { ParameterCode = r.ParameterCode, MinValue = r.MinValue, MaxValue = r.MaxValue, TargetValue = r.TargetValue, Unit = r.Unit }); result.Stages.Add(target); } return result;
    }
    private static void AddStages(GrowthProfile profile, IEnumerable<StageInput> stages) { foreach (var s in stages.OrderBy(x => x.StageOrder)) { var stage = new GrowthStage { Name = s.Name.Trim(), StageOrder = s.StageOrder, DurationDays = s.DurationDays, Description = Optional(s.Description, 4000), FertilizerAction = Optional(s.FertilizerAction, 2000), IpmAction = Optional(s.IpmAction, 2000) }; foreach (var r in s.Requirements) stage.Requirements.Add(new EnvironmentalRequirement { ParameterCode = r.ParameterCode, MinValue = r.MinValue, MaxValue = r.MaxValue, TargetValue = r.TargetValue, Unit = r.Unit.Trim() }); profile.Stages.Add(stage); } }
    private static void ValidateStages(IReadOnlyList<StageInput> stages) { if (stages.Count == 0 || stages.Select(x => x.StageOrder).Order().Where((x, i) => x != i + 1).Any()) throw new RequestValidationException("stages", "Stage orders must be contiguous and start at 1."); if (stages.Select(x => Normalize(x.Name)).Distinct().Count() != stages.Count) throw new RequestValidationException("stages", "Stage names must be unique."); foreach (var s in stages) { Required(s.Name, "stage.name", 150); if (s.DurationDays <= 0) throw new RequestValidationException("durationDays", "Duration must be positive."); ValidateRequirements(s.Requirements, true); } }
    private static void ValidateRequirements(IReadOnlyList<RequirementInput> requirements, bool requireCore) { if (requirements.Count == 0 || requirements.Select(x => x.ParameterCode).Distinct().Count() != requirements.Count) throw new RequestValidationException("requirements", "Requirements must be non-empty and parameter codes unique."); foreach (var r in requirements) { if (r.MinValue > r.TargetValue || r.TargetValue > r.MaxValue) throw new RequestValidationException("requirements", "Each range must satisfy min <= target <= max."); Required(r.Unit, "unit", 30); } if (requireCore && CoreParameters.Except(requirements.Select(x => x.ParameterCode)).Any()) throw new RequestValidationException("requirements", "Every stage requires Temperature, SoilMoisture, AirHumidity and Ph thresholds."); }
    private static void ApplyRequirements(PlantingSeason season, GrowthStage stage) { foreach (var r in stage.Requirements) season.AppliedRequirements.Add(new SeasonAppliedRequirement { ParameterCode = r.ParameterCode, MinValue = r.MinValue, MaxValue = r.MaxValue, TargetValue = r.TargetValue, Unit = r.Unit }); }
    private async Task UnsetDefaultsAsync(Guid? tenant, Guid crop, Guid? variety, CancellationToken ct) { var rows = await dbContext.GrowthProfiles.Where(x => x.TenantId == tenant && x.CropId == crop && x.VarietyId == variety && x.IsDefault).ToListAsync(ct); foreach (var x in rows) x.IsDefault = false; }
    private static string Required(string? value, string field, int max) { var result = value?.Trim(); if (string.IsNullOrWhiteSpace(result) || result.Length > max) throw new RequestValidationException(field, $"Value is required and limited to {max} characters."); return result; }
    private static string? Optional(string? value, int max) { if (string.IsNullOrWhiteSpace(value)) return null; var result = value.Trim(); if (result.Length > max) throw new RequestValidationException("value", $"Value is limited to {max} characters."); return result; }
    private static string Normalize(string value) => value.Trim().ToUpperInvariant();
    [GeneratedRegex("^[A-Z][a-z]+(?: [a-z][a-z-]+)+$", RegexOptions.CultureInvariant)] private static partial Regex ScientificNameRegex();
}
