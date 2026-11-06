using System.Diagnostics;
using System.Globalization;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SmartFarm.Application.Common.Exceptions;
using SmartFarm.Application.Features.Platform;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Ai;
using SmartFarm.Infrastructure.Persistence;

namespace SmartFarm.Infrastructure.Platform;

// ─── Platform Admin Service ───────────────────────────────────────────────────
public sealed class PlatformAdminService(SmartFarmDbContext db) : IPlatformAdminService
{
    public async Task<AuditLogPagedResult> GetAuditLogsAsync(int page, int pageSize, string? search, string? action, string? entity, DateTime? fromDate, DateTime? toDate, CancellationToken ct)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);
        var q = db.AuditLogs.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(search))
            q = q.Where(x => x.ActorName.Contains(search) || x.EntityId.Contains(search) || x.Action.Contains(search));
        if (!string.IsNullOrWhiteSpace(action))
            q = q.Where(x => x.Action == action);
        if (!string.IsNullOrWhiteSpace(entity))
            q = q.Where(x => x.EntityName == entity);
        if (fromDate.HasValue)
            q = q.Where(x => x.CreatedAtUtc >= fromDate.Value);
        if (toDate.HasValue)
            q = q.Where(x => x.CreatedAtUtc <= toDate.Value);
        var total = await q.CountAsync(ct);
        var items = await q.OrderByDescending(x => x.CreatedAtUtc).Skip((page - 1) * pageSize).Take(pageSize)
            .Select(x => new AuditLogView(x.Id, x.ActorUserId, x.ActorName, x.ActorRole, x.Action, x.EntityName, x.EntityId, x.IpAddress, x.Details, x.CreatedAtUtc))
            .ToListAsync(ct);
        return new(items, total, page, pageSize);
    }

    public async Task<IReadOnlyList<PlatformSettingView>> GetSettingsAsync(CancellationToken ct)
    {
        var settings = await db.PlatformSettings.AsNoTracking().OrderBy(x => x.Group).ThenBy(x => x.Key).ToListAsync(ct);
        return settings.Select(x => new PlatformSettingView(x.Key, x.IsSecret ? MaskSecret(x.Value) : x.Value, x.Group, x.DataType, x.Description, x.IsSecret, x.UpdatedAtUtc)).ToList();
    }

    public async Task<IReadOnlyList<PlatformSettingView>> UpdateSettingsAsync(IReadOnlyList<UpdatePlatformSettingItem> updates, Guid updatedByUserId, CancellationToken ct)
    {
        foreach (var update in updates)
        {
            var existing = await db.PlatformSettings.SingleOrDefaultAsync(x => x.Key == update.Key, ct);
            if (existing is null)
            {
                db.PlatformSettings.Add(new PlatformSetting { Key = update.Key, Value = update.Value, Group = "Custom", DataType = "String", UpdatedByUserId = updatedByUserId, UpdatedAtUtc = DateTime.UtcNow });
            }
            else
            {
                existing.Value = update.Value;
                existing.UpdatedByUserId = updatedByUserId;
                existing.UpdatedAtUtc = DateTime.UtcNow;
            }
        }
        await db.SaveChangesAsync(ct);
        return await GetSettingsAsync(ct);
    }

    public async Task<IReadOnlyList<PlatformHardwareItemView>> ListHardwareItemsAsync(CancellationToken ct) =>
        await db.PlatformHardwareItems.AsNoTracking().OrderBy(x => x.Code)
            .Select(x => ToView(x)).ToListAsync(ct);

    public async Task<PlatformHardwareItemView> CreateHardwareItemAsync(CreateHardwareItemCommand c, CancellationToken ct)
    {
        if (await db.PlatformHardwareItems.AnyAsync(x => x.Code == c.Code, ct))
            throw new ResourceConflictException($"Hardware item with code '{c.Code}' already exists.");
        var item = new PlatformHardwareItem { Code = c.Code, Name = c.Name, Category = c.Category, Model = c.Model, Manufacturer = c.Manufacturer, SerialNumber = c.SerialNumber, MacAddress = c.MacAddress, QuantityInStock = c.QuantityInStock, LocationRack = c.LocationRack, UnitPrice = c.UnitPrice, Status = c.Status ?? "Available" };
        db.PlatformHardwareItems.Add(item);
        await db.SaveChangesAsync(ct);
        return ToView(item);
    }

    public async Task<PlatformHardwareItemView> UpdateHardwareItemAsync(Guid id, UpdateHardwareItemCommand c, CancellationToken ct)
    {
        var item = await db.PlatformHardwareItems.SingleOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new ResourceNotFoundException("Hardware item not found.");
        item.Name = c.Name;
        item.Category = c.Category;
        item.Model = c.Model;
        item.Manufacturer = c.Manufacturer;
        item.SerialNumber = c.SerialNumber;
        item.MacAddress = c.MacAddress;
        item.QuantityInStock = c.QuantityInStock;
        item.LocationRack = c.LocationRack;
        item.UnitPrice = c.UnitPrice;
        item.Status = c.Status;
        await db.SaveChangesAsync(ct);
        return ToView(item);
    }

    public async Task DeleteHardwareItemAsync(Guid id, CancellationToken ct)
    {
        var item = await db.PlatformHardwareItems.SingleOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new ResourceNotFoundException("Hardware item not found.");
        db.PlatformHardwareItems.Remove(item);
        await db.SaveChangesAsync(ct);
    }

    public async Task<SystemHealthView> GetSystemHealthAsync(CancellationToken ct)
    {
        var sw = Stopwatch.StartNew();
        var activeTenants = await db.Tenants.CountAsync(x => x.Status == TenantStatus.Active, ct);
        var activeGateways = await db.Gateways.CountAsync(x => x.Status == GatewayStatus.Online, ct);
        var connectedNodes = await db.Devices.CountAsync(x => x.Status != DeviceStatus.Decommissioned, ct);
        long totalTelemetry = 0;
        string dbOk = "Healthy";
        try
        {
            totalTelemetry = await db.TelemetryReadings.LongCountAsync(ct);
        }
        catch { dbOk = "Degraded"; }
        sw.Stop();
        var mem = GC.GetTotalMemory(false);
        return new SystemHealthView(sw.ElapsedMilliseconds, mem, 8_589_934_592L, activeTenants, activeGateways, connectedNodes, totalTelemetry, "Online", dbOk, DateTime.UtcNow);
    }

    public async Task<IReadOnlyList<AllGrowthProfileView>> GetAllGrowthProfilesAsync(bool? isSystemDefined, string? search, CancellationToken ct)
    {
        var q = db.GrowthProfiles.AsNoTracking().Include(x => x.Stages);
        var profiles = await q.OrderBy(x => x.Name).ToListAsync(ct);
        var cropIds = profiles.Select(x => x.CropId).Distinct().ToList();
        var crops = await db.Crops.AsNoTracking().Where(x => cropIds.Contains(x.Id)).Select(x => new { x.Id, x.Name }).ToListAsync(ct);
        var cropMap = crops.ToDictionary(x => x.Id, x => x.Name);
        return profiles
            .Where(x => !isSystemDefined.HasValue || x.IsSystemDefined == isSystemDefined.Value)
            .Where(x => string.IsNullOrWhiteSpace(search) || x.Name.Contains(search, StringComparison.OrdinalIgnoreCase))
            .Select(x => new AllGrowthProfileView(x.Id, x.Name, x.CropId, cropMap.GetValueOrDefault(x.CropId, "Unknown"), x.Stages.Sum(s => s.DurationDays), x.IsSystemDefined, x.CreatedAtUtc))
            .ToList();
    }

    private static string MaskSecret(string value) => value.Length <= 8 ? "****" : value[..4] + new string('*', value.Length - 8) + value[^4..];
    private static PlatformHardwareItemView ToView(PlatformHardwareItem x) => new(x.Id, x.Code, x.Name, x.Category, x.Model, x.Manufacturer, x.SerialNumber, x.MacAddress, x.QuantityInStock, x.LocationRack, x.UnitPrice, x.Status, x.AssignedTechnicianId, x.CreatedAtUtc);
}

