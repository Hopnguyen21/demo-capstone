using System.Diagnostics;
using System.Globalization;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SmartFarm.Application.Common.Exceptions;
using SmartFarm.Application.Features.Finance;
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

    public async Task<PlatformHardwareItemView> AssignHardwareItemAsync(Guid id, AssignHardwareItemCommand c, CancellationToken ct)
    {
        var technician = await db.AppUsers.SingleOrDefaultAsync(x => x.Id == c.TechnicianUserId && x.Role == UserRole.PlatformTechnician && x.Status == AccountStatus.Active, ct)
            ?? throw new ResourceNotFoundException("Technician not found.");
        var item = await db.PlatformHardwareItems.SingleOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new ResourceNotFoundException("Hardware item not found.");
        var quantity = c.Quantity;
        if (quantity < 1) throw new RequestValidationException("quantity", "Quantity must be at least 1.");
        var uniqueDevice = item.Category.Contains("GATEWAY", StringComparison.OrdinalIgnoreCase)
            || item.Category.Contains("NODE", StringComparison.OrdinalIgnoreCase);
        if (uniqueDevice && quantity != 1) throw new RequestValidationException("quantity", "Gateway and Node Module quantity must be 1.");
        if (item.AssignedTechnicianId is not null) throw new ResourceConflictException("This hardware item is already assigned to a Technician.");
        if (item.QuantityInStock < quantity) throw new ResourceConflictException($"Only {item.QuantityInStock} items are available in the central warehouse.");

        if (quantity == item.QuantityInStock || uniqueDevice)
        {
            item.AssignedTechnicianId = technician.Id;
            item.Status = "Issued";
        }
        else
        {
            item.QuantityInStock -= quantity;
            var technicianItem = new PlatformHardwareItem
            {
                Code = item.Code,
                Name = item.Name,
                Category = item.Category,
                Model = item.Model,
                Manufacturer = item.Manufacturer,
                QuantityInStock = quantity,
                LocationRack = "Kho Technician",
                UnitPrice = item.UnitPrice,
                Status = "Issued",
                AssignedTechnicianId = technician.Id
            };
            db.PlatformHardwareItems.Add(technicianItem);
        }
        await db.SaveChangesAsync(ct);
        return ToView(item.AssignedTechnicianId == technician.Id ? item : await db.PlatformHardwareItems.AsNoTracking().OrderByDescending(x => x.CreatedAtUtc).FirstAsync(x => x.AssignedTechnicianId == technician.Id && x.Code == item.Code, ct));
    }

    public async Task<PlatformHardwareItemView> ReturnHardwareItemAsync(Guid id, CancellationToken ct)
    {
        var item = await db.PlatformHardwareItems.SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw new ResourceNotFoundException("Hardware item not found.");
        item.AssignedTechnicianId = null;
        item.Status = "Available";
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

    // Chủ trang trại chỉ thao tác service request thuộc Tenant của mình (Tenant lấy từ tài khoản, không từ client).
    private async Task<ServiceRequest> OwnedRequestAsync(Guid ownerId, Guid serviceRequestId, CancellationToken ct)
    {
        var owner = await db.AppUsers.AsNoTracking().SingleOrDefaultAsync(x => x.Id == ownerId && x.Role == UserRole.FarmOwner && x.Status == AccountStatus.Active, ct)
            ?? throw new AuthorizationException("Only an active Farm Owner may sign.");
        var sr = await db.ServiceRequests.Include(x => x.Quotations).ThenInclude(q => q.Items)
            .SingleOrDefaultAsync(x => x.Id == serviceRequestId && x.TenantId == owner.TenantId, ct)
            ?? throw new ResourceNotFoundException("Service Request not found.");
        return sr;
    }

    public async Task<QuotationView?> GetAsync(Guid userId, Guid serviceRequestId, CancellationToken ct)
    {
        var viewer = await db.AppUsers.AsNoTracking().SingleOrDefaultAsync(x => x.Id == userId && x.Status == AccountStatus.Active, ct)
            ?? throw new AuthorizationException();
        var owning = await db.ServiceRequests.AsNoTracking().SingleOrDefaultAsync(x => x.Id == serviceRequestId, ct)
            ?? throw new ResourceNotFoundException("Service Request not found.");
        var visible = viewer.Role switch
        {
            UserRole.PlatformAdmin => true,
            UserRole.PlatformTechnician => owning.AssignedTechnicianId == userId,
            UserRole.FarmOwner => owning.TenantId == viewer.TenantId,
            _ => false
        };
        if (!visible) throw new ResourceNotFoundException("Service Request not found.");
        var q = await db.ServiceRequestQuotations.Include(x => x.Items).AsNoTracking()
            .OrderByDescending(x => x.CreatedAtUtc)
            .FirstOrDefaultAsync(x => x.ServiceRequestId == serviceRequestId, ct);
        return q is null ? null : ToView(q);
    }

    public async Task<ServiceRequestPaymentView> SignContractDepositAsync(Guid ownerId, Guid serviceRequestId, SignContractDepositCommand command, CancellationToken ct)
    {
        var sr = await OwnedRequestAsync(ownerId, serviceRequestId, ct);
        var quotation = sr.Quotations.OrderByDescending(x => x.CreatedAtUtc).FirstOrDefault() ?? throw new ResourceConflictException("No quotation exists for this Service Request.");
        // Chỉ ký được báo giá đang chờ chủ trang trại; không ký lặp (mỗi lần ký sinh khoản thanh toán và hợp đồng Zone).
        if (sr.IsContractSigned || sr.IsDepositPaid || quotation.Status != "SentToOwner")
            throw new ResourceConflictException("Quotation is not awaiting Owner signature, or the contract was already signed.");
        if (string.IsNullOrWhiteSpace(command.SignerFullName) || string.IsNullOrWhiteSpace(command.TransactionReference))
            throw new RequestValidationException("signerFullName", "Signer name and transaction reference are required.");
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
                    VatPercent = quotation.VatPercent,
                    VatAmountVnd = quotation.VatAmount,
                    EquipmentJson = quotation.Items is { Count: > 0 }
                        ? JsonSerializer.Serialize(quotation.Items.Select(i => new ZoneContractEquipmentView(i.HardwareItemCode, i.HardwareItemName, i.Category, i.Unit, i.Quantity, i.UnitPrice)),
                            new JsonSerializerOptions(JsonSerializerDefaults.Web))
                        : null,
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
        var sr = await OwnedRequestAsync(ownerId, serviceRequestId, ct);
        if (!sr.IsDepositPaid) throw new ResourceConflictException("Deposit must be paid before final acceptance.");
        var quotation = sr.Quotations.OrderByDescending(x => x.CreatedAtUtc).FirstOrDefault() ?? throw new ResourceConflictException("No quotation exists.");
        if (sr.IsAcceptanceSigned || sr.IsFullyPaid || quotation.Status != "SignedByOwner")
            throw new ResourceConflictException("Acceptance was already signed, or the contract is not in the signed-deposit state.");
        // Owner nghiệm thu sau khi kỹ thuật viên đã triển khai thực địa.
        // Không yêu cầu DeploymentRequest.Completed ở đây vì Technician's
        // complete action lại yêu cầu Owner nghiệm thu trước; yêu cầu cũ tạo
        // vòng lặp khiến cả hai nút không bao giờ có thể hoàn tất.
        var deploymentStatus = await db.DeploymentRequests.AsNoTracking().Where(x => x.Id == sr.DeploymentRequestId).Select(x => (DeploymentRequestStatus?)x.Status).SingleOrDefaultAsync(ct);
        if (deploymentStatus is not (DeploymentRequestStatus.Installing or DeploymentRequestStatus.Completed))
            throw new ResourceConflictException("Final acceptance requires the linked deployment request to be Installing or Completed.");
        if (string.IsNullOrWhiteSpace(command.SignerFullName) || string.IsNullOrWhiteSpace(command.TransactionReference))
            throw new RequestValidationException("signerFullName", "Signer name and transaction reference are required.");
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
        // Phải có quyền với đúng Zone này (Owner cùng Tenant, Admin, hoặc Technician được giao Zone); không còn nhánh dự phòng lấy Zone/Farm/thiết bị bất kỳ.
        var zone = await EnsureZoneAccessAsync(technicianId, zoneId, write: true, ct);
        var farmId = zone.Field.FarmId;
        ServiceRequest? srCheck = null;
        if (command.ServiceRequestId.HasValue)
        {
            srCheck = await db.ServiceRequests.FirstOrDefaultAsync(x => x.Id == command.ServiceRequestId.Value && x.ZoneId == zoneId && x.TenantId == zone.Field.Farm.TenantId, ct);
        }

        var depReq = command.DeploymentRequestId.HasValue
            ? await db.DeploymentRequests.FirstOrDefaultAsync(r => r.Id == command.DeploymentRequestId.Value, ct)
            : (srCheck?.DeploymentRequestId is Guid requestId && requestId != Guid.Empty
                ? await db.DeploymentRequests.FirstOrDefaultAsync(r => r.Id == requestId, ct)
                : await db.DeploymentRequests.FirstOrDefaultAsync(r => r.ZoneId == zoneId && r.TechnicianUserId == technicianId, ct));

        // A technician can be assigned either on the deployment request or on
        // the linked service request. Older installation records populated
        // only ServiceRequest.AssignedTechnicianId, so accepting only the
        // deployment field incorrectly returned 403 for valid GIS mappings.
        // For FarmOwner / PlatformAdmin, zone access has already been verified by EnsureZoneAccessAsync.
        var caller = await db.AppUsers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == technicianId, ct);
        var isPlatformOrOwner = caller?.Role is UserRole.PlatformAdmin or UserRole.FarmOwner;

        if (!isPlatformOrOwner)
        {
            var technicianOwnsRequest = depReq is not null &&
                (depReq.TechnicianUserId == technicianId || srCheck?.AssignedTechnicianId == technicianId);
            if (depReq is null || depReq.ZoneId != zoneId || depReq.FarmId != farmId || !technicianOwnsRequest)
                throw new AuthorizationException("The GIS update must belong to the Technician's Deployment Request for this Zone.");
        }
        // GIS placement is an explicit technician mapping workflow. The UI
        // allows drafting/correcting node positions before later deployment
        // lifecycle transitions, so status is intentionally not a blocker;
        // the strict Technician/Zone/Farm ownership checks above remain the
        // authorization boundary.

        var deviceIds = command.Nodes.Select(n => n.DeviceId).ToList();
        var devices = await db.Devices.Where(x => deviceIds.Contains(x.Id) && x.FarmId == farmId).ToListAsync(ct);

        foreach (var node in command.Nodes)
        {
            var device = devices.FirstOrDefault(d => d.Id == node.DeviceId);
            if (device == null && !string.IsNullOrWhiteSpace(node.HardwareAddress))
            {
                device = await db.Devices.FirstOrDefaultAsync(d => d.HardwareAddress == node.HardwareAddress && d.FarmId == farmId, ct);
            }

            if (device is null)
                throw new ResourceNotFoundException($"Device '{node.DeviceId}' was not provisioned.");
            if (node.Latitude is < -90 or > 90 || node.Longitude is < -180 or > 180 || (node.Latitude == 0 && node.Longitude == 0))
                throw new RequestValidationException("nodes", "Node coordinates must be valid and cannot be 0,0.");
            if ((depReq is not null && device.DeploymentRequestId != depReq.Id) || device.FarmId != farmId)
                throw new AuthorizationException("Device does not belong to this Deployment Request.");
            device.ZoneId = zoneId;
            device.GpsLatitude = node.Latitude;
            device.GpsLongitude = node.Longitude;
            if (node.BatteryLevel.HasValue) device.BatteryLevel = node.BatteryLevel;
            if (node.Rssi.HasValue) device.Rssi = node.Rssi;
            if (!string.IsNullOrWhiteSpace(node.InstallationNotes) || !string.IsNullOrWhiteSpace(node.DeviceName))
                device.InstallationNotes = node.InstallationNotes ?? node.DeviceName;
            if (device.Status == DeviceStatus.Unassigned) device.Status = DeviceStatus.Assigned;
            db.DeviceAssignmentHistory.Add(new DeviceAssignmentHistory { DeviceId = device.Id, ZoneId = zoneId, TechnicianUserId = technicianId, Action = "Mapped", Notes = $"source={node.LocationSource ?? "ApproximateMap"}; {device.InstallationNotes}" });
        }

        if (srCheck != null)
        {
            srCheck.ZoneId = zone.Id;
            if (srCheck.Status == ServiceRequestStatus.Assigned)
            {
                srCheck.Status = ServiceRequestStatus.InProgress;
            }
        }

        await db.SaveChangesAsync(ct);
    }

    /// <summary>Quyền với Zone: Admin tất cả; Owner/Farmer đúng Tenant (Farmer phải được giao Zone, chỉ đọc); Technician chỉ Zone mình được giao triển khai/yêu cầu dịch vụ.</summary>
    private async Task<Zone> EnsureZoneAccessAsync(Guid userId, Guid zoneId, bool write, CancellationToken ct)
    {
        var caller = await db.AppUsers.AsNoTracking().SingleOrDefaultAsync(x => x.Id == userId && x.Status == AccountStatus.Active, ct)
            ?? throw new AuthorizationException();
        var zone = await db.Zones.Include(z => z.Field).ThenInclude(f => f.Farm).AsNoTracking().FirstOrDefaultAsync(z => z.Id == zoneId, ct)
            ?? throw new ResourceNotFoundException("Zone was not found.");
        var allowed = caller.Role switch
        {
            UserRole.PlatformAdmin => true,
            UserRole.FarmOwner => caller.TenantId == zone.Field.Farm.TenantId,
            UserRole.Farmer => !write && caller.TenantId == zone.Field.Farm.TenantId
                && await db.UserZoneAccesses.AnyAsync(a => a.AppUserId == userId && a.ZoneId == zoneId, ct),
            UserRole.PlatformTechnician => await db.DeploymentRequests.AnyAsync(r => r.ZoneId == zoneId && r.TechnicianUserId == userId, ct)
                || await db.ServiceRequests.AnyAsync(r => r.ZoneId == zoneId && r.AssignedTechnicianId == userId, ct),
            _ => false
        };
        if (!allowed) throw new ResourceNotFoundException("Zone was not found.");
        return zone;
    }

    public async Task<IReadOnlyList<DeviceMapLocationView>> GetMapLocationsAsync(Guid userId, Guid zoneId, CancellationToken ct)
    {
        await EnsureZoneAccessAsync(userId, zoneId, write: false, ct);
        // ZoneId means the device is assigned to the zone; it does not mean it
        // has been pinned on GIS. Only a pair of persisted coordinates is a map
        // placement.
        return await db.Devices.AsNoTracking().Where(x => x.ZoneId == zoneId && !x.HardwareAddress.StartsWith("SIM-") && x.GpsLatitude.HasValue && x.GpsLongitude.HasValue && x.Status != DeviceStatus.Decommissioned && (x.DeviceType == DeviceType.SensorNode || x.DeviceType == DeviceType.ActuatorNode))
            .Select(x => new DeviceMapLocationView(
                x.Id, 
                x.HardwareAddress, 
                x.DeviceType.ToString(), 
                x.GpsLatitude, 
                x.GpsLongitude, 
                x.BatteryLevel, 
                x.Rssi, 
                x.Status.ToString(),
                x.InstallationNotes ?? (x.DeviceType == DeviceType.ActuatorNode ? "Cụm Van/Bơm Điều khiển" : "Node Cảm biến Vi khí hậu")
            ))
            .ToListAsync(ct);
    }
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
        var weatherCaller = await db.AppUsers.AsNoTracking().SingleOrDefaultAsync(x => x.Id == userId && x.Status == AccountStatus.Active, ct)
            ?? throw new AuthorizationException();
        var farm = await db.Farms.AsNoTracking().SingleOrDefaultAsync(x => x.Id == farmId && (weatherCaller.Role == UserRole.PlatformAdmin || x.TenantId == weatherCaller.TenantId), ct)
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
        var query = db.FarmTasks.AsNoTracking().Include(x => x.Zone).Include(x => x.Assignments).AsQueryable();

        if (caller != null && caller.Role != UserRole.Farmer)
        {
            if (caller.TenantId.HasValue)
                query = query.Where(x => x.TenantId == caller.TenantId.Value && x.Status != FarmTaskStatus.Cancelled);
            else
                query = query.Where(x => x.Status != FarmTaskStatus.Cancelled);
        }
        else
        {
            query = query.Where(x => x.Assignments.Any(a => a.FarmerId == farmerId && a.Status != FarmTaskStatus.Cancelled));
        }

        var list = await query.OrderBy(x => x.DueAtUtc).ToListAsync(ct);
        return list.Select(x => (object)new {
            Id = x.Id,
            TaskId = x.Id,
            Title = x.Title,
            Description = x.Description,
            // Farmer thấy trạng thái phân công của chính mình; Owner thấy trạng thái tổng hợp.
            Status = (caller != null && caller.Role == UserRole.Farmer
                ? x.Assignments.Where(a => a.FarmerId == farmerId).Select(a => a.Status).FirstOrDefault()
                : x.Status).ToString(),
            DueDate = x.DueAtUtc,
            DueAtUtc = x.DueAtUtc,
            ZoneName = x.Zone != null ? x.Zone.Name : null,
            CreatedAtUtc = x.CreatedAtUtc
        }).ToList();
    }

    public async Task CompleteTaskAsync(Guid farmerId, Guid taskId, FarmerCompleteTaskCommand command, CancellationToken ct)
    {
        var task = await db.FarmTasks.Include(x => x.Assignments).SingleOrDefaultAsync(x => x.Id == taskId && x.Assignments.Any(a => a.FarmerId == farmerId && a.Status != FarmTaskStatus.Cancelled), ct)
            ?? throw new ResourceNotFoundException("Task not found or not assigned to you.");
        var mine = task.Assignments.Single(a => a.FarmerId == farmerId);
        if (mine.Status is not (FarmTaskStatus.Pending or FarmTaskStatus.Accepted or FarmTaskStatus.InProgress))
            throw new ResourceConflictException("Task cannot be completed in its current state.");
        var prevStatus = mine.Status;
        var now = DateTime.UtcNow;
        // Chỉ phân công của chính Farmer này đổi trạng thái; trạng thái công việc được tổng hợp lại từ mọi phân công.
        mine.AcceptedAtUtc ??= now; mine.StartedAtUtc ??= now;
        mine.Status = FarmTaskStatus.CompletedPendingReview;
        mine.Result = command.ResultNotes;
        mine.ProgressPercent = 100;
        mine.SubmittedAtUtc = now;
        task.Status = SmartFarm.Application.Features.Inventory.FarmTaskAggregate.Compute(task.Assignments);
        var hist = new FarmTaskHistory
        {
            FarmTaskId = task.Id,
            ActorUserId = farmerId,
            EventType = FarmTaskEventType.Completed,
            FromStatus = prevStatus,
            ToStatus = FarmTaskStatus.CompletedPendingReview,
            SubjectFarmerId = farmerId,
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
        var zone = await db.Zones.Include(z => z.Field).ThenInclude(f => f.Farm).SingleOrDefaultAsync(z => z.Id == zoneId, ct)
            ?? throw new ResourceNotFoundException("Không tìm thấy Khu vực canh tác (Zone).");

        var caller = await db.AppUsers.AsNoTracking().SingleOrDefaultAsync(x => x.Id == ownerId, ct)
            ?? throw new AuthorizationException();
        if (caller.Role != UserRole.PlatformAdmin)
        {
            // Tenant lấy từ token phải khớp cả tài khoản lẫn chuỗi Farm → Zone; Farmer cần được cấp quyền vào zone.
            if (tenantId == Guid.Empty || caller.TenantId != tenantId || zone.Field.Farm.TenantId != tenantId)
                throw new AuthorizationException("Bạn không có quyền truy cập vào Khu vực canh tác này.");
            if (caller.Role == UserRole.Farmer &&
                !await db.UserZoneAccesses.AnyAsync(x => x.AppUserId == ownerId && x.ZoneId == zoneId, ct))
                throw new AuthorizationException("Bạn không có quyền truy cập vào Khu vực canh tác này.");
        }
        // PlatformAdmin không thuộc tenant: tra cứu cây/profile theo tenant sở hữu zone.
        tenantId = zone.Field.Farm.TenantId;

        var crop = await db.Crops.AsNoTracking().SingleOrDefaultAsync(c => c.Id == cropId && (c.TenantId == null || c.TenantId == tenantId), ct)
            ?? throw new ResourceNotFoundException("Không tìm thấy cây trồng yêu cầu đồng bộ.");

        // Tìm đúng Hồ sơ sinh trưởng của cây trồng này (ưu tiên theo tenant hoặc system profile) - KHÔNG fallback bừa cây khác
        var profile = await db.GrowthProfiles.Include(x => x.Stages).AsNoTracking()
            .Where(x => x.CropId == cropId && (x.TenantId == tenantId || (x.TenantId == null && x.IsSystemDefined)))
            .OrderByDescending(x => x.TenantId == tenantId)
            .ThenByDescending(x => x.IsDefault)
            .FirstOrDefaultAsync(ct);

        if (profile is null)
        {
            throw new ResourceConflictException($"Chưa cấu hình Hồ sơ sinh trưởng (Growth Profile) cho cây '{crop.Name}'. Vui lòng tạo Profile trước khi đồng bộ lịch tưới.");
        }

        // Tìm thiết bị Actuator: BẮT BUỘC phải nằm trong CHÍNH ZONE ĐÓ - KHÔNG fallback sang Farm khác
        DeviceActuator? actuator = null;
        if (actuatorId != Guid.Empty)
        {
            actuator = await db.DeviceActuators.Include(a => a.Device)
                .SingleOrDefaultAsync(x => x.Id == actuatorId && x.Device.ZoneId == zoneId, ct);
        }

        actuator ??= await db.DeviceActuators.Include(a => a.Device)
            .FirstOrDefaultAsync(x => x.Device.ZoneId == zoneId && (
                x.ActuatorType.Contains("pump") || x.ActuatorType.Contains("Pump") ||
                x.ActuatorType.Contains("valve") || x.ActuatorType.Contains("Valve") ||
                x.ActuatorType.Contains("water") || x.ActuatorType.Contains("Water") ||
                x.ActuatorType.Contains("irrigation") || x.ActuatorType.Contains("Irrigation")), ct);

        if (actuator is null)
        {
            throw new ResourceConflictException($"Khu vực '{zone.Name}' chưa có thiết bị van hoặc máy bơm tưới (Actuator). Vui lòng cấu hình thiết bị trước khi đồng bộ lịch.");
        }

        actuatorId = actuator.Id;

        // Remove old synced schedules for this zone+actuator
        var existing = await db.ControlSchedules.Where(x => x.ZoneId == zoneId && x.ActuatorId == actuatorId && x.Name.StartsWith("[AutoSync]")).ToListAsync(ct);
        db.ControlSchedules.RemoveRange(existing);

        // Lịch tưới lấy từ "Lịch tưới mẫu" của cây trong thư viện (Crop.CalendarIrrigationPlan); cây chưa có thì không tự bịa giờ tưới.
        var sessions = CropIrrigationPlanReader.ReadDailySessions(crop.CalendarIrrigationPlan, crop.Name);
        var created = new List<ControlSchedule>();
        foreach (var session in sessions)
        {
            var cs = new ControlSchedule
            {
                TenantId = zone.Field.Farm.TenantId,
                FarmId = zone.Field.FarmId,
                ZoneId = zoneId,
                ActuatorId = actuatorId,
                Name = $"[AutoSync] {crop.Name} {session.Title} {session.Hour:D2}:{session.Minute:D2}",
                // Cron 5 trường (phút giờ ngày tháng thứ); bộ chạy lịch chỉ hỗ trợ chạy hằng ngày vào một giờ cố định.
                CronExpression = $"{session.Minute} {session.Hour} * * *",
                DurationSeconds = session.DurationSeconds,
                EnableRainDelay = true,
                RainThresholdPercent = 70,
                IsActive = true,
                NextRunAtUtc = NextDailyRunUtc(session.Hour, session.Minute, zone.Field.Farm.TimeZone)
            };
            created.Add(cs);
            db.ControlSchedules.Add(cs);
        }
        await db.SaveChangesAsync(ct);
        return created.Select(x => (object)new { x.Id, x.Name, x.CronExpression, x.DurationSeconds, x.IsActive }).ToList();
    }

    /// <summary>Lần chạy kế tiếp (UTC) của lịch hằng ngày lúc giờ:phút theo múi giờ của Farm.</summary>
    private static DateTime NextDailyRunUtc(int hour, int minute, string timeZoneId)
    {
        TimeZoneInfo tz;
        try { tz = TimeZoneInfo.FindSystemTimeZoneById(timeZoneId); } catch (Exception ex) when (ex is TimeZoneNotFoundException or InvalidTimeZoneException) { tz = TimeZoneInfo.Utc; }
        var nowLocal = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);
        var next = nowLocal.Date.AddHours(hour).AddMinutes(minute);
        if (next <= nowLocal) next = next.AddDays(1);
        return TimeZoneInfo.ConvertTimeToUtc(next, tz);
    }
}

