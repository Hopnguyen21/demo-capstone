using Microsoft.EntityFrameworkCore;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;

namespace SmartFarm.Api.HostedServices;

/// <summary>
/// Generates synthetic sensor telemetry for local development demonstrations only.
/// This worker is disabled outside the Development host environment and requires
/// SimulatedIot:Enabled=true. Generated readings are not measurements from hardware.
/// </summary>
public sealed class SimulatedIotTelemetryWorker(
    IServiceScopeFactory scopes,
    IConfiguration configuration,
    IHostEnvironment hostEnvironment,
    ILogger<SimulatedIotTelemetryWorker> logger) : BackgroundService
{
    private static readonly Random Rnd = new();
    private static int _cycleCount = 0;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!hostEnvironment.IsDevelopment())
        {
            logger.LogInformation("Simulated IoT Telemetry Worker is disabled outside Development.");
            return;
        }

        var isEnabled = configuration.GetValue<bool>("SimulatedIot:Enabled", false);
        if (!isEnabled)
        {
            logger.LogInformation("Simulated IoT Telemetry Worker is disabled via configuration (SimulatedIot:Enabled = false).");
            return;
        }

        var intervalSeconds = configuration.GetValue<int>("SimulatedIot:IntervalSeconds", 90);
        if (intervalSeconds < 10) intervalSeconds = 10;

        logger.LogInformation("Simulated IoT Telemetry Worker started (Interval: {Interval} seconds).", intervalSeconds);

        // Chờ 5 giây ban đầu sau khi app khởi động để database migration hoàn tất
        try
        {
            await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            return;
        }

        // Định kỳ sinh dữ liệu ngẫu nhiên theo cấu hình
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(intervalSeconds));

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await GenerateRandomTelemetryAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error occurred during IoT simulation telemetry cycle.");
            }

            try
            {
                if (!await timer.WaitForNextTickAsync(stoppingToken))
                    break;
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
        }

        logger.LogInformation("Simulated IoT Telemetry Worker stopped.");
    }

    private async Task GenerateRandomTelemetryAsync(CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        var now = DateTime.UtcNow;
        var readingsToAdd = new List<TelemetryReading>();

        // Tìm tất cả các Zone đang có trong hệ thống kèm thông tin Farm
        var zones = await db.Zones
            .AsNoTracking()
            .Include(z => z.Field)
            .ThenInclude(f => f.Farm)
            .Where(z => z.ArchivedAtUtc == null)
            .ToListAsync(ct);

        if (zones.Count == 0)
        {
            // Nếu chưa có zone nào, bỏ qua chu kỳ này
            return;
        }

        _cycleCount++;
        var faultSimulationConfig = configuration.GetValue<bool>("SimulatedIot:EnableFaultSimulation", false);
        // Cứ mỗi 5 chu kỳ nếu bật EnableFaultSimulation thì mới giả lập sự cố
        var isFaultCycle = faultSimulationConfig && ((_cycleCount % 5 == 0) || (_cycleCount % 5 == 1 && _cycleCount > 1));

        if (isFaultCycle)
        {
            logger.LogWarning(">>> [FAULT SIMULATION] Cycle {Cycle}: Simulating sensor hardware faults and threshold breaches for alert testing.", _cycleCount);
        }

        foreach (var zone in zones)
        {
            var farm = zone.Field?.Farm;
            if (farm == null) continue;

            // Tìm thiết bị hợp lệ trong Zone
            var device = await db.Devices
                .FirstOrDefaultAsync(d => d.ZoneId == zone.Id && d.FarmId == farm.Id && d.Status != DeviceStatus.Decommissioned, ct);

            // Chỉ dùng gateway của đúng farm; không gán chéo thiết bị giữa các farm/tenant.
            var gateway = await db.Gateways.FirstOrDefaultAsync(g => g.FarmId == farm.Id, ct);

            // Nếu Zone chưa có device, kiểm tra xem farm có device sensor nào sẵn có để gán vào zone hoặc tạo mới
            if (device == null && gateway != null)
            {
                // Kiểm tra xem farm có device unassigned nào không
                device = await db.Devices.FirstOrDefaultAsync(d => d.FarmId == farm.Id && d.ZoneId == null && d.Status != DeviceStatus.Decommissioned, ct);
                if (device != null)
                {
                    device.ZoneId = zone.Id;
                    device.Status = DeviceStatus.Online;
                    await db.SaveChangesAsync(ct);
                }
                else
                {
                    // Tạo một virtual IoT device gắn vào zone
                    var simHw = $"SIM-NODE-{zone.Id.ToString()[..8].ToUpperInvariant()}";
                    var existingDev = await db.Devices.FirstOrDefaultAsync(d => d.HardwareAddress == simHw, ct);
                    if (existingDev != null)
                    {
                        device = existingDev;
                    }
                    else
                    {
                        device = new Device
                        {
                            Id = Guid.NewGuid(),
                            FarmId = farm.Id,
                            GatewayId = gateway.Id,
                            DeploymentRequestId = gateway.DeploymentRequestId,
                            ZoneId = zone.Id,
                            HardwareAddress = simHw,
                            DeviceType = DeviceType.SensorNode,
                            Status = DeviceStatus.Online,
                            InstallationNotes = "Auto-provisioned virtual IoT telemetry simulator node.",
                            CreatedAtUtc = now
                        };
                        db.Devices.Add(device);
                        try
                        {
                            await db.SaveChangesAsync(ct);
                        }
                        catch (DbUpdateException)
                        {
                            db.Entry(device).State = EntityState.Detached;
                            device = await db.Devices.FirstOrDefaultAsync(d => d.ZoneId == zone.Id, ct);
                        }
                    }
                }
            }
            else if (device == null && gateway == null)
            {
                // Tìm bất kỳ deployment request nào của farm hoặc zone
                var deployReq = await db.DeploymentRequests.FirstOrDefaultAsync(dr => dr.FarmId == farm.Id, ct);
                if (deployReq != null)
                {
                    var gwId = Guid.NewGuid();
                    var devId = Guid.NewGuid();
                    gateway = new Gateway
                    {
                        Id = gwId,
                        FarmId = farm.Id,
                        DeploymentRequestId = deployReq.Id,
                        MacAddress = $"SIM-GW-{gwId.ToString()[..8].ToUpperInvariant()}",
                        GatewaySerial = $"SIM-GW-SN-{gwId.ToString()[..8].ToUpperInvariant()}",
                        FrequencyBand = "AS923",
                        FirmwareVersion = "v2.0.0-sim",
                        MqttClientId = $"sim-gw-{gwId:N}",
                        ClientCertificateFingerprint = new string('F', 64),
                        Status = GatewayStatus.Online,
                        LastSeenAtUtc = now,
                        CreatedAtUtc = now
                    };
                    device = new Device
                    {
                        Id = devId,
                        FarmId = farm.Id,
                        GatewayId = gwId,
                        DeploymentRequestId = deployReq.Id,
                        ZoneId = zone.Id,
                        HardwareAddress = $"SIM-NODE-{zone.Id.ToString()[..8].ToUpperInvariant()}",
                        DeviceType = DeviceType.SensorNode,
                        Status = DeviceStatus.Online,
                        InstallationNotes = "Auto-provisioned virtual IoT telemetry simulator node.",
                        CreatedAtUtc = now
                    };
                    db.Gateways.Add(gateway);
                    db.Devices.Add(device);
                    await db.SaveChangesAsync(ct);
                }
            }

            if (device == null || gateway == null)
            {
                // Không thể tìm hoặc tạo thiết bị hợp lệ cho zone này mà không vi phạm FK
                continue;
            }

            var deviceId = device.Id;
            var gatewayId = gateway.Id;

            // Nếu đang trong chu kỳ sự cố (Fault cycle):
            // 1. Giả lập lỗi phần cứng cảm biến (Device Status -> MaintenanceRequired)
            // 2. Tạo giá trị vi phạm ngưỡng môi trường (độ ẩm đất < 35%, nhiệt độ > 42°C, pH < 4.5)
            // Khi hết chu kỳ lỗi, khôi phục trạng thái thiết bị về Online
            if (isFaultCycle)
            {
                if (device.Status != DeviceStatus.MaintenanceRequired)
                {
                    device.Status = DeviceStatus.MaintenanceRequired;
                    await db.SaveChangesAsync(ct);

                    // Gửi thông báo sự cố thiết bị đến Chủ nông trại (Owner) và Nông dân (Farmer phụ trách)
                    try
                    {
                        var notifSvc = scope.ServiceProvider.GetRequiredService<INotificationService>();
                        var recipients = await db.AppUsers.AsNoTracking()
                            .Where(u => u.TenantId == farm.TenantId && (
                                u.Role == UserRole.FarmOwner ||
                                (u.Role == UserRole.Farmer && u.ZoneAccesses.Any(za => za.ZoneId == zone.Id))
                            ))
                            .Select(u => new { u.Id, u.Role })
                            .ToListAsync(ct);

                        foreach (var target in recipients)
                        {
                            var targetUrl = target.Role == UserRole.Farmer ? "/farmer/alerts" : "/owner/alerts";
                            await notifSvc.CreateNotificationAsync(new(
                                UserId: target.Id,
                                TenantId: farm.TenantId,
                                Title: $"[SỰ CỐ THIẾT BỊ] Cảm biến tại {zone.Name} gặp trục trặc",
                                Message: $"Node cảm biến ({device.HardwareAddress}) tại {zone.Name} gửi tín hiệu bất thường liên tiếp. Trạng thái chuyển sang Cần bảo trì (Maintenance Required).",
                                Type: NotificationType.Alert,
                                Severity: AlertSeverity.Critical,
                                TargetUrl: targetUrl,
                                ReferenceId: device.Id.ToString()
                            ), ct);
                        }
                        logger.LogWarning("Dispatched Device Fault alert for node {Dev} in zone {Zone}.", device.HardwareAddress, zone.Name);
                    }
                    catch (Exception exNotif)
                    {
                        logger.LogError(exNotif, "Failed to send device fault notification.");
                    }
                }
            }
            else
            {
                if (device.Status == DeviceStatus.MaintenanceRequired)
                {
                    device.Status = DeviceStatus.Online;
                    await db.SaveChangesAsync(ct);
                }
            }

            decimal temp, soilMoisture, airHumidity, light, ph, ec;

            if (isFaultCycle)
            {
                temp = Math.Round((decimal)(38.0 + Rnd.NextDouble() * 6.5), 1);          // Nhiệt độ quá cao (38 - 44.5 °C)
                soilMoisture = Math.Round((decimal)(20.0 + Rnd.NextDouble() * 14.0), 1);   // Độ ẩm đất tụt khô cằn (20 - 34 %)
                airHumidity = Math.Round((decimal)(35.0 + Rnd.NextDouble() * 12.0), 1);    // Độ ẩm không khí khô khốc (35 - 47 %)
                light = Math.Round((decimal)(55000 + Rnd.Next(0, 20000)), 0);             // Ánh sáng gắt (> 55,000 Lux)
                ph = Math.Round((decimal)(4.0 + Rnd.NextDouble() * 0.8), 2);              // Đất bị chua / axit hóa (4.0 - 4.8 pH)
                ec = Math.Round((decimal)(3.2 + Rnd.NextDouble() * 1.0), 2);              // Độc tố phân bón / cháy rễ (3.2 - 4.2 mS/cm)
            }
            else
            {
                // Dải sinh học tối ưu bình thường
                temp = Math.Round((decimal)(24.0 + Rnd.NextDouble() * 7.0), 1);           // 24 - 31 °C
                soilMoisture = Math.Round((decimal)(62.0 + Rnd.NextDouble() * 12.0), 1);   // 62 - 74 %
                airHumidity = Math.Round((decimal)(68.0 + Rnd.NextDouble() * 14.0), 1);    // 68 - 82 %
                light = Math.Round((decimal)(18000 + Rnd.Next(0, 15000)), 0);             // 18,000 - 33,000 Lux
                ph = Math.Round((decimal)(6.0 + Rnd.NextDouble() * 0.5), 2);              // 6.0 - 6.5 pH
                ec = Math.Round((decimal)(1.8 + Rnd.NextDouble() * 0.4), 2);              // 1.8 - 2.2 mS/cm
            }

            var sensorDevices = await db.Devices
                .Include(d => d.Sensors)
                .Where(d => d.ZoneId == zone.Id && d.DeviceType == DeviceType.SensorNode && d.Status != DeviceStatus.Decommissioned)
                .OrderBy(d => d.HardwareAddress)
                .ToListAsync(ct);

            if (sensorDevices.Count == 0 && device != null)
            {
                sensorDevices.Add(device);
            }

            // Đồng bộ cấu hình cảm biến thực tế trong DB cho từng trạm đo (DeviceSensor)
            foreach (var devItem in sensorDevices)
            {
                await EnsureDeviceSensorsAsync(db, devItem, zone, now, ct);
            }

            for (var devIdx = 0; devIdx < sensorDevices.Count; devIdx++)
            {
                var curDev = sensorDevices[devIdx];
                var curDevId = curDev.Id;
                var curTemp = temp;
                var curSoil = soilMoisture;
                var curHum = airHumidity;
                var curLight = light;
                var curPh = ph;
                var curEc = ec;

                // Nếu là node thứ 2 trở lên trong cùng luống, mô phỏng chênh lệch vi khí hậu thực tế giữa đầu luống & cuối luống
                if (devIdx > 0)
                {
                    curTemp = Math.Round(temp + 0.8m, 1);
                    curSoil = Math.Round(Math.Max(35m, soilMoisture - 8.2m), 1); // Cuối luống khô hơn do áp lực nước tưới nhỏ giọt giảm
                    curHum = Math.Round(Math.Max(40m, airHumidity - 3.2m), 1);
                    curLight = Math.Round(light + 1150m, 0);
                    curEc = Math.Round(ec + 0.12m, 2);
                }

                var messageId = $"sim-{now.Ticks}-{Rnd.Next(1000, 9999)}-n{devIdx}";
                var configuredParams = GetConfiguredParametersForDevice(curDev, zone);

                foreach (var param in configuredParams)
                {
                    decimal val;
                    string unit;
                    string codeKey;
                    switch (param)
                    {
                        case EnvironmentalParameterCode.Temperature:
                            val = curTemp; unit = "°C"; codeKey = "temp"; break;
                        case EnvironmentalParameterCode.SoilMoisture:
                            val = curSoil; unit = "%"; codeKey = "soil"; break;
                        case EnvironmentalParameterCode.AirHumidity:
                            val = curHum; unit = "%"; codeKey = "hum"; break;
                        case EnvironmentalParameterCode.LightIntensity:
                            val = curLight; unit = "Lux"; codeKey = "light"; break;
                        case EnvironmentalParameterCode.Ph:
                            val = curPh; unit = "pH"; codeKey = "ph"; break;
                        case EnvironmentalParameterCode.Ec:
                            val = curEc; unit = "mS/cm"; codeKey = "ec"; break;
                        default:
                            continue;
                    }

                    readingsToAdd.Add(new TelemetryReading
                    {
                        TenantId = farm.TenantId,
                        FarmId = farm.Id,
                        ZoneId = zone.Id,
                        DeviceId = curDevId,
                        GatewayId = gatewayId,
                        MessageId = $"{messageId}-{codeKey}",
                        ParameterCode = param,
                        Value = val,
                        Unit = unit,
                        CapturedAtUtc = now,
                        ReceivedAtUtc = now
                    });
                }
            }
        }

        if (readingsToAdd.Count > 0)
        {
            await db.TelemetryReadings.AddRangeAsync(readingsToAdd, ct);
            // Gateway gửi số đo thì được ghi nhận là đang hoạt động.
            var sendingGatewayIds = readingsToAdd.Select(r => r.GatewayId).Distinct().ToList();
            foreach (var gateway in await db.Gateways.Where(g => sendingGatewayIds.Contains(g.Id)).ToListAsync(ct))
            {
                gateway.LastSeenAtUtc = now;
                gateway.Status = GatewayStatus.Online;
            }
            await db.SaveChangesAsync(ct);
            logger.LogInformation("Generated {Count} simulated IoT telemetry readings across {Zones} zones.", readingsToAdd.Count, zones.Count);

        // ══════════════════════════════════════════════════════════════════════════════
        // ĐÁNH GIÁ CẢNH BÁO MÔI TRƯỜNG & THÔNG BÁO CHO OWNER & FARMER
        // ══════════════════════════════════════════════════════════════════════════════
        try
        {
            var notifService = scope.ServiceProvider.GetRequiredService<INotificationService>();

            foreach (var zone in zones)
            {
                var farm = zone.Field?.Farm;
                if (farm == null) continue;

                var currentSeason = await db.PlantingSeasons
                    .Include(s => s.AppliedRequirements)
                    .FirstOrDefaultAsync(ps => ps.ZoneId == zone.Id && ps.Status == PlantingSeasonStatus.InProgress, ct);

                // Lấy các luật cảnh báo riêng của Zone hoặc fallback vào AppliedRequirements của vụ mùa
                var zoneRules = await db.AlertRules
                    .Where(r => r.ZoneId == zone.Id && r.IsActive && r.ArchivedAtUtc == null)
                    .ToListAsync(ct);

                // Các thông số cần kiểm tra
                var checkConfigs = new List<(EnvironmentalParameterCode Param, decimal Min, decimal Max, AlertSeverity Sev, string Label)>
                {
                    (EnvironmentalParameterCode.SoilMoisture, 55m, 75m, AlertSeverity.Warning, "Độ ẩm đất"),
                    (EnvironmentalParameterCode.Temperature, 18m, 32m, AlertSeverity.Critical, "Nhiệt độ không khí"),
                    (EnvironmentalParameterCode.AirHumidity, 60m, 85m, AlertSeverity.Warning, "Độ ẩm không khí"),
                    (EnvironmentalParameterCode.Ph, 5.5m, 7.0m, AlertSeverity.Warning, "Độ pH"),
                    (EnvironmentalParameterCode.LightIntensity, 5000m, 50000m, AlertSeverity.Warning, "Ánh sáng quang hợp")
                };

                foreach (var cfg in checkConfigs)
                {
                    decimal min = cfg.Min;
                    decimal max = cfg.Max;
                    var sev = cfg.Sev;

                    // Nếu có AlertRule do người dùng cấu hình riêng, ưu tiên sử dụng
                    var customRule = zoneRules.FirstOrDefault(r => r.ParameterCode == cfg.Param);
                    if (customRule != null)
                    {
                        min = customRule.MinThreshold;
                        max = customRule.MaxThreshold;
                        sev = customRule.Severity;
                    }
                    else if (currentSeason != null)
                    {
                        var seasonReq = currentSeason.AppliedRequirements.FirstOrDefault(r => r.ParameterCode == cfg.Param);
                        if (seasonReq != null)
                        {
                            min = seasonReq.MinValue;
                            max = seasonReq.MaxValue;
                        }
                    }

                    var reading = readingsToAdd
                        .Where(r => r.ZoneId == zone.Id && r.ParameterCode == cfg.Param)
                        .OrderByDescending(r => r.CapturedAtUtc)
                        .FirstOrDefault();

                    if (reading == null) continue;

                    var isViolating = reading.Value < min || reading.Value > max;
                    if (!isViolating)
                    {
                        // Nếu chỉ số đã về bình thường, tự động Resolve các cảnh báo cũ đang mở
                        var openAlerts = await db.Alerts
                            .Where(a => a.ZoneId == zone.Id && a.ParameterCode == cfg.Param && a.Status != AlertStatus.Resolved)
                            .ToListAsync(ct);
                        foreach (var oa in openAlerts)
                        {
                            oa.Status = AlertStatus.Resolved;
                            oa.ResolvedAtUtc = now;
                            oa.History.Add(new AlertHistoryEvent
                            {
                                Id = Guid.NewGuid(),
                                AlertId = oa.Id,
                                EventType = AlertEventType.Resolved,
                                Notes = $"Chỉ số {cfg.Label} đã trở về dải an toàn ({reading.Value}{reading.Unit}).",
                                CreatedAtUtc = now
                            });
                        }
                        if (openAlerts.Count > 0)
                        {
                            try { await db.SaveChangesAsync(ct); }
                            catch (DbUpdateConcurrencyException)
                            {
                                foreach (var oa in openAlerts)
                                {
                                    db.Entry(oa).State = EntityState.Detached;
                                }
                            }
                        }
                        continue;
                    }

                    // Kiểm tra xem đã có cảnh báo đang mở trong vòng 10 phút gần nhất không (để tránh spam)
                    var recentAlert = await db.Alerts
                        .Where(a => a.ZoneId == zone.Id && a.ParameterCode == cfg.Param && a.Status != AlertStatus.Resolved)
                        .OrderByDescending(a => a.CreatedAtUtc)
                        .FirstOrDefaultAsync(ct);

                    if (recentAlert != null)
                    {
                        // Đã có cảnh báo đang mở (Open hoặc Acknowledged) cho thông số này -> không tạo thêm cảnh báo mới để tránh spam chuông
                        continue;
                    }

                    // Xác định mùa vụ và giai đoạn sinh trưởng hợp lệ trước khi tạo cảnh báo
                    var effectiveSeason = currentSeason;
                    if (effectiveSeason == null || effectiveSeason.CurrentGrowthStageId == Guid.Empty)
                    {
                        effectiveSeason = await db.PlantingSeasons.FirstOrDefaultAsync(s => s.ZoneId == zone.Id && s.CurrentGrowthStageId != Guid.Empty, ct);
                    }
                    if (effectiveSeason == null || effectiveSeason.CurrentGrowthStageId == Guid.Empty)
                    {
                        // Zone chưa có mùa vụ hoặc giai đoạn sinh trưởng để liên kết khóa ngoại
                        continue;
                    }

                    var effectiveGrowthStageId = customRule?.GrowthStageId ?? effectiveSeason.CurrentGrowthStageId;
                    if (effectiveGrowthStageId == Guid.Empty)
                    {
                        continue;
                    }

                    // Tìm 1 alert rule có sẵn trong DB hoặc tạo alert rule đại diện hợp lệ
                    Guid ruleId;
                    if (customRule != null)
                    {
                        ruleId = customRule.Id;
                    }
                    else
                    {
                        var defaultRule = await db.AlertRules.FirstOrDefaultAsync(r => r.ZoneId == zone.Id && r.GrowthStageId == effectiveGrowthStageId, ct);
                        if (defaultRule != null)
                        {
                            ruleId = defaultRule.Id;
                        }
                        else
                        {
                            var newRule = new AlertRule
                            {
                                Id = Guid.NewGuid(),
                                ZoneId = zone.Id,
                                GrowthStageId = effectiveGrowthStageId,
                                ParameterCode = cfg.Param,
                                MinThreshold = min,
                                MaxThreshold = max,
                                Severity = sev,
                                CooldownMinutes = 15,
                                IsActive = true,
                                CreatedAtUtc = now
                            };
                            db.AlertRules.Add(newRule);
                            ruleId = newRule.Id;
                        }
                    }

                    // Tạo bản ghi Cảnh báo Alert mới với đầy đủ FK hợp lệ
                    var alert = new Alert
                    {
                        Id = Guid.NewGuid(),
                        TenantId = farm.TenantId,
                        FarmId = farm.Id,
                        ZoneId = zone.Id,
                        DeviceId = reading.DeviceId,
                        AlertRuleId = ruleId,
                        PlantingSeasonId = effectiveSeason.Id,
                        GrowthStageId = effectiveGrowthStageId,
                        ParameterCode = cfg.Param,
                        ObservedValue = reading.Value,
                        MinThreshold = min,
                        MaxThreshold = max,
                        Unit = reading.Unit,
                        Severity = sev,
                        Status = AlertStatus.Open,
                        Title = $"Cảnh báo {cfg.Label} vượt ngưỡng ({zone.Name})",
                        CreatedAtUtc = now
                    };
                    alert.History.Add(new AlertHistoryEvent
                    {
                        Id = Guid.NewGuid(),
                        AlertId = alert.Id,
                        EventType = AlertEventType.Created,
                        Notes = $"Tự động phát hiện vi phạm: {reading.Value}{reading.Unit} ngoài phạm vi [{min} - {max}{reading.Unit}]",
                        CreatedAtUtc = now
                    });

                    if (alert.PlantingSeasonId != Guid.Empty && alert.GrowthStageId != Guid.Empty)
                    {
                        try
                        {
                            db.Alerts.Add(alert);
                            await db.SaveChangesAsync(ct);
                        }
                        catch (DbUpdateConcurrencyException)
                        {
                            db.Entry(alert).State = EntityState.Detached;
                            continue;
                        }

                        // Gửi Notification cho cả Owner và Farmer phụ trách (chỉ sau khi lưu alert thành công)
                        var targets = await db.AppUsers.AsNoTracking()
                            .Where(u => u.TenantId == farm.TenantId && (
                                u.Role == UserRole.FarmOwner ||
                                (u.Role == UserRole.Farmer && u.ZoneAccesses.Any(za => za.ZoneId == zone.Id))
                            ))
                            .Select(u => new { u.Id, u.Role })
                            .ToListAsync(ct);

                        foreach (var target in targets)
                        {
                            var targetUrl = target.Role == UserRole.Farmer ? "/farmer/alerts" : "/owner/alerts";
                            await notifService.CreateNotificationAsync(new(
                                UserId: target.Id,
                                TenantId: farm.TenantId,
                                Title: $"[CẢNH BÁO MÔI TRƯỜNG] {cfg.Label} bất thường tại {zone.Name}",
                                Message: $"{cfg.Label} ghi nhận mức {reading.Value}{reading.Unit} (vượt ngưỡng cho phép {min} - {max}{reading.Unit}). Vui lòng kiểm tra hệ thống điều hòa & tưới tiêu.",
                                Type: NotificationType.Alert,
                                Severity: sev,
                                TargetUrl: targetUrl,
                                ReferenceId: alert.Id.ToString()
                            ), ct);
                        }

                        logger.LogWarning("Dispatched Environmental Alert: {Label} in {Zone} ({Val}{Unit}) to {Count} users.", cfg.Label, zone.Name, reading.Value, reading.Unit, targets.Count);
                    }

                }
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to evaluate environmental alert rules or dispatch notifications.");
        }
        }
    }

    private static List<EnvironmentalParameterCode> GetConfiguredParametersForDevice(Device dev, Zone zone)
    {
        // 1. Nếu thiết bị đã có cấu hình trong DB (dev.Sensors), dùng trực tiếp
        if (dev.Sensors != null && dev.Sensors.Count > 0)
        {
            var result = new List<EnvironmentalParameterCode>();
            foreach (var s in dev.Sensors)
            {
                if (Enum.TryParse<EnvironmentalParameterCode>(s.SensorType, true, out var p))
                    result.Add(p);
            }
            if (result.Count > 0) return result;
        }

        // 2. Dựa theo tên Zone hoặc HardwareAddress để phân bổ thực tế khác nhau:
        var zoneName = (zone.Name ?? string.Empty).ToLowerInvariant();
        var devName = (dev.HardwareAddress ?? string.Empty).ToLowerInvariant();

        // Zone Xà lách cuộn (Luong 01): 3 cảm biến cơ bản ngoài đồng đất (Nhiệt độ, Ẩm không khí, Ẩm đất)
        if (zoneName.Contains("xa lach") || zoneName.Contains("xà lách"))
        {
            return new List<EnvironmentalParameterCode>
            {
                EnvironmentalParameterCode.Temperature,
                EnvironmentalParameterCode.AirHumidity,
                EnvironmentalParameterCode.SoilMoisture
            };
        }

        // Zone Dâu tây (Luong 02): 4 cảm biến (Nhiệt độ, Ẩm không khí, Ẩm đất, Ánh sáng)
        if (zoneName.Contains("dau tay") || zoneName.Contains("dâu tây") || devName.Contains("strawberry"))
        {
            return new List<EnvironmentalParameterCode>
            {
                EnvironmentalParameterCode.Temperature,
                EnvironmentalParameterCode.AirHumidity,
                EnvironmentalParameterCode.SoilMoisture,
                EnvironmentalParameterCode.LightIntensity
            };
        }

        // Zone Cà chua chuông (Luong 03): 5 cảm biến (+ Dinh dưỡng EC)
        if (zoneName.Contains("ca chua chuong") || zoneName.Contains("cà chua chuông") || devName.Contains("bellpepper"))
        {
            return new List<EnvironmentalParameterCode>
            {
                EnvironmentalParameterCode.Temperature,
                EnvironmentalParameterCode.AirHumidity,
                EnvironmentalParameterCode.SoilMoisture,
                EnvironmentalParameterCode.LightIntensity,
                EnvironmentalParameterCode.Ec
            };
        }

        // Node 2 cuối luống của Líp 00 (Dưa leo màu): trạm đo chuyên sâu độ ẩm và dinh dưỡng đất (3 cảm biến)
        if (devName.Contains("demo-002"))
        {
            return new List<EnvironmentalParameterCode>
            {
                EnvironmentalParameterCode.Temperature,
                EnvironmentalParameterCode.SoilMoisture,
                EnvironmentalParameterCode.Ec
            };
        }

        // Mặc định hoặc Zone Nhà màng Z01 / Dưa leo trạm chính: đầy đủ 6 thông số
        return new List<EnvironmentalParameterCode>
        {
            EnvironmentalParameterCode.Temperature,
            EnvironmentalParameterCode.SoilMoisture,
            EnvironmentalParameterCode.AirHumidity,
            EnvironmentalParameterCode.LightIntensity,
            EnvironmentalParameterCode.Ph,
            EnvironmentalParameterCode.Ec
        };
    }

    private static async Task EnsureDeviceSensorsAsync(SmartFarmDbContext db, Device dev, Zone zone, DateTime now, CancellationToken ct)
    {
        var configuredParams = GetConfiguredParametersForDevice(dev, zone);
        var existingSensors = await db.DeviceSensors.Where(s => s.DeviceId == dev.Id).ToListAsync(ct);
        var existingTypes = existingSensors.Select(s => s.SensorType).ToHashSet(StringComparer.OrdinalIgnoreCase);

        // Xóa những cảm biến cũ không thuộc cấu hình thực tế của Zone
        var invalidSensors = existingSensors.Where(s => !configuredParams.Any(p => string.Equals(p.ToString(), s.SensorType, StringComparison.OrdinalIgnoreCase))).ToList();
        if (invalidSensors.Count > 0)
        {
            db.DeviceSensors.RemoveRange(invalidSensors);
            await db.SaveChangesAsync(ct);
        }

        bool hasNew = false;
        foreach (var param in configuredParams)
        {
            if (existingTypes.Contains(param.ToString())) continue;

            string unit;
            decimal minVal;
            decimal maxVal;
            switch (param)
            {
                case EnvironmentalParameterCode.Temperature:
                    unit = "°C"; minVal = 10m; maxVal = 50m; break;
                case EnvironmentalParameterCode.SoilMoisture:
                    unit = "%"; minVal = 0m; maxVal = 100m; break;
                case EnvironmentalParameterCode.AirHumidity:
                    unit = "%"; minVal = 0m; maxVal = 100m; break;
                case EnvironmentalParameterCode.LightIntensity:
                    unit = "Lux"; minVal = 0m; maxVal = 100000m; break;
                case EnvironmentalParameterCode.Ph:
                    unit = "pH"; minVal = 0m; maxVal = 14m; break;
                case EnvironmentalParameterCode.Ec:
                    unit = "mS/cm"; minVal = 0m; maxVal = 10m; break;
                default:
                    unit = ""; minVal = 0m; maxVal = 100m; break;
            }

            var sensorEntity = new DeviceSensor
            {
                Id = Guid.NewGuid(),
                DeviceId = dev.Id,
                SensorType = param.ToString(),
                Unit = unit,
                MinValue = minVal,
                MaxValue = maxVal,
                SamplingIntervalSec = 60,
                CreatedAtUtc = now
            };
            db.DeviceSensors.Add(sensorEntity);
            dev.Sensors?.Add(sensorEntity);
            hasNew = true;
        }

        if (hasNew)
        {
            try
            {
                await db.SaveChangesAsync(ct);
            }
            catch (DbUpdateException)
            {
                // Bỏ qua nếu đã được seed đồng thời
            }
        }
    }
}