// ─── Quotation & Contract Signing Service ─────────────────────────────────────
public sealed class QuotationService(SmartFarmDbContext db) : IQuotationService
{
    public async Task<QuotationView> CreateAsync(Guid technicianId, Guid serviceRequestId, CreateQuotationCommand command, CancellationToken ct)
    {
        var sr = await db.ServiceRequests.SingleOrDefaultAsync(x => x.Id == serviceRequestId, ct)
            ?? throw new ResourceNotFoundException("Service Request not found.");
        if (sr.AssignedTechnicianId != technicianId)
            throw new AuthorizationException("Only the assigned technician may create a quotation.");

        // Remove previous draft quotation if any
        var existing = await db.ServiceRequestQuotations.Include(q => q.Items).SingleOrDefaultAsync(x => x.ServiceRequestId == serviceRequestId && x.Status == "Draft", ct);
        if (existing is not null) { db.ServiceRequestQuotationItems.RemoveRange(existing.Items); db.ServiceRequestQuotations.Remove(existing); }

        var items = command.Items.Select(i => new ServiceRequestQuotationItem
        {
            HardwareItemCode = i.Code, HardwareItemName = i.Name, Category = i.Category,
            Unit = i.Unit, Quantity = i.Quantity, UnitPrice = i.UnitPrice, VatPercent = i.VatPercent,
            TotalAmount = i.Quantity * i.UnitPrice * (1 + i.VatPercent / 100m), Notes = i.Notes
        }).ToList();
        var subtotal = items.Sum(i => i.Quantity * i.UnitPrice);
        var vatAmount = items.Sum(i => i.TotalAmount) - subtotal;
        var total = subtotal + vatAmount;
        var q = new ServiceRequestQuotation
        {
            ServiceRequestId = serviceRequestId, TechnicianUserId = technicianId,
            Subtotal = subtotal, VatPercent = command.Items.Count > 0 ? command.Items[0].VatPercent : 8,
            VatAmount = vatAmount, TotalAmount = total, Deposit30Percent = total * 0.30m,
            Remaining70Percent = total * 0.70m, Notes = command.Notes, ContractTerms = command.ContractTerms, Status = "SentToOwner"
        };
        foreach (var i in items) q.Items.Add(i);
        db.ServiceRequestQuotations.Add(q);
        await db.SaveChangesAsync(ct);
        return ToView(q);
    }

