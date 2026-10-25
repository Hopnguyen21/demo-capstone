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

        if (sr.IsContractSigned || sr.IsDepositPaid || sr.IsFullyPaid)
            throw new ResourceConflictException("Hợp đồng đã được chủ trang trại ký kết và thanh toán. Kỹ thuật viên không thể chỉnh sửa hoặc tạo lại hợp đồng.");

        var hasSignedOrPaid = await db.ServiceRequestQuotations.AnyAsync(
            x => x.ServiceRequestId == serviceRequestId && (x.Status == "SignedByOwner" || x.Status == "DepositPaid" || x.Status == "Completed"), ct);
        if (hasSignedOrPaid)
            throw new ResourceConflictException("Hợp đồng đã được ký kết và thanh toán cọc. Kỹ thuật viên không thể chỉnh sửa hoặc tạo lại hợp đồng.");

        // Remove previous draft quotation if any
        var existingDrafts = await db.ServiceRequestQuotations.Include(q => q.Items)
            .Where(x => x.ServiceRequestId == serviceRequestId && x.Status == "Draft")
            .ToListAsync(ct);
        if (existingDrafts.Count > 0)
        {
            foreach (var d in existingDrafts)
            {
                db.ServiceRequestQuotationItems.RemoveRange(d.Items);
            }
            db.ServiceRequestQuotations.RemoveRange(existingDrafts);
        }

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

    public async Task<QuotationView?> GetAsync(Guid userId, Guid serviceRequestId, CancellationToken ct)
    {
        var q = await db.ServiceRequestQuotations.Include(x => x.Items).AsNoTracking()
            .OrderByDescending(x => x.CreatedAtUtc)
            .FirstOrDefaultAsync(x => x.ServiceRequestId == serviceRequestId, ct);
        return q is null ? null : ToView(q);
    }

    public async Task<ServiceRequestPaymentView> SignContractDepositAsync(Guid ownerId, Guid serviceRequestId, SignContractDepositCommand command, CancellationToken ct)
    {
        var sr = await db.ServiceRequests
            .Include(x => x.Quotations)
                .ThenInclude(q => q.Items)
            .FirstOrDefaultAsync(x => x.Id == serviceRequestId, ct)
            ?? throw new ResourceNotFoundException("Service Request not found.");
        var quotation = sr.Quotations.OrderByDescending(x => x.CreatedAtUtc).FirstOrDefault() ?? throw new ResourceConflictException("No quotation exists for this Service Request.");
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

        // Synchronize unified ZoneContract for this Zone
        if (sr.ZoneId != Guid.Empty)
        {
            var zoneId = sr.ZoneId;
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var contractNum = $"HD-SR-{quotation.Id.ToString()[..8].ToUpper()}";

            var existingContract = await db.ZoneContracts.FirstOrDefaultAsync(c => c.ZoneId == zoneId && c.ContractNumber == contractNum, ct);
            if (existingContract == null)
            {
                var zone = await db.Zones.Include(z => z.Field).FirstOrDefaultAsync(z => z.Id == zoneId, ct);
                var farmId = sr.FarmId != Guid.Empty ? sr.FarmId : (zone?.Field?.FarmId ?? Guid.Empty);
                var effectiveTenantId = sr.TenantId != Guid.Empty ? sr.TenantId : (zone?.Field?.Farm?.TenantId ?? Guid.Empty);

                var hardwareItems = quotation.Items != null && quotation.Items.Count > 0
                    ? string.Join(", ", quotation.Items.Select(i => $"{i.Quantity}x {i.HardwareItemName}"))
                    : "Gói thiết bị IoT & Cảm biến vi khí hậu theo hợp đồng dịch vụ";

                var zoneContract = new ZoneContract
                {
                    TenantId = effectiveTenantId,
                    FarmId = farmId,
                    ZoneId = zoneId,
                    CreatedByOwnerId = ownerId,
                    ContractNumber = contractNum,
                    CropType = zone?.Notes ?? "Cây trồng VietGAP trong nhà màng",
                    MonthlyRentVnd = Math.Round(quotation.TotalAmount / 12),
                    DepositVnd = quotation.Deposit30Percent,
                    TotalContractValueVnd = quotation.TotalAmount,
                    StartDate = today,
                    EndDate = today.AddMonths(12),
                    Status = ZoneContractStatus.Active,
                    LesseeName = command.SignerFullName ?? "Chủ Trang Trại",
                    LesseePhone = "0903666888",
                    LesseeAddress = "Trang trại thông minh SmartFarm",
                    SignedAtUtc = DateTime.UtcNow,
                    SpecialTerms = $"Thiết bị bao gồm: {hardwareItems}. Tạm ứng 30%: {quotation.Deposit30Percent:N0} đ, Còn lại 70%: {quotation.Remaining70Percent:N0} đ. Thuế VAT 8%: {quotation.VatAmount:N0} đ.",
                    Notes = $"[Hợp đồng ký từ Cổng Dịch vụ #{sr.Id.ToString()[..8].ToUpper()}] {quotation.Notes}"
                };

                // Previous active contracts for this zone become renewed/superseded
                var oldActiveContracts = await db.ZoneContracts
                    .Where(c => c.ZoneId == zoneId && (c.Status == ZoneContractStatus.Active || c.Status == ZoneContractStatus.ExpiringSoon))
                    .ToListAsync(ct);
                foreach (var old in oldActiveContracts)
                {
                    old.Status = ZoneContractStatus.Renewed;
                }

                db.ZoneContracts.Add(zoneContract);
            }
        }

        await db.SaveChangesAsync(ct);
        return new(payment.Id, payment.PaymentStage, payment.Amount, payment.PaymentMethod, payment.TransactionReference, payment.SignerFullName, payment.Status, payment.PaidAtUtc);
    }

    public async Task<ServiceRequestPaymentView> SignAcceptanceFinalAsync(Guid ownerId, Guid serviceRequestId, SignAcceptanceFinalCommand command, CancellationToken ct)
    {
        var sr = await db.ServiceRequests.Include(x => x.Quotations).FirstOrDefaultAsync(x => x.Id == serviceRequestId, ct)
            ?? throw new ResourceNotFoundException("Service Request not found.");
        if (!sr.IsDepositPaid) throw new ResourceConflictException("Deposit must be paid before final acceptance.");
        var quotation = sr.Quotations.OrderByDescending(x => x.CreatedAtUtc).FirstOrDefault() ?? throw new ResourceConflictException("No quotation exists.");
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
            var field = new Field
            {
                FarmId = farm.Id,
                Name = command.Field.Name,
                AreaM2 = command.Field.AreaM2 ?? 0,
                SoilType = command.Field.SoilType,
                BoundaryGeoJson = command.Field.BoundaryGeoJson
            };
            db.Fields.Add(field);
            await db.SaveChangesAsync(ct);
            fieldId = field.Id;

            // 3. Create Zone (optional, requires field)
            if (command.Zone is not null)
            {
                var zone = new Zone
                {
                    FieldId = field.Id,
                    Name = command.Zone.Name,
                    AreaM2 = command.Zone.AreaM2 ?? 0,
                    ZoneType = command.Zone.ZoneType ?? "Greenhouse",
                    BoundaryGeoJson = command.Zone.BoundaryGeoJson,
                    Status = ZoneStatus.Operating
                };
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
    public async Task<IReadOnlyList<object>> GetMyTasksAsync(Guid farmerId, CancellationToken ct)
    {
        var caller = await db.AppUsers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == farmerId, ct);
        var query = db.FarmTasks.AsNoTracking().Include(x => x.Zone).AsQueryable();

        if (caller != null && caller.Role != UserRole.Farmer)
        {
            if (caller.TenantId.HasValue)
                query = query.Where(x => x.TenantId == caller.TenantId.Value && x.Status != FarmTaskStatus.Cancelled);
            else
                query = query.Where(x => x.Status != FarmTaskStatus.Cancelled);
        }
        else
        {
            query = query.Where(x => x.AssignedFarmerId == farmerId && x.Status != FarmTaskStatus.Cancelled);
        }

        var list = await query.OrderBy(x => x.DueAtUtc).ToListAsync(ct);
        return list.Select(x => (object)new {
            Id = x.Id,
            TaskId = x.Id,
            Title = x.Title,
            Description = x.Description,
            Status = x.Status.ToString(),
            DueDate = x.DueAtUtc,
            DueAtUtc = x.DueAtUtc,
            ZoneName = x.Zone != null ? x.Zone.Name : null,
            CreatedAtUtc = x.CreatedAtUtc
        }).ToList();
    }

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

    public async Task<IReadOnlyList<FarmerZoneView>> GetMyZonesAsync(Guid farmerId, CancellationToken ct)
    {
        var caller = await db.AppUsers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == farmerId, ct);
        if (caller != null && caller.Role != UserRole.Farmer)
        {
            var zones = await db.Zones.AsNoTracking().Include(z => z.Field)
                .Where(z => z.ArchivedAtUtc == null && (caller.TenantId == null || z.Field.Farm.TenantId == caller.TenantId.Value))
                .OrderBy(z => z.Name)
                .Select(z => new FarmerZoneView(z.Id, z.Name, z.FieldId, z.Field.FarmId, true, z.CreatedAtUtc))
                .ToListAsync(ct);
            return zones;
        }

        return await db.UserZoneAccesses.AsNoTracking().Include(x => x.Zone).ThenInclude(z => z.Field)
            .Where(x => x.AppUserId == farmerId).OrderBy(x => x.Zone.Name)
            .Select(x => new FarmerZoneView(x.ZoneId, x.Zone.Name, x.Zone.FieldId, x.Zone.Field.FarmId, x.CanControl, x.AssignedAtUtc))
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<PlatformHardwareItemView>> GetMySparePartsAsync(Guid technicianId, CancellationToken ct)
    {
        var assigned = await db.PlatformHardwareItems.AsNoTracking().Where(x => x.AssignedTechnicianId == technicianId)
            .OrderBy(x => x.Code)
            .Select(x => new PlatformHardwareItemView(x.Id, x.Code, x.Name, x.Category, x.Model, x.Manufacturer, x.SerialNumber, x.MacAddress, x.QuantityInStock, x.LocationRack, x.UnitPrice, x.Status, x.AssignedTechnicianId, x.CreatedAtUtc))
            .ToListAsync(ct);

        if (assigned.Count > 0) return assigned;

        return await db.PlatformHardwareItems.AsNoTracking()
            .OrderBy(x => x.Code)
            .Select(x => new PlatformHardwareItemView(x.Id, x.Code, x.Name, x.Category, x.Model, x.Manufacturer, x.SerialNumber, x.MacAddress, x.QuantityInStock, x.LocationRack, x.UnitPrice, x.Status, x.AssignedTechnicianId, x.CreatedAtUtc))
            .ToListAsync(ct);
    }
}

