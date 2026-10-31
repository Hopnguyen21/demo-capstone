using System.Data;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using SmartFarm.Application.Common.Exceptions;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Application.Features.Farms;
using SmartFarm.Application.Features.Fields;
using SmartFarm.Application.Features.Zones;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Identity;
using SmartFarm.Infrastructure.Persistence;
using SmartFarm.Infrastructure.Persistence.Configurations;

namespace SmartFarm.Infrastructure.FarmStructure;

internal sealed class FarmStructureService(SmartFarmDbContext dbContext, TimeProvider timeProvider) :
    IFarmService, IFieldService, IZoneService
{
    private const decimal MaximumFarmAreaM2 = 1_000_000m;

    public async Task<IReadOnlyList<FarmSummaryView>> ListAsync(
        Guid ownerUserId, Guid tenantId, FarmStatus? status, CancellationToken cancellationToken)
    {
        await EnsureOwnerScopeAsync(ownerUserId, tenantId, cancellationToken);
        var caller = await dbContext.AppUsers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == ownerUserId, cancellationToken);
        var query = dbContext.Farms.AsNoTracking();
        if (caller?.Role != UserRole.PlatformAdmin && caller?.Role != UserRole.PlatformTechnician)
        {
            query = query.Where(x => x.TenantId == tenantId);
        }
        query = status.HasValue ? query.Where(x => x.Status == status) : query.Where(x => x.Status != FarmStatus.Archived);
        return await query.OrderBy(x => x.Name).Select(x => new FarmSummaryView(
            x.Id, x.Name, x.Status, x.TotalAreaM2,
            x.Fields.Count(f => f.ArchivedAtUtc == null),
            x.Fields.SelectMany(f => f.Zones).Count(z => z.Status != ZoneStatus.Archived),
            x.Latitude, x.Longitude, x.LocationText)).ToListAsync(cancellationToken);
    }

    public async Task<FarmDetailView> CreateAsync(
        Guid ownerUserId, Guid tenantId, CreateFarmCommand command, CancellationToken cancellationToken)
    {
        await EnsureOwnerScopeAsync(ownerUserId, tenantId, cancellationToken);
        ValidateFarm(command.Name, command.Latitude, command.Longitude, command.TotalAreaM2, command.TimeZone);
        var name = NormalizeRequired(command.Name, nameof(command.Name), 200);
        if (await dbContext.Farms.AnyAsync(x => x.TenantId == tenantId && x.Name.ToUpper() == name.ToUpper(), cancellationToken))
        {
            throw new ResourceConflictException("A Farm with this name already exists in the current Tenant.");
        }

        var normalized = command with
        {
            Name = name,
            LocationText = NormalizeOptional(command.LocationText, 500),
            TimeZone = command.TimeZone.Trim()
        };
        var farm = normalized.ToEntity(tenantId);
        dbContext.Farms.Add(farm);
        await dbContext.SaveChangesAsync(cancellationToken);
        return ToFarmDetail(farm, 0, 0);
    }

    public async Task<FarmDetailView> GetAsync(
        Guid ownerUserId, Guid tenantId, Guid farmId, CancellationToken cancellationToken)
    {
        await EnsureOwnerScopeAsync(ownerUserId, tenantId, cancellationToken);
        var caller = await dbContext.AppUsers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == ownerUserId, cancellationToken);
        var farm = await dbContext.Farms.AsNoTracking().SingleOrDefaultAsync(
            x => x.Id == farmId && (caller != null && caller.Role == UserRole.PlatformAdmin || x.TenantId == tenantId), cancellationToken)
            ?? throw new ResourceNotFoundException("Farm was not found in the current Tenant.");
        var fields = await dbContext.Fields.CountAsync(x => x.FarmId == farmId && x.ArchivedAtUtc == null, cancellationToken);
        var zones = await dbContext.Zones.CountAsync(
            x => x.Field.FarmId == farmId && x.Status != ZoneStatus.Archived, cancellationToken);
        return ToFarmDetail(farm, fields, zones);
    }

    public async Task<FarmDetailView> UpdateAsync(
        Guid ownerUserId, Guid tenantId, Guid farmId, UpdateFarmCommand command, CancellationToken cancellationToken)
    {
        await EnsureOwnerScopeAsync(ownerUserId, tenantId, cancellationToken);
        ValidateFarm(command.Name, command.Latitude, command.Longitude, command.TotalAreaM2, command.TimeZone);
        var farm = await GetFarmEntityAsync(tenantId, farmId, cancellationToken);
        if (farm.Status == FarmStatus.Archived)
        {
            throw new ResourceConflictException("An archived Farm cannot be updated.");
        }

        var allocated = await dbContext.Fields
            .Where(x => x.FarmId == farmId && x.ArchivedAtUtc == null)
            .SumAsync(x => (decimal?)x.AreaM2, cancellationToken) ?? 0;
        if (command.TotalAreaM2 < allocated)
        {
            throw new RequestValidationException(nameof(command.TotalAreaM2), "Farm area cannot be smaller than its active Field area.");
        }

        var name = NormalizeRequired(command.Name, nameof(command.Name), 200);
        if (await dbContext.Farms.AnyAsync(
                x => x.TenantId == tenantId && x.Id != farmId && x.Name.ToUpper() == name.ToUpper(), cancellationToken))
        {
            throw new ResourceConflictException("A Farm with this name already exists in the current Tenant.");
        }

        (command with { Name = name, LocationText = NormalizeOptional(command.LocationText, 500), TimeZone = command.TimeZone.Trim() })
            .ApplyTo(farm);
        await dbContext.SaveChangesAsync(cancellationToken);
        var zones = await dbContext.Zones.CountAsync(x => x.Field.FarmId == farmId && x.Status != ZoneStatus.Archived, cancellationToken);
        var fields = await dbContext.Fields.CountAsync(x => x.FarmId == farmId && x.ArchivedAtUtc == null, cancellationToken);
        return ToFarmDetail(farm, fields, zones);
    }

    public async Task<ArchiveView> ArchiveAsync(
        Guid ownerUserId, Guid tenantId, Guid farmId, CancellationToken cancellationToken)
    {
        await EnsureOwnerScopeAsync(ownerUserId, tenantId, cancellationToken);
        var farm = await dbContext.Farms.Include(x => x.Fields).ThenInclude(x => x.Zones)
            .SingleOrDefaultAsync(x => x.Id == farmId && x.TenantId == tenantId, cancellationToken)
            ?? throw new ResourceNotFoundException("Farm was not found in the current Tenant.");
        if (farm.Fields.SelectMany(x => x.Zones).Any(x => x.Status == ZoneStatus.Operating))
        {
            throw new ResourceConflictException("Farm still contains an Operating Zone.");
        }

        var now = timeProvider.GetUtcNow().UtcDateTime;
        await using var transaction = await dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
        farm.Status = FarmStatus.Archived;
        farm.ArchivedAtUtc = now;
        foreach (var field in farm.Fields.Where(x => x.ArchivedAtUtc == null))
        {
            field.ArchivedAtUtc = now;
            foreach (var zone in field.Zones.Where(x => x.Status != ZoneStatus.Archived))
            {
                zone.Status = ZoneStatus.Archived;
                zone.ArchivedAtUtc = now;
            }
        }
        await dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return new ArchiveView("Farm was archived.", now);
    }

    public async Task<FarmStructureView> GetStructureAsync(
        Guid ownerUserId, Guid tenantId, Guid farmId, CancellationToken cancellationToken)
    {
        await EnsureOwnerScopeAsync(ownerUserId, tenantId, cancellationToken);
        var caller = await dbContext.AppUsers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == ownerUserId, cancellationToken);
        var farm = await dbContext.Farms.AsNoTracking().SingleOrDefaultAsync(
            x => x.Id == farmId && (caller != null && caller.Role == UserRole.PlatformAdmin || x.TenantId == tenantId), cancellationToken)
            ?? throw new ResourceNotFoundException("Farm was not found in the current Tenant.");
        var fields = await dbContext.Fields.AsNoTracking().Where(x => x.FarmId == farmId && x.ArchivedAtUtc == null)
            .OrderBy(x => x.Name).Select(x => new FieldStructureView(
                x.Id, x.Name, x.AreaM2, x.AvailableAreaM2,
                x.Zones.Where(z => z.Status != ZoneStatus.Archived).OrderBy(z => z.Name)
                    .Select(z => new ZoneSummaryView(z.Id, z.FieldId, z.Name, z.AreaM2, z.ZoneType, z.Status)).ToList()))
            .ToListAsync(cancellationToken);
        return new FarmStructureView(farm.Id, farm.Name, farm.Status, fields.Count > 0 && fields.Any(x => x.Zones.Count > 0), fields);
    }

    async Task<IReadOnlyList<FieldSummaryView>> IFieldService.ListAsync(
        Guid ownerUserId, Guid tenantId, Guid farmId, CancellationToken cancellationToken)
    {
        await EnsureOwnerScopeAsync(ownerUserId, tenantId, cancellationToken);
        await GetFarmEntityAsync(tenantId, farmId, cancellationToken);
        var fields = await dbContext.Fields.AsNoTracking().Include(x => x.Zones)
            .Where(x => x.FarmId == farmId && x.ArchivedAtUtc == null)
            .OrderBy(x => x.Name).ToListAsync(cancellationToken);
        return fields.Select(x => new FieldSummaryView(
            x.Id, x.FarmId, x.Name, x.AreaM2, x.AvailableAreaM2,
            x.Zones.Count(z => z.Status != ZoneStatus.Archived),
            x.Latitude, x.Longitude, ParseJson(x.BoundaryGeoJson))).ToList();
    }

    async Task<IReadOnlyList<FieldDetailView>> IFieldService.ListAllAsync(
        Guid ownerUserId, Guid tenantId, Guid? farmId, CancellationToken cancellationToken)
    {
        await EnsureOwnerScopeAsync(ownerUserId, tenantId, cancellationToken);
        var caller = await dbContext.AppUsers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == ownerUserId, cancellationToken);
        var query = dbContext.Fields.AsNoTracking().Include(x => x.Zones).Include(x => x.Farm)
            .Where(x => x.ArchivedAtUtc == null);
        if (caller?.Role != UserRole.PlatformAdmin && caller?.Role != UserRole.PlatformTechnician)
        {
            query = query.Where(x => x.Farm.TenantId == tenantId);
        }
        if (farmId.HasValue) query = query.Where(x => x.FarmId == farmId.Value);
        var fields = await query.OrderBy(x => x.Name).ToListAsync(cancellationToken);
        return fields.Select(x => ToFieldDetail(x, x.Zones.Where(z => z.Status != ZoneStatus.Archived).Select(z => new ZoneSummaryView(z.Id, z.FieldId, z.Name, z.AreaM2, z.ZoneType, z.Status)).ToList())).ToList();
    }

    async Task<FieldDetailView> IFieldService.CreateAsync(
        Guid ownerUserId, Guid tenantId, Guid farmId, CreateFieldCommand command, CancellationToken cancellationToken)
    {
        await EnsureOwnerScopeAsync(ownerUserId, tenantId, cancellationToken);
        ValidateArea(command.AreaM2, nameof(command.AreaM2));
        ValidateCoordinates(command.Latitude, command.Longitude);
        var boundary = GeoJsonPolygonValidator.Normalize(command.BoundaryGeoJson, nameof(command.BoundaryGeoJson));
        var name = NormalizeRequired(command.Name, nameof(command.Name), 200);

        await using var transaction = await dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
        var farm = await GetFarmEntityAsync(tenantId, farmId, cancellationToken);
        if (farm.Status == FarmStatus.Archived)
        {
            throw new ResourceConflictException("Cannot add a Field to an archived Farm.");
        }
        var allocated = await dbContext.Fields.Where(x => x.FarmId == farmId && x.ArchivedAtUtc == null)
            .SumAsync(x => (decimal?)x.AreaM2, cancellationToken) ?? 0;
        if (allocated + command.AreaM2 > farm.TotalAreaM2)
        {
            throw new RequestValidationException(nameof(command.AreaM2), "Total active Field area exceeds the Farm area.");
        }
        if (await dbContext.Fields.AnyAsync(x => x.FarmId == farmId && x.Name.ToUpper() == name.ToUpper(), cancellationToken))
        {
            throw new ResourceConflictException("A Field with this name already exists in the Farm.");
        }

        var field = (command with { Name = name, SoilType = NormalizeOptional(command.SoilType, 100) }).ToEntity(farmId, boundary);
        dbContext.Fields.Add(field);
        await dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return ToFieldDetail(field, []);
    }

    async Task<FieldDetailView> IFieldService.GetAsync(
        Guid ownerUserId, Guid tenantId, Guid fieldId, CancellationToken cancellationToken)
    {
        await EnsureOwnerScopeAsync(ownerUserId, tenantId, cancellationToken);
        var field = await GetFieldEntityAsync(tenantId, fieldId, tracking: false, cancellationToken);
        var zones = await LoadZoneSummariesAsync(fieldId, cancellationToken);
        return ToFieldDetail(field, zones);
    }

    async Task<FieldDetailView> IFieldService.UpdateAsync(
        Guid ownerUserId, Guid tenantId, Guid fieldId, UpdateFieldCommand command, CancellationToken cancellationToken)
    {
        await EnsureOwnerScopeAsync(ownerUserId, tenantId, cancellationToken);
        ValidateCoordinates(command.Latitude, command.Longitude);
        var boundary = command.BoundaryGeoJson.HasValue
            ? GeoJsonPolygonValidator.Normalize(command.BoundaryGeoJson.Value, nameof(command.BoundaryGeoJson))
            : null;
        var field = await GetFieldEntityAsync(tenantId, fieldId, tracking: true, cancellationToken);
        if (field.ArchivedAtUtc.HasValue)
        {
            throw new ResourceConflictException("An archived Field cannot be updated.");
        }
        var name = NormalizeRequired(command.Name, nameof(command.Name), 200);
        if (await dbContext.Fields.AnyAsync(
                x => x.FarmId == field.FarmId && x.Id != fieldId && x.Name.ToUpper() == name.ToUpper(), cancellationToken))
        {
            throw new ResourceConflictException("A Field with this name already exists in the Farm.");
        }
        (command with { Name = name, SoilType = NormalizeOptional(command.SoilType, 100) }).ApplyTo(field, boundary);
        await dbContext.SaveChangesAsync(cancellationToken);
        return ToFieldDetail(field, await LoadZoneSummariesAsync(fieldId, cancellationToken));
    }

    async Task<ArchiveView> IFieldService.ArchiveAsync(
        Guid ownerUserId, Guid tenantId, Guid fieldId, CancellationToken cancellationToken)
    {
        await EnsureOwnerScopeAsync(ownerUserId, tenantId, cancellationToken);
        var field = await dbContext.Fields.Include(x => x.Zones)
            .SingleOrDefaultAsync(x => x.Id == fieldId && x.Farm.TenantId == tenantId, cancellationToken)
            ?? throw new ResourceNotFoundException("Field was not found in the current Tenant.");
        if (field.Zones.Any(x => x.Status == ZoneStatus.Operating))
        {
            throw new ResourceConflictException("Field still contains an Operating Zone.");
        }
        var now = timeProvider.GetUtcNow().UtcDateTime;
        await using var transaction = await dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
        field.ArchivedAtUtc = now;
        foreach (var zone in field.Zones.Where(x => x.Status != ZoneStatus.Archived))
        {
            zone.Status = ZoneStatus.Archived;
            zone.ArchivedAtUtc = now;
        }
        await dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return new ArchiveView("Field was archived.", now);
    }

    async Task<IReadOnlyList<ZoneView>> IZoneService.ListAsync(
        Guid ownerUserId, Guid tenantId, Guid fieldId, ZoneStatus? status, CancellationToken cancellationToken)
    {
        await EnsureOwnerScopeAsync(ownerUserId, tenantId, cancellationToken);
        await GetFieldEntityAsync(tenantId, fieldId, tracking: false, cancellationToken);
        var query = dbContext.Zones.AsNoTracking()
            .Include(x => x.Field)
            .Include(x => x.Crop).Include(x => x.Variety)
            .Include(x => x.PlantingSeasons).ThenInclude(ps => ps.Crop)
            .Include(x => x.PlantingSeasons).ThenInclude(ps => ps.Variety)
            .Include(x => x.PlantingSeasons).ThenInclude(ps => ps.CurrentGrowthStage)
            .Where(x => x.FieldId == fieldId);
        query = status.HasValue ? query.Where(x => x.Status == status) : query.Where(x => x.Status != ZoneStatus.Archived);
        var zones = await query.OrderBy(x => x.Name).ToListAsync(cancellationToken);
        return zones.Select(x => ToZoneView(x, x.Field.FarmId)).ToList();
    }

    async Task<IReadOnlyList<ZoneView>> IZoneService.ListAllAsync(
        Guid ownerUserId, Guid tenantId, Guid? fieldId, ZoneStatus? status, CancellationToken cancellationToken)
    {
        await EnsureOwnerScopeAsync(ownerUserId, tenantId, cancellationToken);
        var caller = await dbContext.AppUsers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == ownerUserId, cancellationToken);
        var query = dbContext.Zones.AsNoTracking()
            .Include(x => x.Field).ThenInclude(f => f.Farm)
            .Include(x => x.Crop).Include(x => x.Variety)
            .Include(x => x.PlantingSeasons).ThenInclude(ps => ps.Crop)
            .Include(x => x.PlantingSeasons).ThenInclude(ps => ps.Variety)
            .Include(x => x.PlantingSeasons).ThenInclude(ps => ps.CurrentGrowthStage)
            .Where(x => x.ArchivedAtUtc == null);
        if (caller?.Role != UserRole.PlatformAdmin && caller?.Role != UserRole.PlatformTechnician)
        {
            query = query.Where(x => x.Field.Farm.TenantId == tenantId);
        }
        if (fieldId.HasValue) query = query.Where(x => x.FieldId == fieldId.Value);
        if (status.HasValue) query = query.Where(x => x.Status == status.Value);
        var zones = await query.OrderBy(x => x.Name).ToListAsync(cancellationToken);
        return zones.Select(x => ToZoneView(x, x.Field.FarmId)).ToList();
    }

    async Task<ZoneView> IZoneService.CreateAsync(
        Guid ownerUserId, Guid tenantId, Guid fieldId, CreateZoneCommand command, CancellationToken cancellationToken)
    {
        await EnsureOwnerScopeAsync(ownerUserId, tenantId, cancellationToken);
        ValidateArea(command.AreaM2, nameof(command.AreaM2));
        var boundary = GeoJsonPolygonValidator.Normalize(command.BoundaryGeoJson, nameof(command.BoundaryGeoJson));
        var name = NormalizeRequired(command.Name, nameof(command.Name), 200);
        var zoneType = NormalizeRequired(command.ZoneType, nameof(command.ZoneType), 50);

        await using var transaction = await dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
        var field = await GetFieldEntityAsync(tenantId, fieldId, tracking: true, cancellationToken);
        if (field.ArchivedAtUtc.HasValue || field.Farm.Status == FarmStatus.Archived)
        {
            throw new ResourceConflictException("Cannot add a Zone to an archived parent.");
        }
        if (command.AreaM2 > field.AvailableAreaM2)
        {
            throw new RequestValidationException(nameof(command.AreaM2), "Zone area exceeds the Field available area.");
        }
        if (await dbContext.Zones.AnyAsync(x => x.FieldId == fieldId && x.Name.ToUpper() == name.ToUpper(), cancellationToken))
        {
            throw new ResourceConflictException("A Zone with this name already exists in the Field.");
        }

        // Validate boundary does not overlap with existing active zones in the same field
        var newGeom = GeoJsonPolygonValueConverter.Parse(boundary);
        var existingZones = await dbContext.Zones.AsNoTracking()
            .Where(x => x.FieldId == fieldId && x.Status != ZoneStatus.Archived && x.BoundaryGeoJson != null)
            .Select(x => new { x.Id, x.Name, x.BoundaryGeoJson })
            .ToListAsync(cancellationToken);

        foreach (var ez in existingZones)
        {
            if (ez.BoundaryGeoJson == null) continue;
            var ezGeom = GeoJsonPolygonValueConverter.Parse(ez.BoundaryGeoJson);
            if (newGeom.Intersects(ezGeom))
            {
                var intersection = newGeom.Intersection(ezGeom);
                // Check if the intersection is a 2D surface (overlap), not just touching boundaries
                if (intersection is NetTopologySuite.Geometries.Polygon or NetTopologySuite.Geometries.MultiPolygon)
                {
                    if (intersection.Area > 0.00000001) // Area > ~0.1 m2 in degrees
                    {
                        throw new ResourceConflictException($"Vùng ranh giới mới bị chồng lấn (đè) lên khu vực '{ez.Name}'. Vui lòng chỉnh sửa lại tọa độ ranh giới.");
                    }
                }
            }
        }

        var (cropId, varietyId) = await ResolveZoneCropAsync(tenantId, command.CropId, command.VarietyId, cancellationToken);
        var zone = (command with { Name = name, ZoneType = zoneType, Notes = NormalizeOptional(command.Notes, 1000) })
            .ToEntity(fieldId, boundary);
        zone.CropId = cropId;
        zone.CropVarietyId = varietyId;
        field.AvailableAreaM2 -= zone.AreaM2;
        dbContext.Zones.Add(zone);
        await dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        await dbContext.Entry(zone).Reference(x => x.Crop).LoadAsync(cancellationToken);
        await dbContext.Entry(zone).Reference(x => x.Variety).LoadAsync(cancellationToken);
        return ToZoneView(zone, field.FarmId);
    }

    async Task<ZoneView> IZoneService.GetAsync(
        Guid ownerUserId, Guid tenantId, Guid zoneId, CancellationToken cancellationToken)
    {
        await EnsureOwnerScopeAsync(ownerUserId, tenantId, cancellationToken);
        var zone = await GetZoneEntityAsync(tenantId, zoneId, tracking: false, cancellationToken);
        return ToZoneView(zone, zone.Field.FarmId);
    }

    async Task<ZoneView> IZoneService.UpdateAsync(
        Guid ownerUserId, Guid tenantId, Guid zoneId, UpdateZoneCommand command, CancellationToken cancellationToken)
    {
        await EnsureOwnerScopeAsync(ownerUserId, tenantId, cancellationToken);
        var boundary = command.BoundaryGeoJson.HasValue
            ? GeoJsonPolygonValidator.Normalize(command.BoundaryGeoJson.Value, nameof(command.BoundaryGeoJson))
            : null;
        if (command.AreaM2.HasValue)
        {
            ValidateArea(command.AreaM2.Value, nameof(command.AreaM2));
        }
        if (command.Status == ZoneStatus.Archived)
        {
            throw new RequestValidationException(nameof(command.Status), "Use DELETE to archive a Zone.");
        }

        await using var transaction = await dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
        var zone = await GetZoneEntityAsync(tenantId, zoneId, tracking: true, cancellationToken);
        if (zone.Status == ZoneStatus.Archived)
        {
            throw new ResourceConflictException("An archived Zone cannot be updated.");
        }
        var changesArea = command.AreaM2.HasValue && command.AreaM2.Value != zone.AreaM2;
        var changesBoundary = boundary is not null && !JsonEquivalent(boundary, zone.BoundaryGeoJson);
        if (zone.Status == ZoneStatus.Operating && (changesArea || changesBoundary))
        {
            throw new ResourceConflictException("An Operating Zone cannot change area or boundary.");
        }
        var requestedArea = command.AreaM2 ?? zone.AreaM2;
        var capacity = zone.Field.AvailableAreaM2 + zone.AreaM2;
        if (requestedArea > capacity)
        {
            throw new RequestValidationException(nameof(command.AreaM2), "Zone area exceeds the Field available area.");
        }
        var name = NormalizeRequired(command.Name, nameof(command.Name), 200);
        if (await dbContext.Zones.AnyAsync(
                x => x.FieldId == zone.FieldId && x.Id != zoneId && x.Name.ToUpper() == name.ToUpper(), cancellationToken))
        {
            throw new ResourceConflictException("A Zone with this name already exists in the Field.");
        }

        if (boundary is not null)
        {
            var updatedGeom = GeoJsonPolygonValueConverter.Parse(boundary);
            var otherZones = await dbContext.Zones.AsNoTracking()
                .Where(x => x.FieldId == zone.FieldId && x.Id != zoneId && x.Status != ZoneStatus.Archived && x.BoundaryGeoJson != null)
                .Select(x => new { x.Id, x.Name, x.BoundaryGeoJson })
                .ToListAsync(cancellationToken);

            foreach (var oz in otherZones)
            {
                if (oz.BoundaryGeoJson == null) continue;
                var ozGeom = GeoJsonPolygonValueConverter.Parse(oz.BoundaryGeoJson);
                if (updatedGeom.Intersects(ozGeom))
                {
                    var intersection = updatedGeom.Intersection(ozGeom);
                    if (intersection is NetTopologySuite.Geometries.Polygon or NetTopologySuite.Geometries.MultiPolygon)
                    {
                        if (intersection.Area > 0.00000001)
                        {
                            throw new ResourceConflictException($"Vùng ranh giới cập nhật bị chồng lấn (đè) lên khu vực '{oz.Name}'. Vui lòng chỉnh sửa lại tọa độ ranh giới.");
                        }
                    }
                }
            }
        }

        // Cây hiện tại của Zone độc lập với vụ mùa: đổi cây không được tạo ra lệch với vụ đang chạy.
        if (command.ClearCrop || command.CropId.HasValue)
        {
            var (newCropId, newVarietyId) = command.ClearCrop
                ? ((Guid?)null, (Guid?)null)
                : await ResolveZoneCropAsync(tenantId, command.CropId, command.VarietyId, cancellationToken);
            if ((newCropId != zone.CropId || newVarietyId != zone.CropVarietyId) &&
                zone.PlantingSeasons.Any(s => s.Status == PlantingSeasonStatus.InProgress && (s.CropId != newCropId || (newVarietyId.HasValue && s.VarietyId != newVarietyId))))
            {
                throw new ResourceConflictException("Zone đang có vụ mùa InProgress với cây/giống khác. Hãy kết thúc hoặc hủy vụ đó trước khi đổi cây của Zone.");
            }
            zone.CropId = newCropId;
            zone.CropVarietyId = newVarietyId;
            zone.Crop = null;
            zone.Variety = null;
        }

        zone.Field.AvailableAreaM2 = capacity - requestedArea;
        (command with
        {
            Name = name,
            ZoneType = command.ZoneType is null ? null : NormalizeRequired(command.ZoneType, nameof(command.ZoneType), 50),
            Notes = NormalizeOptional(command.Notes, 1000)
        }).ApplyTo(zone, boundary);
        await dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        await dbContext.Entry(zone).Reference(x => x.Crop).LoadAsync(cancellationToken);
        await dbContext.Entry(zone).Reference(x => x.Variety).LoadAsync(cancellationToken);
        return ToZoneView(zone, zone.Field.FarmId);
    }

    /// <summary>Cây phải thuộc danh mục hiển thị cho Tenant (hệ thống hoặc của Tenant); giống phải thuộc đúng cây đó. Cả hai đều có thể để trống.</summary>
    private async Task<(Guid? CropId, Guid? VarietyId)> ResolveZoneCropAsync(Guid tenantId, Guid? cropId, Guid? varietyId, CancellationToken cancellationToken)
    {
        if (!cropId.HasValue)
        {
            if (varietyId.HasValue) throw new RequestValidationException("VarietyId", "Phải chọn cây trước khi chọn giống.");
            return (null, null);
        }
        var visibleTenant = tenantId == Guid.Empty ? (Guid?)null : tenantId;
        if (!await dbContext.Crops.AsNoTracking().AnyAsync(x => x.Id == cropId && (x.TenantId == null || x.TenantId == visibleTenant), cancellationToken))
            throw new RequestValidationException("CropId", "Cây trồng không tồn tại hoặc không thuộc danh mục của bạn.");
        if (varietyId.HasValue &&
            !await dbContext.CropVarieties.AsNoTracking().AnyAsync(x => x.Id == varietyId && x.CropId == cropId && (x.TenantId == null || x.TenantId == visibleTenant), cancellationToken))
            throw new RequestValidationException("VarietyId", "Giống không thuộc cây đã chọn.");
        return (cropId, varietyId);
    }

    async Task<ArchiveView> IZoneService.ArchiveAsync(
        Guid ownerUserId, Guid tenantId, Guid zoneId, CancellationToken cancellationToken)
    {
        await EnsureOwnerScopeAsync(ownerUserId, tenantId, cancellationToken);
        await using var transaction = await dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
        var zone = await GetZoneEntityAsync(tenantId, zoneId, tracking: true, cancellationToken);
        if (zone.Status == ZoneStatus.Archived)
        {
            throw new ResourceConflictException("Zone is already archived.");
        }
        var now = timeProvider.GetUtcNow().UtcDateTime;
        zone.Status = ZoneStatus.Archived;
        zone.ArchivedAtUtc = now;
        zone.Field.AvailableAreaM2 += zone.AreaM2;
        await dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return new ArchiveView("Zone was archived.", now);
    }

    private async Task EnsureOwnerScopeAsync(Guid userId, Guid tenantId, CancellationToken cancellationToken)
    {
        var user = await dbContext.AppUsers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == userId, cancellationToken);
        if (user == null || user.Status != AccountStatus.Active)
        {
            throw new AuthorizationException("The user account is inactive or not found.");
        }

        if (user.Role is UserRole.PlatformAdmin or UserRole.PlatformTechnician)
        {
            return;
        }

        if (user.Role == UserRole.FarmOwner && user.TenantId == tenantId)
        {
            return;
        }

        if (user.Role == UserRole.Farmer && user.TenantId == tenantId)
        {
            return;
        }

        throw new AuthorizationException("The user does not have permission to access farm structure in this scope.");
    }

    private async Task<Farm> GetFarmEntityAsync(Guid tenantId, Guid farmId, CancellationToken cancellationToken) =>
        await dbContext.Farms.SingleOrDefaultAsync(x => x.Id == farmId && (tenantId == Guid.Empty || x.TenantId == tenantId), cancellationToken)
        ?? throw new ResourceNotFoundException("Farm was not found in the current Tenant.");

    private async Task<Field> GetFieldEntityAsync(Guid tenantId, Guid fieldId, bool tracking, CancellationToken cancellationToken)
    {
        var query = dbContext.Fields.Include(x => x.Farm).Where(x => x.Id == fieldId && (tenantId == Guid.Empty || x.Farm.TenantId == tenantId));
        if (!tracking) query = query.AsNoTracking();
        return await query.SingleOrDefaultAsync(cancellationToken)
            ?? throw new ResourceNotFoundException("Field was not found in the current Tenant.");
    }

    private async Task<Zone> GetZoneEntityAsync(Guid tenantId, Guid zoneId, bool tracking, CancellationToken cancellationToken)
    {
        var query = dbContext.Zones
            .Include(x => x.Field).ThenInclude(x => x.Farm)
            .Include(x => x.Crop).Include(x => x.Variety)
            .Include(x => x.PlantingSeasons).ThenInclude(ps => ps.Crop)
            .Include(x => x.PlantingSeasons).ThenInclude(ps => ps.Variety)
            .Include(x => x.PlantingSeasons).ThenInclude(ps => ps.CurrentGrowthStage)
            .Where(x => x.Id == zoneId && (tenantId == Guid.Empty || x.Field.Farm.TenantId == tenantId));
        if (!tracking) query = query.AsNoTracking();
        return await query.SingleOrDefaultAsync(cancellationToken)
            ?? throw new ResourceNotFoundException("Zone was not found in the current Tenant.");
    }

    private async Task<IReadOnlyList<ZoneSummaryView>> LoadZoneSummariesAsync(Guid fieldId, CancellationToken cancellationToken) =>
        await dbContext.Zones.AsNoTracking().Where(x => x.FieldId == fieldId && x.Status != ZoneStatus.Archived)
            .OrderBy(x => x.Name).Select(x => new ZoneSummaryView(x.Id, x.FieldId, x.Name, x.AreaM2, x.ZoneType, x.Status))
            .ToListAsync(cancellationToken);

    private static FarmDetailView ToFarmDetail(Farm farm, int fields, int zones) => new(
        farm.Id, farm.TenantId, farm.Name, farm.LocationText, farm.Latitude, farm.Longitude, farm.TotalAreaM2,
        farm.TimeZone, farm.Status, fields, zones, farm.CreatedAtUtc, farm.UpdatedAtUtc, farm.ArchivedAtUtc);

    private static FieldDetailView ToFieldDetail(Field field, IReadOnlyList<ZoneSummaryView> zones) => new(
        field.Id, field.FarmId, field.Name, field.AreaM2, field.AvailableAreaM2, field.SoilType,
        field.Latitude, field.Longitude, ParseJson(field.BoundaryGeoJson), zones,
        field.CreatedAtUtc, field.UpdatedAtUtc, field.ArchivedAtUtc);

    private static ZoneView ToZoneView(Zone zone, Guid farmId)
    {
        // Cây hiện tại chỉ là thuộc tính của Zone. Vụ mùa không bao giờ trở thành "cây hiện tại": vụ InProgress chỉ cho giai đoạn
        // (khi cùng cây với Zone), vụ Planned chỉ là cây dự kiến, vụ Completed/Cancelled không hiển thị.
        var cropName = zone.Crop?.Name;
        var varietyName = zone.Variety?.Name;
        var currentCrop = string.IsNullOrWhiteSpace(cropName)
            ? null
            : !string.IsNullOrWhiteSpace(varietyName) && !varietyName.Equals(cropName, StringComparison.OrdinalIgnoreCase) ? $"{cropName} ({varietyName})" : cropName;

        var inProgress = zone.PlantingSeasons.FirstOrDefault(ps => ps.Status == PlantingSeasonStatus.InProgress);
        var planned = zone.PlantingSeasons.Where(ps => ps.Status == PlantingSeasonStatus.Planned).OrderBy(ps => ps.StartDate).FirstOrDefault();
        var matches = inProgress is not null && zone.CropId.HasValue && inProgress.CropId == zone.CropId && (zone.CropVarietyId is null || inProgress.VarietyId is null || inProgress.VarietyId == zone.CropVarietyId);
        var seasonStatus = inProgress is not null ? (matches ? "InProgress" : "Mismatch") : planned is not null ? "PlannedOnly" : "None";
        var currentStage = matches ? inProgress!.CurrentGrowthStage?.Name : null;

        return new(
            zone.Id, zone.FieldId, farmId, zone.Name, zone.AreaM2, zone.ZoneType, zone.Notes, zone.Status,
            ParseJson(zone.BoundaryGeoJson), zone.CreatedAtUtc, zone.UpdatedAtUtc, zone.ArchivedAtUtc,
            currentCrop, currentStage, zone.CropId, zone.CropVarietyId, cropName, varietyName,
            seasonStatus, inProgress?.Name, inProgress?.Crop?.Name, planned?.Crop?.Name);
    }

    private static JsonElement? ParseJson(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        using var document = JsonDocument.Parse(value);
        return document.RootElement.Clone();
    }

    private static bool JsonEquivalent(string left, string? right) => right is not null &&
        JsonNode.DeepEquals(JsonNode.Parse(left), JsonNode.Parse(right));

    private static void ValidateFarm(string name, decimal? latitude, decimal? longitude, decimal area, string timeZone)
    {
        _ = NormalizeRequired(name, nameof(name), 200);
        ValidateCoordinates(latitude, longitude);
        ValidateArea(area, nameof(area));
        if (area > MaximumFarmAreaM2)
            throw new RequestValidationException(nameof(area), $"Farm area cannot exceed {MaximumFarmAreaM2} square metres.");
        _ = NormalizeRequired(timeZone, nameof(timeZone), 100);
    }

    private static void ValidateCoordinates(decimal? latitude, decimal? longitude)
    {
        if (latitude is < -90 or > 90)
            throw new RequestValidationException(nameof(latitude), "Latitude must be between -90 and 90.");
        if (longitude is < -180 or > 180)
            throw new RequestValidationException(nameof(longitude), "Longitude must be between -180 and 180.");
    }

    private static void ValidateArea(decimal area, string field)
    {
        if (area <= 0) throw new RequestValidationException(field, "Area must be greater than zero.");
    }

    private static string NormalizeRequired(string value, string field, int maxLength)
    {
        var result = value?.Trim();
        if (string.IsNullOrWhiteSpace(result) || result.Length > maxLength)
            throw new RequestValidationException(field, $"{field} is required and must not exceed {maxLength} characters.");
        return result;
    }

    private static string? NormalizeOptional(string? value, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var result = value.Trim();
        if (result.Length > maxLength)
            throw new RequestValidationException(nameof(value), $"Value must not exceed {maxLength} characters.");
        return result;
    }
}