    public async Task<QuotationView> GetAsync(Guid userId, Guid serviceRequestId, CancellationToken ct)
    {
        var q = await db.ServiceRequestQuotations.Include(x => x.Items).AsNoTracking()
            .SingleOrDefaultAsync(x => x.ServiceRequestId == serviceRequestId, ct)
            ?? throw new ResourceNotFoundException("Quotation not found for this Service Request.");
        return ToView(q);
    }

    public async Task<ServiceRequestPaymentView> SignContractDepositAsync(Guid ownerId, Guid serviceRequestId, SignContractDepositCommand command, CancellationToken ct)
    {
        var sr = await db.ServiceRequests.Include(x => x.Quotations).SingleOrDefaultAsync(x => x.Id == serviceRequestId, ct)
            ?? throw new ResourceNotFoundException("Service Request not found.");
        var quotation = sr.Quotations.FirstOrDefault() ?? throw new ResourceConflictException("No quotation exists for this Service Request.");
        var payment = new ServiceRequestPayment
        {
            ServiceRequestId = serviceRequestId, QuotationId = quotation.Id, PaymentStage = "DEPOSIT_30",
            Amount = quotation.Deposit30Percent, PaymentMethod = command.PaymentMethod,
            TransactionReference = command.TransactionReference, SignerFullName = command.SignerFullName,
            SignatureHash = Guid.NewGuid().ToString("N"), Status = "Confirmed", PaidAtUtc = DateTime.UtcNow
        };
        sr.IsContractSigned = true;
        sr.IsDepositPaid = true;
        quotation.Status = "SignedByOwner";
        db.ServiceRequestPayments.Add(payment);
        await db.SaveChangesAsync(ct);
        return new(payment.Id, payment.PaymentStage, payment.Amount, payment.PaymentMethod, payment.TransactionReference, payment.SignerFullName, payment.Status, payment.PaidAtUtc);
    }

    public async Task<ServiceRequestPaymentView> SignAcceptanceFinalAsync(Guid ownerId, Guid serviceRequestId, SignAcceptanceFinalCommand command, CancellationToken ct)
    {
        var sr = await db.ServiceRequests.Include(x => x.Quotations).SingleOrDefaultAsync(x => x.Id == serviceRequestId, ct)
            ?? throw new ResourceNotFoundException("Service Request not found.");
        if (!sr.IsDepositPaid) throw new ResourceConflictException("Deposit must be paid before final acceptance.");
        var quotation = sr.Quotations.FirstOrDefault() ?? throw new ResourceConflictException("No quotation exists.");
        var payment = new ServiceRequestPayment
        {
            ServiceRequestId = serviceRequestId, QuotationId = quotation.Id, PaymentStage = "FINAL_70",
            Amount = quotation.Remaining70Percent, PaymentMethod = command.PaymentMethod,
            TransactionReference = command.TransactionReference, SignerFullName = command.SignerFullName,
            SignatureHash = Guid.NewGuid().ToString("N"), Status = "Confirmed", PaidAtUtc = DateTime.UtcNow
        };
        sr.IsAcceptanceSigned = true;
        sr.IsFullyPaid = true;
        quotation.Status = "Completed";
        db.ServiceRequestPayments.Add(payment);
        await db.SaveChangesAsync(ct);
        return new(payment.Id, payment.PaymentStage, payment.Amount, payment.PaymentMethod, payment.TransactionReference, payment.SignerFullName, payment.Status, payment.PaidAtUtc);
    }

    private static QuotationView ToView(ServiceRequestQuotation q) => new(
        q.Id, q.ServiceRequestId, q.TechnicianUserId, q.Subtotal, q.VatPercent, q.VatAmount,
        q.TotalAmount, q.Deposit30Percent, q.Remaining70Percent, q.Notes, q.ContractTerms, q.Status,
        q.Items.Select(i => new QuotationItemView(i.Id, i.HardwareItemCode, i.HardwareItemName, i.Category, i.Unit, i.Quantity, i.UnitPrice, i.VatPercent, i.TotalAmount, i.Notes)).ToList(),
        q.CreatedAtUtc);
}

