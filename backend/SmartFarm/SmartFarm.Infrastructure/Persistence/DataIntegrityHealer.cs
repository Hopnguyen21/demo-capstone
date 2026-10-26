using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;

namespace SmartFarm.Infrastructure.Persistence;

/// <summary>
/// Hỗ trợ môi trường Development/Demo: tự động bổ sung hồ sơ sinh trưởng và phân quyền nông dân theo đúng ranh giới Tenant.
/// TUYỆT ĐỐI không chèn telemetry giả mạo và không tạo actuator ảo.
/// </summary>
public static class DataIntegrityHealer
{
    public static async Task HealAsync(
        SmartFarmDbContext db, 
        ILogger logger, 
        IConfiguration config, 
        bool isDevelopment, 
        CancellationToken ct = default)
    {
        // Chỉ chạy trong môi trường Development và khi được bật tường minh qua cấu hình
        if (!isDevelopment || !config.GetValue<bool>("DataHealer:Enabled", false))
        {
            logger.LogInformation("[DataIntegrityHealer] Bỏ qua healing (môi trường không phải Development hoặc DataHealer:Enabled không bật).");
            return;
        }

        var now = DateTime.UtcNow;
        var modified = false;

        try
        {
            // 1. Vá các Cây trồng (Crops) chưa có Hồ sơ sinh trưởng (GrowthProfile)
            var crops = await db.Crops.Include(c => c.GrowthProfiles).ToListAsync(ct);
            foreach (var crop in crops)
            {
                if (crop.GrowthProfiles.Count == 0)
                {
                    logger.LogInformation("[DataIntegrityHealer] Phát hiện Cây '{Crop}' chưa có GrowthProfile. Đang tự động bổ sung...", crop.Name);
                    var isSys = crop.TenantId == null;
                    var newProfile = new GrowthProfile
                    {
                        Id = Guid.NewGuid(),
                        CropId = crop.Id,
                        TenantId = crop.TenantId,
                        Name = $"Quy trình chuẩn VietGAP - {crop.Name}",
                        NormalizedName = $"quy-trinh-chuan-vietgap-{crop.NormalizedName}",
                        Description = $"Tiêu chuẩn vi khí hậu chuẩn VietGAP cho {crop.Name}",
                        IsDefault = true,
                        IsSystemDefined = isSys,
                        CreatedAtUtc = now
                    };

                    var stage = new GrowthStage
                    {
                        Id = Guid.NewGuid(),
                        GrowthProfileId = newProfile.Id,
                        Name = "Sinh trưởng và thu hoạch",
                        StageOrder = 1,
                        DurationDays = 60,
                        CreatedAtUtc = now
                    };

                    stage.Requirements.Add(new EnvironmentalRequirement { GrowthStageId = stage.Id, ParameterCode = EnvironmentalParameterCode.Temperature, MinValue = 20, MaxValue = 30, TargetValue = 25, Unit = "°C" });
                    stage.Requirements.Add(new EnvironmentalRequirement { GrowthStageId = stage.Id, ParameterCode = EnvironmentalParameterCode.AirHumidity, MinValue = 60, MaxValue = 80, TargetValue = 70, Unit = "%" });
                    stage.Requirements.Add(new EnvironmentalRequirement { GrowthStageId = stage.Id, ParameterCode = EnvironmentalParameterCode.SoilMoisture, MinValue = 60, MaxValue = 75, TargetValue = 68, Unit = "%" });
                    stage.Requirements.Add(new EnvironmentalRequirement { GrowthStageId = stage.Id, ParameterCode = EnvironmentalParameterCode.LightIntensity, MinValue = 20000, MaxValue = 60000, TargetValue = 30000, Unit = "lux" });
                    stage.Requirements.Add(new EnvironmentalRequirement { GrowthStageId = stage.Id, ParameterCode = EnvironmentalParameterCode.Ph, MinValue = 6.0m, MaxValue = 6.8m, TargetValue = 6.4m, Unit = "pH" });
                    stage.Requirements.Add(new EnvironmentalRequirement { GrowthStageId = stage.Id, ParameterCode = EnvironmentalParameterCode.Ec, MinValue = 1.5m, MaxValue = 2.5m, TargetValue = 2.0m, Unit = "mS/cm" });

                    newProfile.Stages.Add(stage);
                    db.GrowthProfiles.Add(newProfile);
                    crop.GrowthProfiles.Add(newProfile);
                    modified = true;
                }
            }

            if (modified)
            {
                await db.SaveChangesAsync(ct);
                modified = false;
            }

            // 2. Vá các Zone chưa có Vụ mùa (Planting Season) đang hoạt động (InProgress)
            var zones = await db.Zones
                .Include(z => z.Field)
                .ThenInclude(f => f.Farm)
                .Where(z => z.ArchivedAtUtc == null)
                .ToListAsync(ct);

            var activeSeasons = await db.PlantingSeasons
                .Where(s => s.Status == PlantingSeasonStatus.InProgress)
                .ToListAsync(ct);

            var activeFarmingSeason = await db.FarmingSeasons.FirstOrDefaultAsync(fs => fs.IsActive, ct);

            foreach (var zone in zones)
            {
                var hasActive = activeSeasons.Any(s => s.ZoneId == zone.Id);
                if (!hasActive)
                {
                    logger.LogInformation("[DataIntegrityHealer] Zone '{Zone}' chưa có vụ mùa hoạt động. Đang gán mùa vụ VietGAP...", zone.Name);

                    var zoneLower = (zone.Name + " " + (zone.Notes ?? "")).ToLowerInvariant();
                    var tenantId = zone.Field.Farm.TenantId;
                    var candidateCrops = crops.Where(c => c.TenantId == null || c.TenantId == tenantId).ToList();
                    Crop? matchedCrop = null;
                    if (zoneLower.Contains("cà chua") || zoneLower.Contains("ca chua") || zoneLower.Contains("tomato") || zoneLower.Contains("beefsteak"))
                        matchedCrop = candidateCrops.FirstOrDefault(c => c.Name.Contains("Cà chua", StringComparison.OrdinalIgnoreCase) || c.Name.Contains("Ca Chua", StringComparison.OrdinalIgnoreCase) || c.Name.Contains("Tomato", StringComparison.OrdinalIgnoreCase));
                    else if (zoneLower.Contains("dưa leo") || zoneLower.Contains("dua leo") || zoneLower.Contains("cucumber"))
                        matchedCrop = candidateCrops.FirstOrDefault(c => c.Name.Contains("Dưa leo", StringComparison.OrdinalIgnoreCase) || c.Name.Contains("Dua leo", StringComparison.OrdinalIgnoreCase) || c.Name.Contains("Cucumber", StringComparison.OrdinalIgnoreCase));
                    else if (zoneLower.Contains("dâu tây") || zoneLower.Contains("dau tay") || zoneLower.Contains("strawberry"))
                        matchedCrop = candidateCrops.FirstOrDefault(c => c.Name.Contains("Dâu tây", StringComparison.OrdinalIgnoreCase) || c.Name.Contains("Dau Tay", StringComparison.OrdinalIgnoreCase) || c.Name.Contains("Strawberry", StringComparison.OrdinalIgnoreCase));
                    else if (zoneLower.Contains("xà lách") || zoneLower.Contains("xa lach") || zoneLower.Contains("lettuce"))
                        matchedCrop = candidateCrops.FirstOrDefault(c => c.Name.Contains("Xà lách", StringComparison.OrdinalIgnoreCase) || c.Name.Contains("Xa Lach", StringComparison.OrdinalIgnoreCase) || c.Name.Contains("Batavia", StringComparison.OrdinalIgnoreCase));
                    else if (zoneLower.Contains("ớt") || zoneLower.Contains("ot") || zoneLower.Contains("pepper"))
                        matchedCrop = candidateCrops.FirstOrDefault(c => c.Name.Contains("Ớt", StringComparison.OrdinalIgnoreCase) || c.Name.Contains("Ot", StringComparison.OrdinalIgnoreCase) || c.Name.Contains("Pepper", StringComparison.OrdinalIgnoreCase));

                    // NẾU KHÔNG KHỚP TỪ KHÓA: LẤY CÂY TRỒNG MẪU ĐẦU TIÊN (Ví dụ Cà chua hoặc Dưa leo VietGAP) THAY VÌ BỎ QUA
                    matchedCrop ??= candidateCrops.FirstOrDefault(c => c.Name.Contains("Cà chua", StringComparison.OrdinalIgnoreCase)) ?? candidateCrops.FirstOrDefault();

                    if (matchedCrop is null) continue;

                    var variety = await db.CropVarieties.FirstOrDefaultAsync(v => v.CropId == matchedCrop.Id, ct);
                    var profile = await db.GrowthProfiles.Include(p => p.Stages).ThenInclude(s => s.Requirements)
                        .FirstOrDefaultAsync(p => p.CropId == matchedCrop.Id && (p.TenantId == null || p.TenantId == tenantId), ct)
                        ?? await db.GrowthProfiles.Include(p => p.Stages).ThenInclude(s => s.Requirements)
                        .FirstOrDefaultAsync(p => p.CropId == matchedCrop.Id, ct);

                    if (profile is null) continue;

                    var stage = profile.Stages.FirstOrDefault()
                        ?? await db.GrowthStages.Include(s => s.Requirements).FirstOrDefaultAsync(s => s.GrowthProfileId == profile.Id, ct);
                    if (stage is null) continue;

                    var newSeasonId = Guid.NewGuid();
                    var season = new PlantingSeason
                    {
                        Id = newSeasonId,
                        ZoneId = zone.Id,
                        CropId = matchedCrop.Id,
                        VarietyId = variety?.Id,
                        GrowthProfileId = profile.Id,
                        CurrentGrowthStageId = stage.Id,
                        FarmingSeasonId = activeFarmingSeason?.Id,
                        Name = $"Vụ {matchedCrop.Name} {now.Year}",
                        StartDate = DateOnly.FromDateTime(now.AddDays(-15)),
                        ExpectedEndDate = DateOnly.FromDateTime(now.AddDays(75)),
                        Status = PlantingSeasonStatus.InProgress,
                        CreatedAtUtc = now
                    };
                    db.PlantingSeasons.Add(season);
                    activeSeasons.Add(season);

                    if (stage.Requirements.Count > 0)
                    {
                        foreach (var req in stage.Requirements)
                        {
                            db.SeasonAppliedRequirements.Add(new SeasonAppliedRequirement
                            {
                                PlantingSeasonId = newSeasonId,
                                ParameterCode = req.ParameterCode,
                                MinValue = req.MinValue,
                                MaxValue = req.MaxValue,
                                TargetValue = req.TargetValue,
                                Unit = req.Unit
                            });
                        }
                    }
                    modified = true;
                }
            }

            if (modified)
            {
                await db.SaveChangesAsync(ct);
                modified = false;
            }

            // 3. Phân quyền Zone cho Farmer ĐÚNG THEO TENANT (tuyệt đối không phân quyền chéo tenant)
            var farmers = await db.AppUsers.Where(u => u.Role == UserRole.Farmer).ToListAsync(ct);
            var existingAccesses = await db.UserZoneAccesses.ToListAsync(ct);
            foreach (var farmer in farmers)
            {
                // Chỉ phân quyền các zone thuộc đúng farm cùng TenantId với tài khoản Farmer
                foreach (var zone in zones.Where(z => z.Field.Farm.TenantId == farmer.TenantId))
                {
                    if (!existingAccesses.Any(a => a.AppUserId == farmer.Id && a.ZoneId == zone.Id))
                    {
                        db.UserZoneAccesses.Add(new UserZoneAccess
                        {
                            AppUserId = farmer.Id,
                            ZoneId = zone.Id,
                            CanControl = true,
                            AssignedAtUtc = now
                        });
                        modified = true;
                    }
                }
            }

            if (modified)
            {
                await db.SaveChangesAsync(ct);
            }

            logger.LogInformation("[DataIntegrityHealer] Đã kiểm tra tính toàn vẹn dữ liệu an toàn theo ranh giới Tenant.");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[DataIntegrityHealer] Gặp lỗi trong quá trình heal dữ liệu: {Message}", ex.Message);
        }
    }
}
