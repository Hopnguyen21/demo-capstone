using Microsoft.EntityFrameworkCore;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Ai.Knowledge;
using SmartFarm.Infrastructure.Persistence;
using System.Text;
using Xunit;
using Xunit.Abstractions;

namespace SmartFarm.Infrastructure.Tests;

public class DataAuditTests(ITestOutputHelper output)
{
    private static SmartFarmDbContext CreateLiveContext()
    {
        var connStr = Environment.GetEnvironmentVariable("SMARTFARM_TEST_DB")
            ?? "Host=localhost;Port=5432;Database=SmartFarmDB01;Username=postgres";
        var options = new DbContextOptionsBuilder<SmartFarmDbContext>()
            .UseNpgsql(connStr, opts =>
            {
                opts.UseNetTopologySuite();
                opts.UseVector();
            })
            .Options;
        return new SmartFarmDbContext(options);
    }

    [Fact(Skip = "Integration test: requires live Postgres database")]
    public async Task Audit_database_data_integrity_and_report_all_gaps()
    {
        using var db = CreateLiveContext();
        var canConnect = await db.Database.CanConnectAsync();
        if (!canConnect)
        {
            output.WriteLine("[WARN] Cannot connect to PostgreSQL database SmartFarmDB01 on localhost:5432. Check service status.");
            return;
        }

        var sb = new StringBuilder();
        sb.AppendLine("=== BÁO CÁO KIỂM TRA LỖ HỔNG DỮ LIỆU SMARTFARM ===");
        sb.AppendLine();

        // 1. Kiểm tra Tenants & Farms
        var tenants = await db.Tenants.AsNoTracking().ToListAsync();
        var farms = await db.Farms.AsNoTracking().ToListAsync();
        sb.AppendLine($"[1] HỆ THỐNG CƠ SỞ: {tenants.Count} Tenant, {farms.Count} Trang trại.");

        // 2. Kiểm tra Fields & Zones
        var zones = await db.Zones.AsNoTracking()
            .Include(z => z.Field)
            .Include(z => z.UserAccesses)
            .ToListAsync();
        sb.AppendLine($"[2] KHU VỰC CANH TÁC: Tổng cộng {zones.Count} Zone.");
        var farmsMap = farms.ToDictionary(f => f.Id, f => f.Name);
        foreach (var z in zones)
        {
            var fName = farmsMap.TryGetValue(z.Field.FarmId, out var fn) ? fn : "Unknown";
            sb.AppendLine($"  - Zone '{z.Name}' -> Field '{z.Field.Name}' -> Farm '{fName}' (FarmId: {z.Field.FarmId})");
        }

        // 3. Kiểm tra Mùa vụ (Planting Seasons) trên từng Zone
        var activeSeasons = await db.PlantingSeasons.AsNoTracking()
            .Include(s => s.Crop)
            .Include(s => s.Variety)
            .Include(s => s.GrowthProfile)
            .Include(s => s.CurrentGrowthStage)
            .Include(s => s.AppliedRequirements)
            .Where(s => s.Status == PlantingSeasonStatus.InProgress)
            .ToListAsync();

        var zonesWithoutSeason = zones.Where(z => !activeSeasons.Any(s => s.ZoneId == z.Id)).ToList();
        if (zonesWithoutSeason.Count > 0)
        {
            sb.AppendLine($"  [LỖ HỔNG 1] CÓ {zonesWithoutSeason.Count} ZONE CHƯA CÓ VỤ MÙA HOẠT ĐỘNG (Status = InProgress):");
            foreach (var z in zonesWithoutSeason)
            {
                sb.AppendLine($"    - Zone: '{z.Name}' (ID: {z.Id}) -> AI sẽ báo thiếu 'active planting season'");
            }
        }
        else
        {
            sb.AppendLine("  [OK] 100% Zone đều có Mùa vụ đang hoạt động (InProgress).");
        }

        // 4. Kiểm tra Ngưỡng vi khí hậu vụ mùa (Applied Requirements)
        var seasonsWithoutReqs = activeSeasons.Where(s => s.AppliedRequirements.Count == 0).ToList();
        if (seasonsWithoutReqs.Count > 0)
        {
            sb.AppendLine($"  [LỖ HỔNG 2] CÓ {seasonsWithoutReqs.Count} MÙA VỤ THIẾU BẢNG CHỈ SỐ VI KHÍ HẬU (Applied Requirements):");
            foreach (var s in seasonsWithoutReqs)
            {
                sb.AppendLine($"    - Mùa vụ: '{s.Name}' (Crop: {s.Crop.Name}) -> AI sẽ không có ngưỡng so sánh VietGAP.");
            }
        }
        else
        {
            sb.AppendLine("  [OK] 100% Mùa vụ hoạt động đều có bảng ngưỡng chỉ số vi khí hậu.");
        }

        // 5. Kiểm tra Thiết bị IoT (Sensor & Actuator) theo từng Zone
        var devices = await db.Devices.AsNoTracking().ToListAsync();
        var actuators = await db.DeviceActuators.AsNoTracking().ToListAsync();
        sb.AppendLine($"[3] THIẾT BỊ IOT: {devices.Count} Device, {actuators.Count} Actuator.");

        foreach (var z in zones)
        {
            var zoneDevices = devices.Where(d => d.ZoneId == z.Id).ToList();
            var zoneActuators = actuators.Where(a => zoneDevices.Any(d => d.Id == a.DeviceId)).ToList();
            if (zoneDevices.Count == 0)
            {
                sb.AppendLine($"  [LỖ HỔNG 3] Zone '{z.Name}' KHÔNG CÓ THIẾT BỊ NÀO ĐƯỢC GÁN!");
            }
            else if (zoneActuators.Count == 0)
            {
                sb.AppendLine($"  [CẢNH BÁO] Zone '{z.Name}' có {zoneDevices.Count} cảm biến nhưng CHƯA CÓ BƠM/THIẾT BỊ ĐIỀU KHIỂN (Actuator).");
            }
        }

        // 6. Kiểm tra Dữ liệu cảm biến thời gian thực (Telemetry Readings)
        var now = DateTime.UtcNow;
        var recentCutoff = now.AddMinutes(-60); // trong 60 phút
        var allReadings = await db.TelemetryReadings.AsNoTracking().ToListAsync();
        sb.AppendLine($"[4] TELEMETRY: Tổng cộng {allReadings.Count} bản ghi đo đạc.");

        foreach (var z in zones)
        {
            var zReadings = allReadings.Where(r => r.ZoneId == z.Id).ToList();
            if (zReadings.Count == 0)
            {
                sb.AppendLine($"  [LỖ HỔNG 4] Zone '{z.Name}' HOÀN TOÀN KHÔNG CÓ DỮ LIỆU CẢM BIẾN (Telemetry trống)!");
            }
            else
            {
                var latest = zReadings.OrderByDescending(r => r.CapturedAtUtc).First();
                var paramsFound = zReadings.Select(r => r.ParameterCode.ToString()).Distinct().ToList();
                sb.AppendLine($"  - Zone '{z.Name}': {zReadings.Count} bản ghi (Gần nhất: {latest.CapturedAtUtc:HH:mm:ss dd/MM}, Thông số: {string.Join(", ", paramsFound)})");
            }
        }

        // 7. Kiểm tra Phân quyền Nông dân (User Zone Accesses)
        var farmers = await db.AppUsers.AsNoTracking().Where(u => u.Role == UserRole.Farmer).ToListAsync();
        sb.AppendLine($"[5] PHÂN QUYỀN NÔNG DÂN: {farmers.Count} tài khoản Farmer.");
        foreach (var f in farmers)
        {
            var userAccesses = await db.UserZoneAccesses.AsNoTracking().Where(a => a.AppUserId == f.Id).ToListAsync();
            sb.AppendLine($"  - Farmer '{f.FullName}' ({f.Email}): được phân quyền {userAccesses.Count} Zone.");
        }

        // 8. Kiểm tra Kho tài liệu VietGAP trong DB
        var docs = await db.AgricultureDocuments.AsNoTracking().Include(d => d.Chunks).ToListAsync();
        sb.AppendLine($"[6] KHO TRI THỨC VIETGAP: {docs.Count} Tài liệu, {docs.Sum(d => d.Chunks.Count)} Chunks.");
        foreach (var d in docs)
        {
            sb.AppendLine($"  - '{d.Title}' (Scope: {d.CropScope}, Chunks: {d.Chunks.Count})");
        }

        output.WriteLine(sb.ToString());
    }