// ─── GIS Service ──────────────────────────────────────────────────────────────
public sealed class GisService(SmartFarmDbContext db) : IGisService
{
    public async Task BulkUpdateNodeLocationsAsync(Guid technicianId, Guid zoneId, BulkUpdateNodeLocationsCommand command, CancellationToken ct)
    {
        var deviceIds = command.Nodes.Select(n => n.DeviceId).ToList();
        var devices = await db.Devices.Where(x => deviceIds.Contains(x.Id) && x.ZoneId == zoneId).ToListAsync(ct);
        foreach (var node in command.Nodes)
        {
            var device = devices.FirstOrDefault(d => d.Id == node.DeviceId);
            if (device is null) continue;
            device.GpsLatitude = node.Latitude;
            device.GpsLongitude = node.Longitude;
            device.BatteryLevel = node.BatteryLevel;
            device.Rssi = node.Rssi;
        }
        await db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<DeviceMapLocationView>> GetMapLocationsAsync(Guid userId, Guid zoneId, CancellationToken ct) =>
        await db.Devices.AsNoTracking().Where(x => x.ZoneId == zoneId && x.Status != DeviceStatus.Decommissioned)
            .Select(x => new DeviceMapLocationView(x.Id, x.HardwareAddress, x.DeviceType.ToString(), x.GpsLatitude, x.GpsLongitude, x.BatteryLevel, x.Rssi, x.Status.ToString()))
            .ToListAsync(ct);
}

// ─── Farm Wizard Service ──────────────────────────────────────────────────────
public sealed class FarmWizardService(SmartFarmDbContext db) : IFarmWizardService
{
    public async Task<FarmWizardResult> SetupAsync(Guid ownerId, Guid tenantId, FarmWizardSetupCommand command, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        // 1. Create Farm
        var farm = new Farm
        {
            TenantId = tenantId, Name = command.Farm.Name, Status = FarmStatus.Active,
            Latitude = command.Farm.Latitude, Longitude = command.Farm.Longitude,
            TotalAreaM2 = command.Farm.TotalAreaM2 ?? 0,
            LocationText = command.Farm.LocationText, TimeZone = command.Farm.TimeZone ?? "Asia/Ho_Chi_Minh"
        };
        db.Farms.Add(farm);
        await db.SaveChangesAsync(ct);

        Guid? fieldId = null, zoneId = null, seasonId = null, deploymentId = null;

        // 2. Create Field (optional)
        if (command.Field is not null)
        {
            var field = new Field { FarmId = farm.Id, Name = command.Field.Name, AreaM2 = command.Field.AreaM2 ?? 0, SoilType = command.Field.SoilType };
            db.Fields.Add(field);
            await db.SaveChangesAsync(ct);
            fieldId = field.Id;

            // 3. Create Zone (optional, requires field)
            if (command.Zone is not null)
            {
                var zone = new Zone { FieldId = field.Id, Name = command.Zone.Name, AreaM2 = command.Zone.AreaM2 ?? 0, Status = ZoneStatus.Operating };
                db.Zones.Add(zone);
                await db.SaveChangesAsync(ct);
                zoneId = zone.Id;

                // 4. Create Season (optional, requires zone)
                if (command.Season is not null)
                {
                    var profile = command.Season.GrowthProfileId.HasValue
                        ? await db.GrowthProfiles.Include(x => x.Stages).SingleOrDefaultAsync(x => x.Id == command.Season.GrowthProfileId.Value, ct)
                        : await db.GrowthProfiles.Include(x => x.Stages).FirstOrDefaultAsync(x => x.CropId == command.Season.CropId && x.IsDefault, ct)
                          ?? await db.GrowthProfiles.Include(x => x.Stages).FirstOrDefaultAsync(x => x.CropId == command.Season.CropId, ct);

                    if (profile is not null && profile.Stages.Any())
                    {
                        var firstStage = profile.Stages.OrderBy(s => s.StageOrder).First();
                        var season = new PlantingSeason
                        {
                            ZoneId = zone.Id,
                            CropId = command.Season.CropId,
                            VarietyId = command.Season.VarietyId,
                            GrowthProfileId = profile.Id,
                            CurrentGrowthStageId = firstStage.Id,
                            Name = command.Season.Name,
                            StartDate = DateOnly.FromDateTime(command.Season.StartDate),
                            ExpectedEndDate = command.Season.ExpectedEndDate.HasValue ? DateOnly.FromDateTime(command.Season.ExpectedEndDate.Value) : DateOnly.FromDateTime(command.Season.StartDate).AddDays(90),
                            Status = PlantingSeasonStatus.Planned
                        };
                        db.PlantingSeasons.Add(season);
                        await db.SaveChangesAsync(ct);
                        seasonId = season.Id;

                        // 5. Create initial Deployment Request (optional)
                        if (command.InitialDeploymentRequest is not null)
                        {
                            var dr = new DeploymentRequest
                            {
                                TenantId = tenantId, FarmId = farm.Id, ZoneId = zone.Id, PlantingSeasonId = season.Id,
                                OwnerUserId = ownerId, Status = DeploymentRequestStatus.Submitted,
                                RequiredParametersCsv = string.Join(",", command.InitialDeploymentRequest.RequiredParameters ?? []),
                                OwnerNotes = command.InitialDeploymentRequest.OwnerNotes,
                                SubmittedAtUtc = DateTime.UtcNow
                            };
                            db.DeploymentRequests.Add(dr);
                            await db.SaveChangesAsync(ct);
                            deploymentId = dr.Id;
                        }
                    }
                }
            }
        }

        await tx.CommitAsync(ct);
        return new(farm.Id, fieldId, zoneId, seasonId, deploymentId);
    }
}

// ─── Weather Service ──────────────────────────────────────────────────────────
public sealed class WeatherService(SmartFarmDbContext db, HttpClient httpClient, IOptions<OpenMeteoOptions> options) : IWeatherService
{
    private static readonly Dictionary<(decimal, decimal), (FarmWeatherView View, DateTime Cached)> _cache = new();
    private readonly OpenMeteoOptions _opts = options.Value;