// ─── Schedule Sync Service ────────────────────────────────────────────────────
public sealed class ScheduleSyncService(SmartFarmDbContext db) : IScheduleSyncService
{
    public async Task<IReadOnlyList<object>> SyncFromCropAsync(Guid ownerId, Guid tenantId, Guid zoneId, Guid cropId, Guid actuatorId, CancellationToken ct)
    {
        // Find growth profile for crop
        var profile = await db.GrowthProfiles.Include(x => x.Stages).AsNoTracking()
            .FirstOrDefaultAsync(x => x.CropId == cropId, ct)
            ?? await db.GrowthProfiles.Include(x => x.Stages).AsNoTracking().FirstOrDefaultAsync(ct);

        var zone = await db.Zones.Include(z => z.Field).ThenInclude(f => f.Farm).SingleOrDefaultAsync(z => z.Id == zoneId, ct)
            ?? throw new ResourceNotFoundException("Zone not found.");

        // Find actuator: use provided actuatorId if exists, otherwise pick first actuator in this zone or in the farm
        var actuator = await db.DeviceActuators.Include(a => a.Device).SingleOrDefaultAsync(x => x.Id == actuatorId, ct);
        if (actuator is null)
        {
            actuator = await db.DeviceActuators.Include(a => a.Device)
                .FirstOrDefaultAsync(x => x.Device.ZoneId == zoneId, ct)
                ?? await db.DeviceActuators.Include(a => a.Device)
                .FirstOrDefaultAsync(x => x.Device.FarmId == zone.Field.FarmId, ct)
                ?? await db.DeviceActuators.FirstOrDefaultAsync(ct);
        }

        if (actuator is null)
        {
            throw new ResourceNotFoundException("No actuator available for this zone or farm.");
        }

        actuatorId = actuator.Id;

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
                Name = $"[AutoSync] {profile?.Name ?? "Lịch tưới Chuẩn"} {h:D2}:{m:D2}",
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

        // Đồng bộ trực tiếp vào bảng alert_rules để Alert Worker quét cảnh báo theo đúng ngưỡng cài đặt ở đây
        var existingRules = await db.AlertRules.Where(r => r.ZoneId == command.ZoneId && r.ArchivedAtUtc == null).ToListAsync(ct);

        // 1. Độ ẩm đất (Tưới khi < Min, Dừng khi > Max)
        var soilRule = existingRules.FirstOrDefault(r => r.ParameterCode == EnvironmentalParameterCode.SoilMoisture);
        if (soilRule != null)
        {
            soilRule.MinThreshold = command.MinSoilMoisture;
            soilRule.MaxThreshold = command.MaxSoilMoisture;
            soilRule.IsActive = true;
        }
        else
        {
            db.AlertRules.Add(new AlertRule
            {
                Id = Guid.NewGuid(),
                ZoneId = command.ZoneId,
                GrowthStageId = activeSeason?.CurrentGrowthStageId ?? Guid.Empty,
                ParameterCode = EnvironmentalParameterCode.SoilMoisture,
                MinThreshold = command.MinSoilMoisture,
                MaxThreshold = command.MaxSoilMoisture,
                Severity = AlertSeverity.Warning,
                CooldownMinutes = 15,
                IsActive = true,
                CreatedAtUtc = DateTime.UtcNow
            });
        }

        // 2. Nhiệt độ tối đa
        var tempRule = existingRules.FirstOrDefault(r => r.ParameterCode == EnvironmentalParameterCode.Temperature);
        if (tempRule != null)
        {
            tempRule.MaxThreshold = command.MaxTemperature;
            tempRule.MinThreshold = 18m;
            tempRule.IsActive = true;
        }
        else
        {
            db.AlertRules.Add(new AlertRule
            {
                Id = Guid.NewGuid(),
                ZoneId = command.ZoneId,
                GrowthStageId = activeSeason?.CurrentGrowthStageId ?? Guid.Empty,
                ParameterCode = EnvironmentalParameterCode.Temperature,
                MinThreshold = 18m,
                MaxThreshold = command.MaxTemperature,
                Severity = AlertSeverity.Critical,
                CooldownMinutes = 15,
                IsActive = true,
                CreatedAtUtc = DateTime.UtcNow
            });
        }

        // 3. Độ ẩm không khí
        var humRule = existingRules.FirstOrDefault(r => r.ParameterCode == EnvironmentalParameterCode.AirHumidity);
        if (humRule != null)
        {
            humRule.MinThreshold = 55m;
            humRule.MaxThreshold = Math.Max(command.TargetHumidity + 15m, 85m);
            humRule.IsActive = true;
        }
        else
        {
            db.AlertRules.Add(new AlertRule
            {
                Id = Guid.NewGuid(),
                ZoneId = command.ZoneId,
                GrowthStageId = activeSeason?.CurrentGrowthStageId ?? Guid.Empty,
                ParameterCode = EnvironmentalParameterCode.AirHumidity,
                MinThreshold = 55m,
                MaxThreshold = Math.Max(command.TargetHumidity + 15m, 85m),
                Severity = AlertSeverity.Warning,
                CooldownMinutes = 15,
                IsActive = true,
                CreatedAtUtc = DateTime.UtcNow
            });
        }

        // 4. Cường độ ánh sáng
        var luxRule = existingRules.FirstOrDefault(r => r.ParameterCode == EnvironmentalParameterCode.LightIntensity);
        if (luxRule != null)
        {
            luxRule.MinThreshold = Math.Max(command.TargetLux - 5000m, 2000m);
            luxRule.MaxThreshold = 65000m;
            luxRule.IsActive = true;
        }
        else
        {
            db.AlertRules.Add(new AlertRule
            {
                Id = Guid.NewGuid(),
                ZoneId = command.ZoneId,
                GrowthStageId = activeSeason?.CurrentGrowthStageId ?? Guid.Empty,
                ParameterCode = EnvironmentalParameterCode.LightIntensity,
                MinThreshold = Math.Max(command.TargetLux - 5000m, 2000m),
                MaxThreshold = 65000m,
                Severity = AlertSeverity.Warning,
                CooldownMinutes = 15,
                IsActive = true,
                CreatedAtUtc = DateTime.UtcNow
            });
        }

        await db.SaveChangesAsync(ct);

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