    [Fact(Skip = "Integration test: requires live Postgres database")]
    public async Task Deep_Audit_Data_Integrity()
    {
        using var db = CreateLiveContext();
        if (!await db.Database.CanConnectAsync())
        {
            output.WriteLine("[WARN] Không thể kết nối cơ sở dữ liệu để audit chuyên sâu.");
            return;
        }

        var sb = new StringBuilder();
        sb.AppendLine("=== KẾT QUẢ KIỂM TRA CHUYÊN SÂU LỖ HỔNG & TÍNH TOÀN VẸN DỮ LIỆU ===");
        sb.AppendLine();

        // 1. Kiểm tra tài khoản & Mật khẩu
        var users = await db.AppUsers.AsNoTracking().ToListAsync();
        var usersWithoutPass = users.Where(u => string.IsNullOrWhiteSpace(u.PasswordHash)).ToList();
        var usersWithoutTenant = users.Where(u => u.TenantId == Guid.Empty).ToList();
        sb.AppendLine($"[1] TÀI KHOẢN NGƯỜI DÙNG: {users.Count} tài khoản.");
        if (usersWithoutPass.Count > 0)
            sb.AppendLine($"  - [CẢNH BÁO BẢO MẬT] Có {usersWithoutPass.Count} tài khoản không có mật khẩu (PasswordHash rỗng)!");
        else
            sb.AppendLine("  - [OK] 100% tài khoản đều có PasswordHash hợp lệ.");

        if (usersWithoutTenant.Count > 0)
            sb.AppendLine($"  - [LỖ HỔNG] Có {usersWithoutTenant.Count} tài khoản không thuộc Tenant nào.");
        else
            sb.AppendLine("  - [OK] 100% tài khoản liên kết đúng Tenant.");

        // 2. Kiểm tra Cây trồng (Crops) & Hồ sơ sinh trưởng (Growth Profiles) & Ngưỡng (Requirements)
        var crops = await db.Crops.AsNoTracking().ToListAsync();
        var profiles = await db.GrowthProfiles.AsNoTracking()
            .Include(p => p.Stages)
                .ThenInclude(s => s.Requirements)
            .ToListAsync();

        sb.AppendLine($"\n[2] HỒ SƠ CÂY TRỒNG & TIÊU CHUẨN VI KHÍ HẬU: {crops.Count} loại cây.");
        foreach (var c in crops)
        {
            var cropProfiles = profiles.Where(p => p.CropId == c.Id).ToList();
            if (cropProfiles.Count == 0)
            {
                sb.AppendLine($"  - [LỖ HỔNG CÂY TRỒNG] Cây '{c.Name}' (ID: {c.Id}) CHƯA CÓ Hồ sơ sinh trưởng (GrowthProfile)!");
            }
            else
            {
                var stagesCount = cropProfiles.Sum(p => p.Stages.Count);
                var reqsCount = cropProfiles.SelectMany(p => p.Stages).Sum(s => s.Requirements.Count);
                sb.AppendLine($"  - Cây '{c.Name}' ({c.ScientificName}): {cropProfiles.Count} hồ sơ, {stagesCount} giai đoạn sinh trưởng, {reqsCount} ngưỡng vi khí hậu.");
                if (stagesCount == 0)
                    sb.AppendLine($"    -> [CẢNH BÁO] Cây '{c.Name}' thiếu các giai đoạn sinh trưởng (Stages).");
                if (reqsCount == 0)
                    sb.AppendLine($"    -> [CẢNH BÁO] Cây '{c.Name}' thiếu bảng ngưỡng môi trường chuẩn.");
            }
        }

        // 3. Kiểm tra Dữ liệu cảm biến dị thường (Physics & Outliers)
        var readings = await db.TelemetryReadings.AsNoTracking().ToListAsync();
        sb.AppendLine($"\n[3] KIỂM TRA CHỈ SỐ CẢM BIẾN DỊ THƯỜNG / NGOẠI LAI (Outliers): {readings.Count} bản ghi.");
        var invalidReadings = new List<string>();
        foreach (var r in readings)
        {
            switch (r.ParameterCode)
            {
                case EnvironmentalParameterCode.SoilMoisture:
                case EnvironmentalParameterCode.AirHumidity:
                    if (r.Value < 0 || r.Value > 100)
                        invalidReadings.Add($"ID {r.Id}: {r.ParameterCode} = {r.Value}% (Vượt dải 0-100%)");
                    break;
                case EnvironmentalParameterCode.Temperature:
                    if (r.Value < -10 || r.Value > 60)
                        invalidReadings.Add($"ID {r.Id}: Nhiệt độ = {r.Value}°C (Bất thường ngoài dải -10 đến 60)");
                    break;
                case EnvironmentalParameterCode.Ph:
                    if (r.Value < 0 || r.Value > 14)
                        invalidReadings.Add($"ID {r.Id}: pH = {r.Value} (Vượt thang pH 0-14)");
                    break;
                case EnvironmentalParameterCode.Ec:
                    if (r.Value < 0 || r.Value > 20)
                        invalidReadings.Add($"ID {r.Id}: EC = {r.Value} mS/cm (Bất thường ngoài dải 0-20)");
                    break;
            }
        }
        if (invalidReadings.Count > 0)
        {
            sb.AppendLine($"  - [LỖ HỔNG DỮ LIỆU CẢM BIẾN] Phát hiện {invalidReadings.Count} bản ghi có giá trị bất thường:");
            foreach (var inv in invalidReadings.Take(10))
                sb.AppendLine($"    * {inv}");
            if (invalidReadings.Count > 10)
                sb.AppendLine($"    * ... và {invalidReadings.Count - 10} bản ghi khác.");
        }
        else
        {
            sb.AppendLine("  - [OK] 100% bản ghi cảm biến nằm trong ngưỡng vật lý hợp lệ (Độ ẩm 0-100%, Nhiệt độ -10..60, pH 0..14, EC 0..20).");
        }

        // 4. Kiểm tra Thiết bị điều khiển (Actuators) & Lịch tưới / Tự động hóa (Schedules / Rules)
        var actuators = await db.DeviceActuators.AsNoTracking().ToListAsync();
        var schedules = await db.ControlSchedules.AsNoTracking().ToListAsync();
        var autoRules = await db.AutoControlRules.AsNoTracking().ToListAsync();
        var alertRules = await db.AlertRules.AsNoTracking().ToListAsync();
        sb.AppendLine($"\n[4] TỰ ĐỘNG HÓA & CẢNH BÁO: {actuators.Count} Actuator, {schedules.Count} Lịch tưới, {autoRules.Count} Luật tự động, {alertRules.Count} Luật cảnh báo.");

        var orphanSchedules = schedules.Where(s => !actuators.Any(a => a.Id == s.ActuatorId)).ToList();
        if (orphanSchedules.Count > 0)
        {
            sb.AppendLine($"  - [LỖ HỔNG LỊCH TƯỚI MỒ CÔI] Có {orphanSchedules.Count} lịch tưới trỏ đến Actuator không tồn tại:");
            foreach (var os in orphanSchedules)
                sb.AppendLine($"    * Lịch '{os.Name}' (ActuatorId: {os.ActuatorId})");
        }
        else
        {
            sb.AppendLine("  - [OK] 100% lịch tưới đều liên kết tới Actuator hợp lệ.");
        }

        var orphanAutoRules = autoRules.Where(r => !actuators.Any(a => a.Id == r.ActuatorId)).ToList();
        if (orphanAutoRules.Count > 0)
        {
            sb.AppendLine($"  - [LỖ HỔNG LUẬT TỰ ĐỘNG MỒ CÔI] Có {orphanAutoRules.Count} luật tự động trỏ đến Actuator không tồn tại:");
            foreach (var ar in orphanAutoRules)
                sb.AppendLine($"    * Luật '{ar.Name}' (ActuatorId: {ar.ActuatorId})");
        }
        else
        {
            sb.AppendLine("  - [OK] 100% luật tự động đều liên kết tới Actuator hợp lệ.");
        }

        // 5. Kiểm tra Bản ghi mồ côi (Orphan records)
        var devices = await db.Devices.AsNoTracking().ToListAsync();
        var zones = await db.Zones.AsNoTracking().ToListAsync();
        var orphanDevices = devices.Where(d => d.ZoneId.HasValue && !zones.Any(z => z.Id == d.ZoneId.Value)).ToList();
        if (orphanDevices.Count > 0)
        {
            sb.AppendLine($"  - [LỖ HỔNG THIẾT BỊ MỒ CÔI] Có {orphanDevices.Count} thiết bị trỏ đến Zone không tồn tại!");
        }
        else
        {
            sb.AppendLine("  - [OK] 100% thiết bị có ZoneId đều trỏ đến Zone hợp lệ.");
        }

        var orphanReadings = readings.Where(r => !devices.Any(d => d.Id == r.DeviceId)).ToList();
        if (orphanReadings.Count > 0)
        {
            sb.AppendLine($"  - [LỖ HỔNG TELEMETRY MỒ CÔI] Có {orphanReadings.Count} telemetry trỏ đến Device không tồn tại!");
        }
        else
        {
            sb.AppendLine("  - [OK] 100% bản ghi telemetry đều liên kết thiết bị cảm biến hợp lệ.");
        }

        // 6. Kiểm tra Cô lập Đa người thuê (Tenant Isolation)
        var fields = await db.Fields.AsNoTracking().ToListAsync();
        var farms = await db.Farms.AsNoTracking().ToListAsync();
        var tenantIds = (await db.Tenants.AsNoTracking().Select(t => t.Id).ToListAsync()).ToHashSet();
        var orphanFarms = farms.Where(f => !tenantIds.Contains(f.TenantId)).ToList();
        if (orphanFarms.Count > 0)
            sb.AppendLine($"  - [LỖ HỔNG TENANT] Có {orphanFarms.Count} trang trại trỏ đến Tenant không tồn tại.");
        else
            sb.AppendLine("  - [OK] 100% Trang trại và Khu vực phân bổ chuẩn xác theo Tenant.");

        output.WriteLine(sb.ToString());
    }
}