    public async Task<FarmWeatherView> GetFarmWeatherAsync(Guid userId, Guid tenantId, Guid farmId, CancellationToken ct)
    {
        var farm = await db.Farms.AsNoTracking().SingleOrDefaultAsync(x => x.Id == farmId, ct)
            ?? throw new ResourceNotFoundException("Farm not found.");
        if (farm.Latitude is null || farm.Longitude is null)
            return new FarmWeatherView(null, null, null, null, "Tọa độ nông trại chưa được cấu hình.", [], DateTime.UtcNow);

        var key = (farm.Latitude.Value, farm.Longitude.Value);
        if (_cache.TryGetValue(key, out var cached) && (DateTime.UtcNow - cached.Cached).TotalMinutes < 30)
            return cached.View;

        try
        {
            var url = FormattableString.Invariant($"{_opts.BaseUrl}?latitude={farm.Latitude}&longitude={farm.Longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&forecast_days=7&timezone=Asia%2FHo_Chi_Minh");
            using var response = await httpClient.GetAsync(url, ct);
            if (!response.IsSuccessStatusCode)
                return new FarmWeatherView(null, null, null, null, $"OpenMeteo HTTP {(int)response.StatusCode}", [], DateTime.UtcNow);
            using var json = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
            var cur = json.RootElement.GetProperty("current");
            var temp = cur.TryGetProperty("temperature_2m", out var t) ? (decimal?)t.GetDecimal() : null;
            var humidity = cur.TryGetProperty("relative_humidity_2m", out var h) ? (decimal?)h.GetDecimal() : null;
            var wind = cur.TryGetProperty("wind_speed_10m", out var w) ? (decimal?)w.GetDecimal() : null;
            var code = cur.TryGetProperty("weather_code", out var wc) ? wc.GetInt32() : -1;

            var daily = new List<DailyForecastView>();
            if (json.RootElement.TryGetProperty("daily", out var d))
            {
                var dates = d.GetProperty("time").EnumerateArray().Select(x => DateTime.Parse(x.GetString()!, null, System.Globalization.DateTimeStyles.AssumeUniversal)).ToList();
                var maxTemps = d.GetProperty("temperature_2m_max").EnumerateArray().Select(x => x.ValueKind == JsonValueKind.Number ? (decimal?)x.GetDecimal() : null).ToList();
                var minTemps = d.GetProperty("temperature_2m_min").EnumerateArray().Select(x => x.ValueKind == JsonValueKind.Number ? (decimal?)x.GetDecimal() : null).ToList();
                var probs = d.GetProperty("precipitation_probability_max").EnumerateArray().Select(x => x.ValueKind == JsonValueKind.Number ? (decimal?)x.GetDecimal() : null).ToList();
                var codes = d.GetProperty("weather_code").EnumerateArray().Select(x => x.GetInt32()).ToList();
                for (int i = 0; i < dates.Count; i++)
                    daily.Add(new(dates[i], maxTemps.ElementAtOrDefault(i), minTemps.ElementAtOrDefault(i), probs.ElementAtOrDefault(i), DescribeCode(codes.ElementAtOrDefault(i))));
            }
            var result = new FarmWeatherView(temp, humidity, null, wind, DescribeCode(code), daily, DateTime.UtcNow);
            _cache[key] = (result, DateTime.UtcNow);
            return result;
        }
        catch { return new FarmWeatherView(null, null, null, null, "Không thể lấy dữ liệu thời tiết.", [], DateTime.UtcNow); }
    }

