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

            // 2. Không còn tự tạo vụ mùa/cây cho Zone: cây của Zone do Owner chọn, không suy ra từ tên Zone, ghi chú hay cây mặc định.
            var zones = await db.Zones.Include(z => z.Field).ThenInclude(f => f.Farm).Where(z => z.ArchivedAtUtc == null).ToListAsync(ct);

            // 3. Phân quyền Zone cho Farmer ĐÚNG THEO TENANT (tuyệt đối không phân quyền chéo tenant)
            var farmers = await db.AppUsers.Where(u => u.Role == UserRole.Farmer).ToListAsync(ct);
            var existingAccesses = await db.UserZoneAccesses.ToListAsync(ct);
            foreach (var farmer in farmers)
            {
                // Chỉ phân quyền các Zone thuộc đúng Farm của Farmer (cùng Tenant là chưa đủ: API từ chối Zone ngoài Farm)
                foreach (var zone in zones.Where(z => z.Field.Farm.TenantId == farmer.TenantId && z.Field.FarmId == farmer.FarmId))
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