/// <summary>Đọc "Lịch tưới mẫu" (JSON) của cây trong thư viện thành các ca tưới hằng ngày hợp lệ.</summary>
internal static class CropIrrigationPlanReader
{
    internal sealed record Session(string Title, int Hour, int Minute, int DurationSeconds);

    /// <summary>Tối đa 30 phút mỗi lần (giới hạn phần cứng của hệ thống điều khiển).</summary>
    internal const int MaxDurationSeconds = 1800;

    internal static IReadOnlyList<Session> ReadDailySessions(string? planJson, string cropName)
    {
        if (string.IsNullOrWhiteSpace(planJson))
            throw new ResourceConflictException($"Cây '{cropName}' chưa có Lịch tưới mẫu trong thư viện cây trồng. Hãy nhập lịch tưới cho cây trước khi đồng bộ.");
        System.Text.Json.JsonElement root;
        try { root = System.Text.Json.JsonDocument.Parse(planJson).RootElement; }
        catch (System.Text.Json.JsonException) { throw new ResourceConflictException($"Lịch tưới mẫu của cây '{cropName}' không đọc được; hãy lưu lại lịch trong thư viện cây trồng."); }

        string Text(System.Text.Json.JsonElement e, string name) => e.ValueKind == System.Text.Json.JsonValueKind.Object &&
            e.EnumerateObject().FirstOrDefault(p => string.Equals(p.Name, name, StringComparison.OrdinalIgnoreCase)) is { Value: var v } && v.ValueKind != System.Text.Json.JsonValueKind.Undefined
            ? (v.ValueKind == System.Text.Json.JsonValueKind.String ? v.GetString() ?? string.Empty : v.ToString())
            : string.Empty;

        // Bộ chạy lịch chỉ lặp hằng ngày; không biến lịch cách ngày/theo thứ thành lịch hằng ngày vì sẽ tưới thừa.
        var repeat = Text(root, "repeatType");
        if (repeat.Length > 0 && !string.Equals(repeat, "DAILY", StringComparison.OrdinalIgnoreCase))
            throw new ResourceConflictException($"Lịch tưới mẫu của cây '{cropName}' lặp kiểu '{repeat}', còn hệ thống điều khiển hiện chỉ hỗ trợ lịch hằng ngày. Hãy đổi lịch mẫu sang lặp hằng ngày.");

        var result = new List<Session>();
        if (root.ValueKind == System.Text.Json.JsonValueKind.Object &&
            root.EnumerateObject().FirstOrDefault(p => string.Equals(p.Name, "sessions", StringComparison.OrdinalIgnoreCase)) is { Value: { ValueKind: System.Text.Json.JsonValueKind.Array } sessions })
        {
            foreach (var item in sessions.EnumerateArray())
            {
                if (string.Equals(Text(item, "enabled"), "false", StringComparison.OrdinalIgnoreCase)) continue;
                var time = Text(item, "startTime").Split(':');
                if (time.Length != 2 || !int.TryParse(time[0], out var hour) || !int.TryParse(time[1], out var minute) || hour is < 0 or > 23 || minute is < 0 or > 59)
                    throw new ResourceConflictException($"Giờ bắt đầu của một ca tưới trong lịch mẫu của cây '{cropName}' không hợp lệ (cần dạng HH:mm).");
                if (!double.TryParse(Text(item, "durationMinutes"), System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var minutes) || minutes <= 0)
                    throw new ResourceConflictException($"Thời lượng tưới của một ca trong lịch mẫu của cây '{cropName}' không hợp lệ.");
                var seconds = (int)Math.Round(minutes * 60);
                if (seconds > MaxDurationSeconds)
                    throw new ResourceConflictException($"Một ca tưới trong lịch mẫu của cây '{cropName}' dài {minutes:0.#} phút, vượt giới hạn 30 phút mỗi lần.");
                var title = Text(item, "title");
                if (string.IsNullOrWhiteSpace(title)) title = Text(item, "session") switch { "MORNING" => "Sáng", "NOON" => "Trưa", "AFTERNOON" => "Chiều", var other => other };
                result.Add(new Session(title.Trim(), hour, minute, seconds));
            }
        }
        if (result.Count == 0)
            throw new ResourceConflictException($"Lịch tưới mẫu của cây '{cropName}' chưa có ca tưới nào được bật.");
        return result;
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
        // Luôn giới hạn trong Tenant của người gọi (kể cả khi chỉ định Zone), và Farmer chỉ dừng được Zone mình được quyền điều khiển.
        if (caller is null) throw new AuthorizationException();
        if (caller.Role != UserRole.PlatformAdmin)
        {
            actuatorsQuery = actuatorsQuery.Where(a => a.Device.Farm.TenantId == effectiveTenantId);
            if (caller.Role == UserRole.Farmer)
                actuatorsQuery = actuatorsQuery.Where(a => db.UserZoneAccesses.Any(z => z.AppUserId == userId && z.ZoneId == a.Device.ZoneId && z.CanControl));
        }
        if (zoneId.HasValue)
        {
            actuatorsQuery = actuatorsQuery.Where(a => a.Device.ZoneId == zoneId.Value);
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
        var caller = await db.AppUsers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == userId, ct)
            ?? throw new AuthorizationException();
        var effectiveTenantId = (caller.TenantId != null && caller.TenantId != Guid.Empty)
            ? caller.TenantId.Value
            : tenantId;

        var zonesQuery = db.Zones.Include(z => z.Field).ThenInclude(f => f.Farm).AsNoTracking();
        if (zoneId.HasValue)
        {
            zonesQuery = zonesQuery.Where(z => z.Id == zoneId.Value);
        }

        // Ngoài PlatformAdmin, luôn giới hạn theo tenant/farm của người gọi — kể cả khi truyền zoneId.
        if (caller.Role != UserRole.PlatformAdmin)
        {
            if (effectiveTenantId != Guid.Empty)
            {
                zonesQuery = zonesQuery.Where(z => z.Field.Farm.TenantId == effectiveTenantId);
            }
            else if (caller.FarmId != null && caller.FarmId != Guid.Empty)
            {
                zonesQuery = zonesQuery.Where(z => z.Field.FarmId == caller.FarmId.Value);
            }
            else
            {
                return [];
            }

            if (caller.Role == UserRole.Farmer)
            {
                zonesQuery = zonesQuery.Where(z => db.UserZoneAccesses.Any(a => a.AppUserId == userId && a.ZoneId == z.Id));
            }
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

        // Sửa ngưỡng ảnh hưởng trực tiếp tới tưới tự động: chỉ PlatformAdmin, Owner cùng Tenant, hoặc Farmer được quyền điều khiển Zone này.
        var envCaller = await db.AppUsers.AsNoTracking().SingleOrDefaultAsync(x => x.Id == userId && x.Status == AccountStatus.Active, ct)
            ?? throw new AuthorizationException();
        var envAllowed = envCaller.Role switch
        {
            UserRole.PlatformAdmin => true,
            UserRole.FarmOwner => envCaller.TenantId == zone.Field.Farm.TenantId,
            UserRole.Farmer => envCaller.TenantId == zone.Field.Farm.TenantId
                && await db.UserZoneAccesses.AnyAsync(x => x.AppUserId == userId && x.ZoneId == zone.Id && x.CanControl, ct),
            _ => false
        };
        if (!envAllowed) throw new ResourceNotFoundException("Zone not found.");

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