    private static string DescribeCode(int code) => code switch
    {
        0 => "Trời quang đãng", 1 or 2 or 3 => "Mây rải rác", 45 or 48 => "Sương mù", 51 or 53 or 55 => "Mưa phùn",
        61 or 63 or 65 => "Mưa", 71 or 73 or 75 => "Tuyết", 80 or 81 or 82 => "Mưa rào",
        95 or 96 or 99 => "Giông bão", _ => "Không rõ"
    };
}

// ─── Farmer Service ───────────────────────────────────────────────────────────
public sealed class FarmerService(SmartFarmDbContext db) : IFarmerService
{
    public async Task<IReadOnlyList<object>> GetMyTasksAsync(Guid farmerId, CancellationToken ct) =>
        (await db.FarmTasks.AsNoTracking().Include(x => x.Zone).Where(x => x.AssignedFarmerId == farmerId && x.Status != FarmTaskStatus.Cancelled)
            .OrderBy(x => x.DueAtUtc).ToListAsync(ct))
        .Select(x => (object)new { x.Id, x.Title, x.Description, x.Status, DueDate = x.DueAtUtc, ZoneName = x.Zone != null ? x.Zone.Name : null, x.CreatedAtUtc })
        .ToList();

    public async Task CompleteTaskAsync(Guid farmerId, Guid taskId, FarmerCompleteTaskCommand command, CancellationToken ct)
    {
        var task = await db.FarmTasks.SingleOrDefaultAsync(x => x.Id == taskId && x.AssignedFarmerId == farmerId, ct)
            ?? throw new ResourceNotFoundException("Task not found or not assigned to you.");
        if (task.Status is not (FarmTaskStatus.Pending or FarmTaskStatus.Accepted or FarmTaskStatus.InProgress))
            throw new ResourceConflictException("Task cannot be completed in its current state.");
        var prevStatus = task.Status;
        task.Status = FarmTaskStatus.CompletedPendingReview;
        task.Result = command.ResultNotes;
        task.SubmittedAtUtc = DateTime.UtcNow;
        var hist = new FarmTaskHistory
        {
            FarmTaskId = task.Id,
            ActorUserId = farmerId,
            EventType = FarmTaskEventType.Completed,
            FromStatus = prevStatus,
            ToStatus = FarmTaskStatus.CompletedPendingReview,
            Notes = command.ResultNotes
        };
        db.FarmTaskHistory.Add(hist);
        await db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<FarmerZoneView>> GetMyZonesAsync(Guid farmerId, CancellationToken ct) =>
        await db.UserZoneAccesses.AsNoTracking().Include(x => x.Zone).ThenInclude(z => z.Field)
            .Where(x => x.AppUserId == farmerId).OrderBy(x => x.Zone.Name)
            .Select(x => new FarmerZoneView(x.ZoneId, x.Zone.Name, x.Zone.FieldId, x.Zone.Field.FarmId, x.CanControl, x.AssignedAtUtc))
            .ToListAsync(ct);

    public async Task<IReadOnlyList<PlatformHardwareItemView>> GetMySparePartsAsync(Guid technicianId, CancellationToken ct) =>
        await db.PlatformHardwareItems.AsNoTracking().Where(x => x.AssignedTechnicianId == technicianId)
            .OrderBy(x => x.Code)
            .Select(x => new PlatformHardwareItemView(x.Id, x.Code, x.Name, x.Category, x.Model, x.Manufacturer, x.SerialNumber, x.MacAddress, x.QuantityInStock, x.LocationRack, x.UnitPrice, x.Status, x.AssignedTechnicianId, x.CreatedAtUtc))
            .ToListAsync(ct);
}

// ─── Schedule Sync Service ────────────────────────────────────────────────────
public sealed class ScheduleSyncService(SmartFarmDbContext db) : IScheduleSyncService
{
    public async Task<IReadOnlyList<object>> SyncFromCropAsync(Guid ownerId, Guid tenantId, Guid zoneId, Guid cropId, Guid actuatorId, CancellationToken ct)
    {
        // Find growth profile for crop
        var profile = await db.GrowthProfiles.Include(x => x.Stages).AsNoTracking()
            .FirstOrDefaultAsync(x => x.CropId == cropId, ct);
        if (profile is null) return [];

        var zone = await db.Zones.Include(z => z.Field).ThenInclude(f => f.Farm).SingleOrDefaultAsync(z => z.Id == zoneId, ct)
            ?? throw new ResourceNotFoundException("Zone not found.");

        var actuator = await db.DeviceActuators.SingleOrDefaultAsync(x => x.Id == actuatorId, ct)
            ?? throw new ResourceNotFoundException("Actuator not found.");

        // Remove old synced schedules for this zone+actuator
        var existing = await db.ControlSchedules.Where(x => x.ZoneId == zoneId && x.ActuatorId == actuatorId && x.Name.StartsWith("[AutoSync]")).ToListAsync(ct);
        db.ControlSchedules.RemoveRange(existing);

        // Create default schedules (morning, noon, afternoon irrigation)
        var defaultTimes = new[] { (7, 30, 20), (12, 0, 10), (16, 30, 15) };
        var created = new List<ControlSchedule>();
        foreach (var (h, m, dur) in defaultTimes)
        {
            var cs = new ControlSchedule
            {
                TenantId = zone.Field.Farm.TenantId,
                FarmId = zone.Field.FarmId,
                ZoneId = zoneId,
                ActuatorId = actuatorId,
                Name = $"[AutoSync] {profile.Name} {h:D2}:{m:D2}",
                CronExpression = $"0 {m} {h} * * *",
                DurationSeconds = dur * 60,
                EnableRainDelay = true,
                RainThresholdPercent = 70,
                IsActive = true,
                NextRunAtUtc = DateTime.UtcNow.AddMinutes(30)
            };
            created.Add(cs);
            db.ControlSchedules.Add(cs);
        }
        await db.SaveChangesAsync(ct);
        return created.Select(x => (object)new { x.Id, x.Name, x.CronExpression, x.DurationSeconds, x.IsActive }).ToList();
    }
}

// ─── Control Automation & Safety Service ─────────────────────────────────────
public sealed class ControlAutomationService(SmartFarmDbContext db) : IControlAutomationService
{
    public async Task<EmergencyStopResult> EmergencyStopAllAsync(Guid userId, Guid tenantId, Guid? zoneId, CancellationToken ct)
    {
        var caller = await db.AppUsers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == userId, ct);
        var effectiveTenantId = caller?.Role == UserRole.PlatformAdmin ? (caller.TenantId ?? tenantId) : tenantId;

