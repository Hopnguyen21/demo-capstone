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
            // 1. Cây chưa có Hồ sơ sinh trưởng: chỉ cảnh báo, KHÔNG tự tạo hồ sơ. Hồ sơ tự tạo mang ngưỡng vi khí hậu và số ngày bịa
            //    (không có nguồn), mà AI và cảnh báo sẽ dùng như dữ liệu thật; ngưỡng phải do quản trị viên nhập từ tài liệu đã duyệt.
            var cropsWithoutProfile = await db.Crops.Where(c => !c.GrowthProfiles.Any()).Select(c => c.Name).ToListAsync(ct);
            foreach (var cropName in cropsWithoutProfile)
                logger.LogWarning("[DataIntegrityHealer] Cây '{Crop}' chưa có Hồ sơ sinh trưởng. Không tự tạo; hãy tạo hồ sơ với ngưỡng từ tài liệu đã duyệt.", cropName);

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
                modified = false;
            }

            // 4. Phân bổ hợp lý thiết bị mẫu cho các Zone demo nếu Zone chưa có thiết bị
            var demoZone1 = Guid.Parse("32000000-0000-0000-0000-000000000001");
            var demoZone2 = Guid.Parse("32000000-0000-0000-0000-000000000002");
            var demoZone3 = Guid.Parse("32000000-0000-0000-0000-000000000003");

            var d1 = await db.Devices.FirstOrDefaultAsync(d => d.Id == Guid.Parse("52000000-0000-0000-0000-000000000001"), ct);
            var d2 = await db.Devices.FirstOrDefaultAsync(d => d.Id == Guid.Parse("52000000-0000-0000-0000-000000000002"), ct);
            var d3 = await db.Devices.FirstOrDefaultAsync(d => d.Id == Guid.Parse("52000000-0000-0000-0000-000000000003"), ct);
            var d4 = await db.Devices.FirstOrDefaultAsync(d => d.Id == Guid.Parse("52000000-0000-0000-0000-000000000004"), ct);
            var d5 = await db.Devices.FirstOrDefaultAsync(d => d.Id == Guid.Parse("52000000-0000-0000-0000-000000000005"), ct);
            var d6 = await db.Devices.FirstOrDefaultAsync(d => d.Id == Guid.Parse("52000000-0000-0000-0000-000000000006"), ct);

            if (d1 != null && (d1.ZoneId == null || !await db.Devices.AnyAsync(d => d.ZoneId == demoZone1, ct))) { d1.ZoneId = demoZone1; modified = true; }
            if (d2 != null && !await db.Devices.AnyAsync(d => d.ZoneId == demoZone1 && d.Id == d2.Id, ct)) { d2.ZoneId = demoZone1; modified = true; }
            if (d3 != null && (d3.ZoneId == null || !await db.Devices.AnyAsync(d => d.ZoneId == demoZone2, ct))) { d3.ZoneId = demoZone2; modified = true; }
            if (d4 != null && !await db.Devices.AnyAsync(d => d.ZoneId == demoZone2 && d.Id == d4.Id, ct)) { d4.ZoneId = demoZone2; modified = true; }
            if (d5 != null && (d5.ZoneId == null || !await db.Devices.AnyAsync(d => d.ZoneId == demoZone3, ct))) { d5.ZoneId = demoZone3; modified = true; }
            if (d6 != null && !await db.Devices.AnyAsync(d => d.ZoneId == demoZone3 && d.Id == d6.Id, ct)) { d6.ZoneId = demoZone3; modified = true; }

            if (modified)
            {
                await db.SaveChangesAsync(ct);
                modified = false;
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