        var actuatorsQuery = db.DeviceActuators.Include(a => a.Device).ThenInclude(d => d.Farm).AsQueryable();
        if (zoneId.HasValue)
        {
            actuatorsQuery = actuatorsQuery.Where(a => a.Device.ZoneId == zoneId.Value);
        }
        else if (caller?.Role != UserRole.PlatformAdmin)
        {
            actuatorsQuery = actuatorsQuery.Where(a => a.Device.Farm.TenantId == effectiveTenantId);
        }

        var actuators = await actuatorsQuery.ToListAsync(ct);
        var stoppedCount = 0;
        var now = DateTime.UtcNow;

        foreach (var act in actuators)
        {
            var activeCommands = await db.ActuatorCommands
                .Where(c => c.ActuatorId == act.Id && (c.Status == ActuatorCommandStatus.Pending || c.Status == ActuatorCommandStatus.Sent))
                .ToListAsync(ct);

            foreach (var cmd in activeCommands)
            {
                cmd.Status = ActuatorCommandStatus.Failed;
                cmd.TerminalAtUtc = now;
            }

            var stopCmd = new ActuatorCommand
            {
                TenantId = act.Device.Farm.TenantId,
                FarmId = act.Device.FarmId,
                ZoneId = act.Device.ZoneId ?? Guid.Empty,
                DeviceId = act.DeviceId,
                GatewayId = act.Device.GatewayId,
                ActuatorId = act.Id,
                Action = ActuatorCommandAction.TurnOff,
                DurationSeconds = 0,
                TriggerSource = CommandTriggerSource.Manual,
                Status = ActuatorCommandStatus.Pending,
                QueuedAtUtc = now,
                IdempotencyKey = $"EMERGENCY-STOP-{act.Id}-{now.Ticks}",
                Notes = "Dừng khẩn cấp toàn bộ thiết bị truyền động từ Dashboard."
            };
            db.ActuatorCommands.Add(stopCmd);
            stoppedCount++;
        }

        db.AuditLogs.Add(new AuditLog
        {
            ActorUserId = userId,
            ActorName = caller?.FullName ?? "User",
            ActorRole = caller?.Role.ToString() ?? "FarmOwner",
            Action = "EMERGENCY_STOP",
            EntityName = zoneId.HasValue ? "Zone" : "Tenant",
            EntityId = (zoneId ?? effectiveTenantId).ToString(),
            Details = $"Đã ngắt khẩn cấp {stoppedCount} thiết bị rơ-le truyền động.",
            CreatedAtUtc = now
        });

        await db.SaveChangesAsync(ct);
        return new EmergencyStopResult(true, stoppedCount, $"Đã dừng khẩn cấp thành công {stoppedCount} rơ-le thiết bị.");
    }

    public async Task<IReadOnlyList<EnvironmentalTargetConfigView>> GetEnvironmentalConfigsAsync(Guid userId, Guid tenantId, Guid? zoneId, CancellationToken ct)
    {
        var caller = await db.AppUsers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == userId, ct);
        var effectiveTenantId = caller?.Role == UserRole.PlatformAdmin ? (caller.TenantId ?? tenantId) : tenantId;

        var zonesQuery = db.Zones.Include(z => z.Field).ThenInclude(f => f.Farm).AsNoTracking();
        if (zoneId.HasValue)
        {
            zonesQuery = zonesQuery.Where(z => z.Id == zoneId.Value);
        }
        else if (caller?.Role != UserRole.PlatformAdmin)
        {
            zonesQuery = zonesQuery.Where(z => z.Field.Farm.TenantId == effectiveTenantId);
        }

        var zones = await zonesQuery.OrderBy(z => z.Name).ToListAsync(ct);
        var results = new List<EnvironmentalTargetConfigView>();

        foreach (var z in zones)
        {
            var activeSeason = await db.PlantingSeasons.Include(s => s.AppliedRequirements)
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.ZoneId == z.Id && s.Status == PlantingSeasonStatus.InProgress, ct);

            decimal targetSoil = 70m, minSoil = 60m, maxSoil = 80m;
            decimal maxTemp = 32m, targetHum = 75m, targetLux = 25000m;

            if (activeSeason?.AppliedRequirements != null && activeSeason.AppliedRequirements.Any())
            {
                var soilReq = activeSeason.AppliedRequirements.FirstOrDefault(r => r.ParameterCode == EnvironmentalParameterCode.SoilMoisture);
                if (soilReq != null)
                {
                    targetSoil = soilReq.TargetValue;
                    minSoil = soilReq.MinValue;
                    maxSoil = soilReq.MaxValue;
                }
                var tempReq = activeSeason.AppliedRequirements.FirstOrDefault(r => r.ParameterCode == EnvironmentalParameterCode.Temperature);
                if (tempReq != null) maxTemp = tempReq.MaxValue;

                var humReq = activeSeason.AppliedRequirements.FirstOrDefault(r => r.ParameterCode == EnvironmentalParameterCode.AirHumidity);
                if (humReq != null) targetHum = humReq.TargetValue;

                var luxReq = activeSeason.AppliedRequirements.FirstOrDefault(r => r.ParameterCode == EnvironmentalParameterCode.LightIntensity);
                if (luxReq != null) targetLux = luxReq.TargetValue;
            }

            results.Add(new EnvironmentalTargetConfigView(
                z.Id,
                z.Name,
                targetSoil,
                minSoil,
                maxSoil,
                maxTemp,
                targetHum,
                targetLux,
                750m
            ));
        }

        return results;
    }

    public async Task<EnvironmentalTargetConfigView> UpdateEnvironmentalConfigAsync(Guid userId, Guid tenantId, UpdateEnvironmentalTargetConfigCommand command, CancellationToken ct)
    {
        var zone = await db.Zones.Include(z => z.Field).ThenInclude(f => f.Farm).SingleOrDefaultAsync(z => z.Id == command.ZoneId, ct)
            ?? throw new ResourceNotFoundException("Zone not found.");

        var activeSeason = await db.PlantingSeasons.Include(s => s.AppliedRequirements)
            .FirstOrDefaultAsync(s => s.ZoneId == command.ZoneId && s.Status == PlantingSeasonStatus.InProgress, ct);

        if (activeSeason != null)
        {
            var soilReq = activeSeason.AppliedRequirements.FirstOrDefault(r => r.ParameterCode == EnvironmentalParameterCode.SoilMoisture);
            if (soilReq != null)
            {
                soilReq.TargetValue = command.TargetSoilMoisture;
                soilReq.MinValue = command.MinSoilMoisture;
                soilReq.MaxValue = command.MaxSoilMoisture;
            }
            else
            {
                activeSeason.AppliedRequirements.Add(new SeasonAppliedRequirement
                {
                    PlantingSeasonId = activeSeason.Id,
                    ParameterCode = EnvironmentalParameterCode.SoilMoisture,
                    MinValue = command.MinSoilMoisture,
                    MaxValue = command.MaxSoilMoisture,
                    TargetValue = command.TargetSoilMoisture,
                    Unit = "%"
                });
            }

            var tempReq = activeSeason.AppliedRequirements.FirstOrDefault(r => r.ParameterCode == EnvironmentalParameterCode.Temperature);
            if (tempReq != null) tempReq.MaxValue = command.MaxTemperature;

            var humReq = activeSeason.AppliedRequirements.FirstOrDefault(r => r.ParameterCode == EnvironmentalParameterCode.AirHumidity);
            if (humReq != null) humReq.TargetValue = command.TargetHumidity;

            var luxReq = activeSeason.AppliedRequirements.FirstOrDefault(r => r.ParameterCode == EnvironmentalParameterCode.LightIntensity);
            if (luxReq != null) luxReq.TargetValue = command.TargetLux;

            await db.SaveChangesAsync(ct);
        }

        return new EnvironmentalTargetConfigView(
            zone.Id,
            zone.Name,
            command.TargetSoilMoisture,
            command.MinSoilMoisture,
            command.MaxSoilMoisture,
            command.MaxTemperature,
            command.TargetHumidity,
            command.TargetLux,
            command.PowerWatts ?? 750m
        );
    }
}

