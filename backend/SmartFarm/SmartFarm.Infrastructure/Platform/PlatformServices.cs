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
using SmartFarm.Infrastructure.CropGrowth;
using SmartFarm.Infrastructure.Inventory;
using SmartFarm.Infrastructure.Ai.Knowledge;
using SmartFarm.Infrastructure.Identity;
using SmartFarm.Infrastructure.Persistence;

namespace SmartFarm.Infrastructure.Platform;

// ─── Platform Admin Service ───────────────────────────────────────────────────
public sealed class PlatformAdminService(
    SmartFarmDbContext db,
    IOptions<SmartFarm.Infrastructure.Identity.JwtOptions>? jwt = null,
    IOptions<GeminiOptions>? gemini = null,
    IOptions<SmartFarm.Infrastructure.Ai.Knowledge.GeminiEmbeddingOptions>? embedding = null) : IPlatformAdminService
{
    private string SigningKey => jwt?.Value.SigningKey ?? string.Empty;

    /// <summary>Giá trị Admin xem được: khoá bí mật luôn bị che (chỉ 4 ký tự cuối), không bao giờ trả khoá thật qua API.</summary>
    private const int MaxGeminiKeys = 10;

    /// <summary>Danh sách khoá mới từ màn hình: mục đã che (****abcd) giữ lại khoá đang lưu tương ứng, mục thường là khoá mới. Trả mảng JSON đã mã hoá ("" nếu rỗng).</summary>
    private string BuildKeyList(string? storedEncrypted, string? submittedJson)
    {
        List<string> submitted;
        try { submitted = JsonSerializer.Deserialize<List<string>>(string.IsNullOrWhiteSpace(submittedJson) ? "[]" : submittedJson) ?? []; }
        catch (JsonException) { throw new RequestValidationException(PlatformSettingKeys.GeminiApiKeys, "Danh sách khoá phải là mảng JSON các chuỗi."); }
        var current = GeminiRuntimeSettings.ReadKeyList(storedEncrypted, SigningKey);
        var result = new List<string>();
        foreach (var raw in submitted.Select(x => (x ?? string.Empty).Trim()).Where(x => x.Length > 0))
        {
            if (SecretProtector.LooksMasked(raw))
            {
                var kept = current.FirstOrDefault(k => SecretProtector.Mask(k) == raw && !result.Contains(k))
                    ?? throw new RequestValidationException(PlatformSettingKeys.GeminiApiKeys, "Một khoá đã lưu không còn khớp, hãy tải lại trang rồi thử lại.");
                result.Add(kept);
                continue;
            }
            if (raw.Length < 20 || raw.Any(char.IsWhiteSpace))
                throw new RequestValidationException(PlatformSettingKeys.GeminiApiKeys, "Khoá API không hợp lệ (tối thiểu 20 ký tự, không có khoảng trắng).");
            if (!result.Contains(raw)) result.Add(raw);
        }
        if (result.Count > MaxGeminiKeys)
            throw new RequestValidationException(PlatformSettingKeys.GeminiApiKeys, $"Tối đa {MaxGeminiKeys} khoá.");
        if (result.Count == 0) return string.Empty;
        if (SigningKey.Length < 32)
            throw new RequestValidationException(PlatformSettingKeys.GeminiApiKeys, "Chưa cấu hình Jwt:SigningKey nên không thể mã hoá khoá API để lưu.");
        return SecretProtector.Protect(JsonSerializer.Serialize(result), SigningKey);
    }

    private string DisplayValue(PlatformSetting x)
    {
        if (!x.IsSecret && !PlatformSettingsStore.IsSecretKey(x.Key)) return x.Value;
        if (string.IsNullOrEmpty(x.Value)) return x.Key == PlatformSettingKeys.GeminiApiKeys ? "[]" : string.Empty;
        if (x.Key == PlatformSettingKeys.GeminiApiKeys)
            return JsonSerializer.Serialize(GeminiRuntimeSettings.ReadKeyList(x.Value, SigningKey).Select(SecretProtector.Mask));
        var plain = SecretProtector.IsProtected(x.Value) ? SecretProtector.TryUnprotect(x.Value, SigningKey) : x.Value;
        return plain is null ? string.Empty : SecretProtector.Mask(plain);
    }

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
        await PlatformSettingsStore.EnsureDefaultsAsync(db, ct);
        var settings = await db.PlatformSettings.AsNoTracking().OrderBy(x => x.Group).ThenBy(x => x.Key).ToListAsync(ct);
        return settings.Select(x => new PlatformSettingView(x.Key, DisplayValue(x), x.Group, x.DataType, x.Description, x.IsSecret, x.UpdatedAtUtc)).ToList();
    }

    public async Task<BusinessParametersView> GetBusinessParametersAsync(CancellationToken ct) => new(
        await PlatformSettingsStore.GetDecimalAsync(db, PlatformSettingKeys.DepositPercent, ct),
        await PlatformSettingsStore.GetDecimalAsync(db, PlatformSettingKeys.RainGuardThresholdPercent, ct),
        await PlatformSettingsStore.GetDecimalAsync(db, PlatformSettingKeys.RepeatPurchaseDiscountPercent, ct),
        await PlatformSettingsStore.GetDecimalAsync(db, PlatformSettingKeys.RenewalDiscountPercent, ct));

    public async Task<IReadOnlyList<PlatformSettingView>> UpdateSettingsAsync(IReadOnlyList<UpdatePlatformSettingItem> updates, Guid updatedByUserId, CancellationToken ct)
    {
        var actor = await db.AppUsers.AsNoTracking().SingleOrDefaultAsync(x => x.Id == updatedByUserId, ct);
        var geminiTouched = false;
        foreach (var rawUpdate in updates)
        {
            var update = rawUpdate;
            var isSecretKey = PlatformSettingsStore.IsSecretKey(update.Key);
            if (update.Key == PlatformSettingKeys.GeminiApiKeys)
            {
                var stored = await db.PlatformSettings.AsNoTracking().Where(x => x.Key == update.Key).Select(x => x.Value).SingleOrDefaultAsync(ct);
                update = new UpdatePlatformSettingItem(update.Key, BuildKeyList(stored, update.Value));
                geminiTouched = true;
            }
            else if (isSecretKey)
            {
                var plain = (update.Value ?? string.Empty).Trim();
                // Màn hình gửi lại chuỗi đã che khi Admin không sửa ô khoá: giữ nguyên khoá đang lưu.
                if (plain.Length > 0 && SecretProtector.LooksMasked(plain)) continue;
                if (plain.Length > 0)
                {
                    if (plain.Length < 20 || plain.Any(char.IsWhiteSpace))
                        throw new RequestValidationException(update.Key, "Khoá API không hợp lệ (tối thiểu 20 ký tự, không có khoảng trắng).");
                    if (SigningKey.Length < 32)
                        throw new RequestValidationException(update.Key, "Chưa cấu hình Jwt:SigningKey nên không thể mã hoá khoá API để lưu.");
                    plain = SecretProtector.Protect(plain, SigningKey);
                }
                update = new UpdatePlatformSettingItem(update.Key, plain);
                geminiTouched = true;
            }
            else if (update.Key == PlatformSettingKeys.GeminiModel)
            {
                var model = (update.Value ?? string.Empty).Trim();
                if (model.Length > 0 && !System.Text.RegularExpressions.Regex.IsMatch(model, @"^[A-Za-z0-9._\-]{1,80}$"))
                    throw new RequestValidationException(update.Key, "Tên model chỉ gồm chữ, số, '.', '-', '_' (tối đa 80 ký tự).");
                update = new UpdatePlatformSettingItem(update.Key, model);
                geminiTouched = true;
            }
            var def = PlatformSettingsStore.Find(update.Key);
            if (def is not null && !PlatformSettingsStore.TryParse(def, update.Value, out _))
                throw new RequestValidationException(update.Key, $"Giá trị phải là số trong khoảng {def.Min.ToString(CultureInfo.InvariantCulture)} – {def.Max.ToString(CultureInfo.InvariantCulture)}{(def.DataType == "Integer" ? " (số nguyên)" : "")}.");
            var existing = await db.PlatformSettings.SingleOrDefaultAsync(x => x.Key == update.Key, ct);
            var oldValue = existing?.Value;
            db.AuditLogs.Add(new AuditLog
            {
                ActorUserId = updatedByUserId, ActorName = actor?.FullName ?? "Admin", ActorRole = actor?.Role.ToString() ?? "PlatformAdmin",
                Action = "PLATFORM_SETTING_UPDATED", EntityName = "PlatformSetting", EntityId = update.Key,
                Details = (isSecretKey || (existing?.IsSecret ?? false)) ? "Đã đổi giá trị cấu hình bí mật." : $"{update.Key}: '{oldValue ?? "(mới)"}' → '{update.Value}'",
                CreatedAtUtc = DateTime.UtcNow
            });
            if (existing is null)
            {
                db.PlatformSettings.Add(new PlatformSetting { Key = update.Key, Value = update.Value, Group = isSecretKey || update.Key == PlatformSettingKeys.GeminiModel ? "Ai" : "Custom", DataType = "String", IsSecret = isSecretKey, UpdatedByUserId = updatedByUserId, UpdatedAtUtc = DateTime.UtcNow });
            }
            else
            {
                existing.Value = update.Value;
                if (isSecretKey) existing.IsSecret = true;
                existing.UpdatedByUserId = updatedByUserId;
                existing.UpdatedAtUtc = DateTime.UtcNow;
            }
        }
        await db.SaveChangesAsync(ct);
        // Khoá/model Gemini mới có hiệu lực ngay, không cần khởi động lại backend.
        if (geminiTouched && gemini is not null)
            await GeminiRuntimeSettings.ApplyAsync(db, SigningKey, gemini.Value, embedding?.Value, null, ct);
        return await GetSettingsAsync(ct);
    }

    public async Task<IReadOnlyList<PlatformHardwareItemView>> ListHardwareItemsAsync(CancellationToken ct) =>
        (await db.PlatformHardwareItems.AsNoTracking().OrderBy(x => x.Code).ToListAsync(ct))
            .Select(ToView).ToList();

    public async Task<PlatformHardwareItemView> CreateHardwareItemAsync(CreateHardwareItemCommand c, CancellationToken ct)
    {
        ValidateHardwareIdentity(c.Category, c.SerialNumber, c.MacAddress);
        if (await db.PlatformHardwareItems.AnyAsync(x => x.Code == c.Code, ct))
            throw new ResourceConflictException($"Hardware item with code '{c.Code}' already exists.");
        if (c.DeviceModelDefinitionId.HasValue && !await db.DeviceModelDefinitions.AnyAsync(x => x.Id == c.DeviceModelDefinitionId && x.IsActive, ct)) throw new RequestValidationException("deviceModelDefinitionId", "Model thiết bị không hợp lệ.");
        ValidatePrice(c.UnitPrice);
        var role = NormalizeEstimateRole(c.EstimateRole);
        var units = ValidateEstimateUnits(c.EstimateUnits ?? 1);
        var measured = NormalizeMeasured(c.MeasuredParameters, role);

        var isGateway = c.Category.Contains("GATEWAY", StringComparison.OrdinalIgnoreCase);
        if (isGateway)
        {
            if (string.IsNullOrWhiteSpace(c.MacAddress))
                throw new RequestValidationException("macAddress", "Gateway requires a valid MAC address.");

            var cleanMac = c.MacAddress.Replace(":", "").Replace("-", "").Trim().ToUpperInvariant();
            if (cleanMac.Length != 12 || !System.Text.RegularExpressions.Regex.IsMatch(cleanMac, "^[0-9A-F]{12}$"))
                throw new RequestValidationException("macAddress", "Gateway MAC address format is invalid (must be 12 hexadecimal characters).");

            var formattedMac = string.Join(":", Enumerable.Range(0, 6).Select(i => cleanMac.Substring(i * 2, 2)));
            var macExists = await db.PlatformHardwareItems.AnyAsync(x => x.MacAddress != null && x.MacAddress.Replace(":", "").Replace("-", "").ToUpper() == cleanMac, ct);
            if (macExists)
                throw new ResourceConflictException($"Gateway with MAC address '{formattedMac}' already exists in inventory.");
        }

        var item = new PlatformHardwareItem
        {
            DeviceModelDefinitionId = c.DeviceModelDefinitionId,
            Code = c.Code,
            Name = c.Name,
            Category = c.Category,
            Model = c.Model,
            Manufacturer = c.Manufacturer,
            SerialNumber = c.SerialNumber,
            MacAddress = c.MacAddress,
            QuantityInStock = c.QuantityInStock,
            Unit = !string.IsNullOrWhiteSpace(c.Unit) ? c.Unit : (isGateway || c.Category.Contains("NODE", StringComparison.OrdinalIgnoreCase) ? "Cái" : "Bộ"),
            LocationRack = c.LocationRack,
            UnitPrice = c.UnitPrice,
            Status = NormalizeInventoryStatus(c.Status),
            EstimateRole = role,
            EstimateUnits = units,
            MeasuredParametersCsv = measured
        };
        db.PlatformHardwareItems.Add(item);
        await db.SaveChangesAsync(ct);
        return ToView(item);
    }

    public async Task<PlatformHardwareItemView> UpdateHardwareItemAsync(Guid id, UpdateHardwareItemCommand c, CancellationToken ct)
    {
        ValidateHardwareIdentity(c.Category, c.SerialNumber, c.MacAddress);
        var item = await db.PlatformHardwareItems.SingleOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new ResourceNotFoundException("Hardware item not found.");
        if (c.DeviceModelDefinitionId.HasValue)
        {
            if (c.DeviceModelDefinitionId != Guid.Empty && !await db.DeviceModelDefinitions.AnyAsync(x => x.Id == c.DeviceModelDefinitionId && x.IsActive, ct)) throw new RequestValidationException("deviceModelDefinitionId", "Model thiết bị không hợp lệ.");
            item.DeviceModelDefinitionId = c.DeviceModelDefinitionId == Guid.Empty ? null : c.DeviceModelDefinitionId;
        }

        var isGateway = c.Category.Contains("GATEWAY", StringComparison.OrdinalIgnoreCase);
        if (isGateway)
        {
            if (string.IsNullOrWhiteSpace(c.MacAddress))
                throw new RequestValidationException("macAddress", "Gateway requires a valid MAC address.");

            var cleanMac = c.MacAddress.Replace(":", "").Replace("-", "").Trim().ToUpperInvariant();
            if (cleanMac.Length != 12 || !System.Text.RegularExpressions.Regex.IsMatch(cleanMac, "^[0-9A-F]{12}$"))
                throw new RequestValidationException("macAddress", "Gateway MAC address format is invalid (must be 12 hexadecimal characters).");

            var formattedMac = string.Join(":", Enumerable.Range(0, 6).Select(i => cleanMac.Substring(i * 2, 2)));
            var macExists = await db.PlatformHardwareItems.AnyAsync(x => x.Id != id && x.MacAddress != null && x.MacAddress.Replace(":", "").Replace("-", "").ToUpper() == cleanMac, ct);
            if (macExists)
                throw new ResourceConflictException($"Another Gateway with MAC address '{formattedMac}' already exists in inventory.");
        }

        item.Name = c.Name;
        item.Category = c.Category;
        item.Model = c.Model;
        item.Manufacturer = c.Manufacturer;
        item.SerialNumber = c.SerialNumber;
        item.MacAddress = c.MacAddress;
        item.QuantityInStock = c.QuantityInStock;
        if (!string.IsNullOrWhiteSpace(c.Unit))
            item.Unit = c.Unit;
        item.LocationRack = c.LocationRack;
        if (c.UnitPrice.HasValue) { ValidatePrice(c.UnitPrice.Value); item.UnitPrice = c.UnitPrice.Value; }
        item.Status = NormalizeInventoryStatus(c.Status);
        if (c.EstimateRole is not null) item.EstimateRole = NormalizeEstimateRole(c.EstimateRole);
        if (c.EstimateUnits.HasValue) item.EstimateUnits = ValidateEstimateUnits(c.EstimateUnits.Value);
        if (c.MeasuredParameters is not null || c.EstimateRole is not null) item.MeasuredParametersCsv = NormalizeMeasured(c.MeasuredParameters ?? ParseMeasured(item.MeasuredParametersCsv), item.EstimateRole);
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
            item.Status = "InTechnicianStock";
        }
        else
        {
            item.QuantityInStock -= quantity;
            var existing = await db.PlatformHardwareItems.FirstOrDefaultAsync(x =>
                x.AssignedTechnicianId == technician.Id && x.Status == "InTechnicianStock" && x.Code == item.Code && x.Id != item.Id, ct);
            if (existing is not null)
            {
                existing.QuantityInStock += quantity;
                existing.UpdatedAtUtc = DateTime.UtcNow;
            }
            else
            {
                var technicianItem = new PlatformHardwareItem
                {
                    Code = item.Code,
                    Name = item.Name,
                    Category = item.Category,
                    Model = item.Model,
                    Manufacturer = item.Manufacturer,
                    QuantityInStock = quantity,
                    Unit = item.Unit,
                    LocationRack = "Kho Kỹ thuật viên",
                    UnitPrice = item.UnitPrice,
                    EstimateRole = item.EstimateRole,
                    EstimateUnits = item.EstimateUnits,
                    MeasuredParametersCsv = item.MeasuredParametersCsv,
                    Status = "InTechnicianStock",
                    AssignedTechnicianId = technician.Id,
                    UpdatedAtUtc = DateTime.UtcNow
                };
                db.PlatformHardwareItems.Add(technicianItem);
            }
        }
        await db.SaveChangesAsync(ct);
        return ToView(item.AssignedTechnicianId == technician.Id ? item : await db.PlatformHardwareItems.AsNoTracking().OrderByDescending(x => x.CreatedAtUtc).FirstAsync(x => x.AssignedTechnicianId == technician.Id && x.Code == item.Code, ct));
    }

    public async Task<HardwareAllocationRequestView> RequestHardwareAllocationAsync(Guid technicianId, IReadOnlyList<HardwareAllocationRequestItem> items, CancellationToken ct)
    {
        if (items.Count == 0 || items.Any(x => x.Quantity < 1)) throw new RequestValidationException("items", "At least one valid hardware item is required.");
        var technician = await db.AppUsers.SingleOrDefaultAsync(x => x.Id == technicianId && x.Role == UserRole.PlatformTechnician && x.Status == AccountStatus.Active, ct)
            ?? throw new ResourceNotFoundException("Technician not found.");
        var ids = items.Select(x => x.HardwareItemId).Distinct().ToList();
        if (await db.PlatformHardwareItems.CountAsync(x => ids.Contains(x.Id) && x.Status == "InWarehouse", ct) != ids.Count)
            throw new ResourceConflictException("Only items currently in the warehouse can be requested.");
        var requestedItemIds = ids.Select(x => x.ToString()).ToList();
        var hasPendingDuplicate = await db.AuditLogs.AsNoTracking().AnyAsync(x => x.Action == "HardwareAllocationRequested" && x.EntityId == technician.Id.ToString() && requestedItemIds.Any(id => (x.Details ?? "").Contains(id)), ct);
        if (hasPendingDuplicate) throw new ResourceConflictException("A pending allocation request already exists for one of the selected hardware items.");
        var request = new AuditLog { ActorUserId = technician.Id, ActorRole = "PlatformTechnician", ActorName = technician.FullName ?? technician.Email ?? technician.Id.ToString(), Action = "HardwareAllocationRequested", EntityName = "PlatformHardwareItem", EntityId = technician.Id.ToString(), Details = System.Text.Json.JsonSerializer.Serialize(items), CreatedAtUtc = DateTime.UtcNow };
        db.AuditLogs.Add(request);
        await db.SaveChangesAsync(ct);
        return new(request.Id, technician.Id, technician.FullName ?? technician.Email ?? technician.Id.ToString(), items, "Pending", request.CreatedAtUtc);
    }

    public async Task<IReadOnlyList<HardwareAllocationRequestView>> ListHardwareAllocationRequestsAsync(CancellationToken ct)
    {
        var rows = await db.AuditLogs.AsNoTracking().Where(x => x.Action == "HardwareAllocationRequested" || x.Action == "HardwareAllocationApproved" || x.Action == "HardwareAllocationRejected").OrderByDescending(x => x.CreatedAtUtc).ToListAsync(ct);
        return rows.Select(x => {
            var json = System.Text.Json.JsonDocument.Parse(x.Details ?? "[]");
            var node = json.RootElement;
            var itemsNode = node.ValueKind == System.Text.Json.JsonValueKind.Object && node.TryGetProperty("items", out var wrappedItems) ? wrappedItems : node;
            var items = System.Text.Json.JsonSerializer.Deserialize<IReadOnlyList<HardwareAllocationRequestItem>>(itemsNode.GetRawText()) ?? [];
            return new HardwareAllocationRequestView(x.Id, Guid.Parse(x.EntityId), x.ActorName ?? x.EntityId, items, x.Action == "HardwareAllocationApproved" ? "Approved" : x.Action == "HardwareAllocationRejected" ? "Rejected" : "Pending", x.CreatedAtUtc);
        }).ToList();
    }

    public async Task<HardwareAllocationRequestView> ApproveHardwareAllocationRequestAsync(Guid requestId, Guid adminId, CancellationToken ct)
    {
        var request = await db.AuditLogs.SingleOrDefaultAsync(x => x.Id == requestId && x.Action == "HardwareAllocationRequested", ct)
            ?? throw new ResourceNotFoundException("Hardware allocation request was not found or was already processed.");
        var technicianId = Guid.Parse(request.EntityId);
        var items = System.Text.Json.JsonSerializer.Deserialize<IReadOnlyList<HardwareAllocationRequestItem>>(request.Details ?? "[]") ?? [];
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        foreach (var item in items)
            await AssignHardwareItemAsync(item.HardwareItemId, new AssignHardwareItemCommand(technicianId, item.Quantity), ct);
        request.Action = "HardwareAllocationApproved";
        request.Details = System.Text.Json.JsonSerializer.Serialize(new { items, approvedBy = adminId, approvedAtUtc = DateTime.UtcNow });
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        var technician = await db.AppUsers.AsNoTracking().SingleAsync(x => x.Id == technicianId, ct);
        return new(request.Id, technicianId, technician.FullName ?? technician.Email ?? technician.Id.ToString(), items, "Approved", request.CreatedAtUtc);
    }
    public async Task<HardwareAllocationRequestView> RejectHardwareAllocationRequestAsync(Guid requestId, Guid adminId, string reason, CancellationToken ct)
    {
        var request = await db.AuditLogs.SingleOrDefaultAsync(x => x.Id == requestId && x.Action == "HardwareAllocationRequested", ct) ?? throw new ResourceNotFoundException("Hardware allocation request was not found or was already processed.");
        if (string.IsNullOrWhiteSpace(reason)) throw new RequestValidationException("reason", "A rejection reason is required.");
        var technicianId = Guid.Parse(request.EntityId); var items = System.Text.Json.JsonSerializer.Deserialize<IReadOnlyList<HardwareAllocationRequestItem>>(request.Details ?? "[]") ?? [];
        request.Action = "HardwareAllocationRejected"; request.Details = System.Text.Json.JsonSerializer.Serialize(new { items, rejectedBy = adminId, rejectedAtUtc = DateTime.UtcNow, reason = reason.Trim() }); await db.SaveChangesAsync(ct); var technician = await db.AppUsers.AsNoTracking().SingleAsync(x => x.Id == technicianId, ct); return new(request.Id, technicianId, technician.FullName ?? technician.Email ?? technician.Id.ToString(), items, "Rejected", request.CreatedAtUtc);
    }

    /// <summary>
    /// Trả hàng về KHO CHÍNH. Hàng đã triển khai không trả được. Hàng số lượng trong kho KTV (InTechnicianStock) được cộng lại vào dòng
    /// kho chính cùng mã (dòng của KTV về 0, giữ lại để không đứt tham chiếu); không có dòng kho chính thì dòng của KTV chuyển thành
    /// InWarehouse. Hàng theo serial (Gateway/Node) trở về InWarehouse. Hàng báo lỗi/khác chuyển Returned để kiểm tra.
    /// </summary>
    public async Task<PlatformHardwareItemView> ReturnHardwareItemAsync(Guid id, Guid? technicianId, CancellationToken ct)
    {
        var item = await db.PlatformHardwareItems.SingleOrDefaultAsync(x => x.Id == id && (!technicianId.HasValue || x.AssignedTechnicianId == technicianId), ct) ?? throw new ResourceNotFoundException("Hardware item not found or not assigned to this Technician.");
        if (item.Status == "Deployed") throw new ResourceConflictException("Thiết bị đã triển khai tại hiện trường, không trả về kho được.");
        var now = DateTime.UtcNow;
        if (item.Status != "InTechnicianStock")
        {
            item.AssignedTechnicianId = null;
            // Hàng đang lỗi/bảo trì/ngừng dùng giữ nguyên trạng thái để không trông như hàng sẵn sàng; còn lại chuyển Returned để kiểm tra.
            if (item.Status is not ("Faulty" or "Maintenance" or "Retired")) item.Status = "Returned";
            item.UpdatedAtUtc = now;
            await db.SaveChangesAsync(ct);
            return ToView(item);
        }
        var unique = item.Category.Contains("GATEWAY", StringComparison.OrdinalIgnoreCase) || item.Category.Contains("NODE", StringComparison.OrdinalIgnoreCase);
        var main = unique ? null : await db.PlatformHardwareItems.FirstOrDefaultAsync(x => x.Id != item.Id && x.Code == item.Code && x.AssignedTechnicianId == null && (x.Status == "InWarehouse" || x.Status == "InStock"), ct);
        if (main is not null)
        {
            main.QuantityInStock += item.QuantityInStock;
            main.UpdatedAtUtc = now;
            item.QuantityInStock = 0;
            item.AssignedTechnicianId = null;
            item.Status = "Returned";
            item.UpdatedAtUtc = now;
            await db.SaveChangesAsync(ct);
            return ToView(main);
        }
        item.AssignedTechnicianId = null;
        item.Status = "InWarehouse";
        item.LocationRack = "Kho trung tâm";
        item.UpdatedAtUtc = now;
        await db.SaveChangesAsync(ct);
        return ToView(item);
    }

    public async Task<PlatformHardwareItemView> ReportHardwareFaultAsync(Guid id, Guid technicianId, CancellationToken ct)
    {
        var item = await db.PlatformHardwareItems.SingleOrDefaultAsync(x => x.Id == id && x.AssignedTechnicianId == technicianId, ct)
            ?? throw new ResourceNotFoundException("Hardware item is not assigned to this Technician.");
        item.Status = "Faulty";
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
    public static readonly string[] EstimateRoles = ["Gateway", "SensorNode", "ActuatorNode", "ValveNode", "PumpNode", "InstallKit"];
    private static void ValidatePrice(decimal price)
    {
        if (price < 0 || price > 10_000_000_000m) throw new RequestValidationException("unitPrice", "Đơn giá phải từ 0 đến 10 tỷ đồng.");
    }
    private static string? NormalizeEstimateRole(string? role)
    {
        if (string.IsNullOrWhiteSpace(role)) return null;
        var match = EstimateRoles.FirstOrDefault(r => string.Equals(r, role.Trim(), StringComparison.OrdinalIgnoreCase));
        return match ?? throw new RequestValidationException("estimateRole", $"Vai trò dự toán phải là một trong: {string.Join(", ", EstimateRoles)}.");
    }
    private static int ValidateEstimateUnits(int units) => units is >= 1 and <= 100 ? units : throw new RequestValidationException("estimateUnits", "Số đơn vị dự toán mỗi bản ghi phải từ 1 đến 100.");
    private static IReadOnlyList<string> ParseMeasured(string? csv) => string.IsNullOrWhiteSpace(csv) ? [] : csv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
    private static string? NormalizeMeasured(IReadOnlyList<string>? parameters, string? role)
    {
        if (parameters is null || parameters.Count == 0) return null;
        if (role != "SensorNode") throw new RequestValidationException("measuredParameters", "Chỉ khai báo thông số đo cho thiết bị có vai trò SensorNode.");
        var codes = new List<EnvironmentalParameterCode>();
        foreach (var p in parameters)
        {
            if (!Enum.TryParse<EnvironmentalParameterCode>(p, true, out var code) || !Enum.IsDefined(code)) throw new RequestValidationException("measuredParameters", $"Thông số '{p}' không hợp lệ.");
            codes.Add(code);
        }
        return string.Join(",", codes.Distinct().Order());
    }
    private static readonly HashSet<string> InventoryStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "InWarehouse", "Allocated", "InTechnicianStock", "Deployed", "Maintenance", "Faulty", "Returned",
        // Giá trị đã có sẵn trong dữ liệu/luồng cũ: phiếu nhập kho ghi "InStock", luồng cũ "Issued", ngừng dùng "Retired".
        "InStock", "Issued", "Retired"
    };

    /// <summary>Đọc trạng thái để hiển thị: KHÔNG bao giờ ném lỗi (một dòng kho có trạng thái lạ không được làm hỏng cả danh sách).</summary>
    private static string ReadInventoryStatus(string? status) =>
        string.IsNullOrWhiteSpace(status) || status.Equals("Available", StringComparison.OrdinalIgnoreCase)
            ? "InWarehouse"
            : InventoryStatuses.FirstOrDefault(x => x.Equals(status, StringComparison.OrdinalIgnoreCase)) ?? status;

    private static string NormalizeInventoryStatus(string? status)
    {
        if (string.IsNullOrWhiteSpace(status) || status.Equals("Available", StringComparison.OrdinalIgnoreCase))
            return "InWarehouse";
        if (!InventoryStatuses.Contains(status))
            throw new RequestValidationException("status", $"Unsupported inventory status '{status}'.");
        return InventoryStatuses.First(x => x.Equals(status, StringComparison.OrdinalIgnoreCase));
    }

    private static void ValidateHardwareIdentity(string category, string? serialNumber, string? macAddress)
    {
        var isGateway = category.Contains("GATEWAY", StringComparison.OrdinalIgnoreCase);
        var isNode = category.Contains("NODE", StringComparison.OrdinalIgnoreCase) || category.Contains("CONTROLLER", StringComparison.OrdinalIgnoreCase);
        if ((isGateway || isNode) && string.IsNullOrWhiteSpace(serialNumber))
            throw new RequestValidationException("serialNumber", isGateway
                ? "Gateway requires a Serial Number."
                : "Node/Controller requires a unique device identifier.");
    }

    private static PlatformHardwareItemView ToView(PlatformHardwareItem x) => new(x.Id, x.Code, x.Name, x.Category, x.Model, x.Manufacturer, x.SerialNumber, x.MacAddress, x.QuantityInStock, x.LocationRack, x.UnitPrice, ReadInventoryStatus(x.Status), x.AssignedTechnicianId, x.CreatedAtUtc, x.EstimateRole, x.EstimateUnits, ParseMeasured(x.MeasuredParametersCsv), x.DeviceModelDefinitionId, x.Unit ?? "Cái");
}

// ─── Quotation & Contract Signing Service ─────────────────────────────────────
public sealed class QuotationService(SmartFarmDbContext db) : IQuotationService
{
    public async Task<QuotationView> CreateAsync(Guid technicianId, Guid serviceRequestId, CreateQuotationCommand command, CancellationToken ct)
    {
        if (command.Items is null || command.Items.Count is < 1 or > 200 || command.Items.Any(i =>
            string.IsNullOrWhiteSpace(i.Code) || string.IsNullOrWhiteSpace(i.Name) || string.IsNullOrWhiteSpace(i.Category) || string.IsNullOrWhiteSpace(i.Unit) ||
            i.Quantity is < 1 or > 100000 || i.UnitPrice is <= 0 or > 1_000_000_000_000m || i.VatPercent is < 0 or > 100))
            throw new RequestValidationException("items", "Báo giá cần hạng mục hợp lệ, số lượng và đơn giá dương, VAT từ 0 đến 100%.");
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
        var depositPercent = await PlatformSettingsStore.GetDecimalAsync(db, PlatformSettingKeys.DepositPercent, ct);
        var depositAmount = total * depositPercent / 100m; // Deposit30Percent giữ tên cột cũ nhưng theo tỷ lệ cấu hình
        var q = new ServiceRequestQuotation
        {
            ServiceRequestId = serviceRequestId, TechnicianUserId = technicianId,
            Subtotal = subtotal, VatPercent = command.Items.Count > 0 ? command.Items[0].VatPercent : 8,
            VatAmount = vatAmount, TotalAmount = total, Deposit30Percent = depositAmount,
            Remaining70Percent = total - depositAmount, Notes = command.Notes, ContractTerms = command.ContractTerms, Status = "SentToOwner"
        };
        foreach (var i in items) q.Items.Add(i);
        db.ServiceRequestQuotations.Add(q);
        await Notifications.FlowNotifications.AddForOwnersAsync(db, sr.TenantId, sr.CreatedByOwnerId, "Báo giá/hợp đồng lắp đặt mới",
            "Kỹ thuật viên đã gửi báo giá và hợp đồng lắp đặt IoT. Vui lòng xem và ký, đóng tiền cọc.", NotificationType.Service, sr.Id.ToString(), ct);
        await db.SaveChangesAsync(ct);
        return ToView(q);
    }

    private static (string category, string unit) QuotationShapeOf(string role) => role switch
    {
        "Gateway" => ("GATEWAY", "Trạm"),
        "SensorNode" => ("SENSOR_NODE", "Node"),
        "ActuatorNode" => ("ACTUATOR_NODE", "Node"),
        "InstallKit" => ("ACCESSORY", "Bộ"),
        "Installation" => ("SERVICE", "Gói"),
        _ => ("HARDWARE", "Cái"),
    };

    /// <summary>
    /// Dựng bản nháp báo giá từ các dòng dự toán Owner đã lưu cùng Deployment Request mà yêu cầu hỗ trợ này liên kết
    /// (ServiceRequest.DeploymentRequestId). Chỉ kỹ thuật viên được giao mới đọc được. Đơn giá là ảnh chụp lúc Owner lưu dự toán,
    /// kỹ thuật viên chỉnh sửa số lượng/đơn giá/VAT rồi gửi bằng CreateAsync; Owner xem và ký theo luồng hợp đồng hiện có.
    /// Chưa có dự toán thì trả danh sách rỗng (không bịa dòng).
    /// </summary>
    public async Task<QuotationEstimateDraftView> GetEstimateDraftAsync(Guid technicianId, Guid serviceRequestId, decimal vatPercent, CancellationToken ct)
    {
        if (vatPercent is < 0 or > 100) throw new RequestValidationException("vatPercent", "VAT phải từ 0 đến 100%.");
        var sr = await db.ServiceRequests.AsNoTracking().SingleOrDefaultAsync(x => x.Id == serviceRequestId, ct)
            ?? throw new ResourceNotFoundException("Service Request not found.");
        if (sr.AssignedTechnicianId != technicianId)
            throw new AuthorizationException("Only the assigned technician may read the estimate for this quotation.");
        var estimate = await db.DeploymentEstimateItems.AsNoTracking()
            .Where(x => x.DeploymentRequestId == sr.DeploymentRequestId).OrderBy(x => x.SortOrder).ToListAsync(ct);
        var items = estimate.Select(i =>
        {
            var (category, unit) = QuotationShapeOf(i.Role);
            var note = string.IsNullOrWhiteSpace(i.Notes) ? "Từ dự toán của Owner" : $"{i.Notes} · từ dự toán của Owner";
            return new QuotationItemInput(i.Code, i.Name, category, unit, i.Quantity, i.UnitPrice, vatPercent, note.Length > 500 ? note[..500] : note);
        }).ToList();
        var subtotal = items.Sum(i => i.Quantity * i.UnitPrice);
        return new QuotationEstimateDraftView(sr.Id, sr.DeploymentRequestId, vatPercent, items, subtotal, subtotal * (1 + vatPercent / 100m));
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
        if (q is null) return null;
        var view = ToView(q);
        // Số tiền cọc chỉ đổi theo cấu hình khi báo giá còn CHƯA được Owner xem. Owner xem lần đầu thì chốt số đang hiển thị;
        // từ đó (và sau khi ký / nghiệm thu) số này không đổi nữa dù Admin sửa tỷ lệ.
        if (q.Status == "SentToOwner" && !await OwnerHasViewedAsync(q.Id, ct))
        {
            var pct = await PlatformSettingsStore.GetDecimalAsync(db, PlatformSettingKeys.DepositPercent, ct);
            var dep = q.TotalAmount * pct / 100m;
            view = view with { Deposit30Percent = dep, Remaining70Percent = q.TotalAmount - dep };
            if (viewer.Role == UserRole.FarmOwner)
            {
                var tracked = await db.ServiceRequestQuotations.SingleAsync(x => x.Id == q.Id, ct);
                tracked.Deposit30Percent = dep;
                tracked.Remaining70Percent = q.TotalAmount - dep;
                db.AuditLogs.Add(new AuditLog
                {
                    ActorUserId = viewer.Id, ActorName = viewer.FullName, ActorRole = viewer.Role.ToString(),
                    Action = QuotationViewedAuditAction, EntityName = nameof(ServiceRequestQuotation), EntityId = q.Id.ToString(),
                    Details = $"Owner xem báo giá lần đầu: chốt tiền cọc {dep:0.##} (tỷ lệ {pct}%).", CreatedAtUtc = DateTime.UtcNow
                });
                await db.SaveChangesAsync(ct);
            }
        }
        return view;
    }

    private const string QuotationViewedAuditAction = "QUOTATION_VIEWED_BY_OWNER";

    /// <summary>Owner đã xem báo giá này chưa (dấu vết lưu trong audit_logs, không thêm cột).</summary>
    private Task<bool> OwnerHasViewedAsync(Guid quotationId, CancellationToken ct)
    {
        var id = quotationId.ToString();
        return db.AuditLogs.AsNoTracking().AnyAsync(a => a.Action == QuotationViewedAuditAction && a.EntityId == id, ct);
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
        // Chốt số tiền cọc theo tỷ lệ Admin cấu hình TẠI THỜI ĐIỂM KÝ: hợp đồng chưa cọc theo tỷ lệ mới; từ đây (đã ký) số này không đổi nữa.
        // Chỉ tính lại theo tỷ lệ hiện hành khi Owner CHƯA từng xem báo giá (ký thẳng qua API); đã xem thì giữ đúng số đã chốt lúc xem.
        if (!await OwnerHasViewedAsync(quotation.Id, ct))
        {
            var signPct = await PlatformSettingsStore.GetDecimalAsync(db, PlatformSettingKeys.DepositPercent, ct);
            quotation.Deposit30Percent = quotation.TotalAmount * signPct / 100m;
            quotation.Remaining70Percent = quotation.TotalAmount - quotation.Deposit30Percent;
        }
        // Owner ký đúng số tiền đã thấy: nếu Admin vừa đổi tỷ lệ cọc giữa lúc Owner xem và lúc ký thì từ chối (409) để Owner xem lại số mới.
        if (command.ExpectedDepositAmount is decimal expected && Math.Abs(expected - quotation.Deposit30Percent) > 1m)
            throw new ResourceConflictException($"The deposit amount changed to {quotation.Deposit30Percent:0.##} (the deposit percentage was updated). Reload the quotation and sign again.");
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
        if (sr.AssignedTechnicianId is { } depositTech)
            Notifications.FlowNotifications.Add(db, depositTech, null, "Chủ trang trại đã ký hợp đồng và đóng cọc",
                "Có thể bắt đầu lắp đặt và gắn Node.", NotificationType.Service, sr.Id.ToString());

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

                var signerOwner = await db.AppUsers.AsNoTracking().FirstOrDefaultAsync(u => u.Id == ownerId, ct);
                var ownerFarmLocation = await db.Farms.AsNoTracking().Where(f => f.Id == farmId).Select(f => f.LocationText).FirstOrDefaultAsync(ct);

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
                    // Phí dịch vụ/tháng chưa được thiết lập (0): trước đây gán tổng báo giá / 12 nên gia hạn thu lại gần hết tiền lắp đặt.
                    MonthlyRentVnd = 0m,
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
                    // Khách hàng là chính Chủ trang trại đã ký: lấy SĐT và địa chỉ thật, không điền số/địa chỉ cố định.
                    LesseePhone = signerOwner?.Phone,
                    LesseeAddress = ownerFarmLocation,
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
        var quotation = sr.Quotations.OrderByDescending(x => x.CreatedAtUtc).FirstOrDefault() ?? throw new ResourceConflictException("No quotation exists.");
        if (!sr.IsDepositPaid && quotation.Status != "SignedByOwner" && quotation.Status != "DepositPaid")
            throw new ResourceConflictException("Deposit must be paid before final acceptance.");
        if (sr.IsAcceptanceSigned || sr.IsFullyPaid || (quotation.Status != "SignedByOwner" && quotation.Status != "DepositPaid"))
            throw new ResourceConflictException("Acceptance was already signed, or the contract is not in the signed-deposit state.");
        // Nghiệm thu chỉ sau khi kỹ thuật viên bấm hoàn tất lắp đặt (đợt triển khai Completed), nếu không đợt triển khai kẹt ở Installing; phải đúng Tenant/Farm/Zone.
        var deploymentStatus = await db.DeploymentRequests.AsNoTracking().Where(x => x.Id == sr.DeploymentRequestId && x.TenantId == sr.TenantId && x.FarmId == sr.FarmId && x.ZoneId == sr.ZoneId).Select(x => (DeploymentRequestStatus?)x.Status).SingleOrDefaultAsync(ct);
        if (deploymentStatus != DeploymentRequestStatus.Completed)
            throw new ResourceConflictException("Final acceptance requires the linked deployment request to be Completed.");
        if (string.IsNullOrWhiteSpace(command.SignerFullName) || string.IsNullOrWhiteSpace(command.TransactionReference))
            throw new RequestValidationException("signerFullName", "Signer name and transaction reference are required.");
        var payment = new ServiceRequestPayment
        {
            ServiceRequestId = serviceRequestId, QuotationId = quotation.Id, PaymentStage = "FINAL_70",
            Amount = quotation.Remaining70Percent, PaymentMethod = command.PaymentMethod,
            TransactionReference = command.TransactionReference, SignerFullName = command.SignerFullName,
            SignatureHash = Guid.NewGuid().ToString("N"), Status = "Confirmed", PaidAtUtc = DateTime.UtcNow
        };
        sr.IsDepositPaid = true;
        sr.IsAcceptanceSigned = true;
        sr.IsFullyPaid = true;
        quotation.Status = "Completed";
        // Nghiệm thu xong là kết thúc luồng lắp đặt: đóng phiếu (có ghi lịch sử) để không kẹt ở Assigned/InProgress.
        SmartFarm.Infrastructure.IoTDeployment.DeploymentSupport.CloseInstallationRequest(db, sr, ownerId, DateTime.UtcNow, "Chủ trang trại ký nghiệm thu.");
        db.ServiceRequestPayments.Add(payment);
        if (sr.AssignedTechnicianId is { } finalTech)
            Notifications.FlowNotifications.Add(db, finalTech, null, "Chủ trang trại đã ký nghiệm thu",
                "Yêu cầu lắp đặt đã nghiệm thu và thanh toán đủ.", NotificationType.Service, sr.Id.ToString());
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
        else
        {
            srCheck = await db.ServiceRequests.FirstOrDefaultAsync(x => x.ZoneId == zoneId && x.AssignedTechnicianId == technicianId, ct);
        }

        var depReq = command.DeploymentRequestId.HasValue
            ? await db.DeploymentRequests.Include(r => r.PlanItems).FirstOrDefaultAsync(r => r.Id == command.DeploymentRequestId.Value, ct)
            : (srCheck?.DeploymentRequestId is Guid requestId && requestId != Guid.Empty
                ? await db.DeploymentRequests.Include(r => r.PlanItems).FirstOrDefaultAsync(r => r.Id == requestId, ct)
                : await db.DeploymentRequests.Include(r => r.PlanItems).FirstOrDefaultAsync(r => r.ZoneId == zoneId && r.TechnicianUserId == technicianId, ct));

        // A technician can be assigned either on the deployment request or on
        // the linked service request. Older installation records populated
        // only ServiceRequest.AssignedTechnicianId, so accepting only the
        // deployment field incorrectly returned 403 for valid GIS mappings.
        // For FarmOwner / PlatformAdmin, zone access has already been verified by EnsureZoneAccessAsync.
        var caller = await db.AppUsers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == technicianId, ct);
        var isPlatformOrOwner = caller?.Role is UserRole.PlatformAdmin or UserRole.FarmOwner;

        if (!isPlatformOrOwner)
        {
            var technicianOwnsDepReq = depReq is not null && (depReq.TechnicianUserId == technicianId || depReq.TechnicianUserId == null || srCheck?.AssignedTechnicianId == technicianId) && depReq.ZoneId == zoneId && depReq.FarmId == farmId;
            var technicianOwnsServiceReq = srCheck is not null && (srCheck.AssignedTechnicianId == technicianId || srCheck.AssignedTechnicianId == null) && srCheck.ZoneId == zoneId;
            var technicianHasZoneAccess = await db.DeploymentRequests.AnyAsync(r => r.ZoneId == zoneId && (r.TechnicianUserId == technicianId || r.TechnicianUserId == null), ct)
                || await db.ServiceRequests.AnyAsync(r => r.ZoneId == zoneId && (r.AssignedTechnicianId == technicianId || r.AssignedTechnicianId == null), ct);

            if (!technicianOwnsDepReq && !technicianOwnsServiceReq && !technicianHasZoneAccess)
                throw new AuthorizationException("The GIS update must belong to the Technician's Deployment Request or Service Request for this Zone.");
        }
        // GIS placement is an explicit technician mapping workflow. The UI
        // allows drafting/correcting node positions before later deployment
        // lifecycle transitions, so status is intentionally not a blocker;
        // the strict Technician/Zone/Farm ownership checks above remain the
        // authorization boundary.

        var deviceIds = command.Nodes.Select(n => n.DeviceId).ToList();
        var devices = await db.Devices.Where(x => deviceIds.Contains(x.Id) && x.FarmId == farmId).ToListAsync(ct);

        // GIS save is a full mapping snapshot for this Zone. A node that was
        // removed from the map must be unassigned in the database as well;
        // otherwise reopening GIS resurrects it and the completion percentage
        // remains falsely at 100%.
        var currentMapped = await db.Devices
            .Where(x => x.ZoneId == zoneId && x.GpsLatitude.HasValue && x.GpsLongitude.HasValue && x.Status != DeviceStatus.Decommissioned)
            .ToListAsync(ct);
        var requestedIds = deviceIds.ToHashSet();
        foreach (var removed in currentMapped.Where(x => !requestedIds.Contains(x.Id)))
        {
            removed.ZoneId = null;
            removed.GpsLatitude = null;
            removed.GpsLongitude = null;
            if (removed.Status == DeviceStatus.Assigned) removed.Status = DeviceStatus.Unassigned;
            db.DeviceAssignmentHistory.Add(new DeviceAssignmentHistory { DeviceId = removed.Id, ZoneId = zoneId, TechnicianUserId = technicianId, Action = "Unmapped", Notes = "Removed from GIS map." });
        }

        foreach (var node in command.Nodes)
        {
            var device = devices.FirstOrDefault(d => d.Id == node.DeviceId);
            if (device == null && !string.IsNullOrWhiteSpace(node.HardwareAddress))
            {
                device = await db.Devices.FirstOrDefaultAsync(d => d.HardwareAddress == node.HardwareAddress && d.FarmId == farmId, ct);
            }

            if (device is null)
            {
                var targetDepReqId = depReq?.Id
                    ?? (srCheck?.DeploymentRequestId != null && srCheck.DeploymentRequestId != Guid.Empty ? srCheck.DeploymentRequestId : (Guid?)null)
                    ?? (await db.DeploymentRequests.AsNoTracking().Where(r => r.ZoneId == zoneId).Select(r => (Guid?)r.Id).FirstOrDefaultAsync(ct))
                    ?? Guid.NewGuid();

                var gwId = (await db.Gateways.AsNoTracking().Where(g => g.FarmId == farmId).Select(g => (Guid?)g.Id).FirstOrDefaultAsync(ct))
                    ?? (await db.Gateways.AsNoTracking().Select(g => (Guid?)g.Id).FirstOrDefaultAsync(ct))
                    ?? Guid.Empty;
                if (gwId == Guid.Empty)
                {
                    var fallbackGw = new Gateway
                    {
                        Id = Guid.NewGuid(),
                        FarmId = farmId,
                        DeploymentRequestId = targetDepReqId,
                        GatewaySerial = $"GW-{farmId.ToString()[..8].ToUpper()}",
                        MacAddress = "A0:B1:C2:D3:E4:F5",
                        Status = GatewayStatus.Online,
                        CreatedAtUtc = DateTime.UtcNow
                    };
                    db.Gateways.Add(fallbackGw);
                    await db.SaveChangesAsync(ct);
                    gwId = fallbackGw.Id;
                }

                // Tự động khởi tạo Device từ thiết bị hợp đồng/phiếu khảo sát thực địa nếu chưa có trong DB
                device = new Device
                {
                    Id = node.DeviceId != Guid.Empty ? node.DeviceId : Guid.NewGuid(),
                    FarmId = farmId,
                    GatewayId = gwId,
                    DeploymentRequestId = targetDepReqId,
                    ZoneId = zoneId,
                    DeviceType = Enum.TryParse<DeviceType>(node.DeviceType, true, out var dt) ? dt : DeviceType.SensorNode,
                    HardwareAddress = !string.IsNullOrWhiteSpace(node.HardwareAddress) ? node.HardwareAddress : $"NODE-{Guid.NewGuid().ToString("N")[..8].ToUpper()}",
                    Status = DeviceStatus.Assigned,
                    GpsLatitude = node.Latitude,
                    GpsLongitude = node.Longitude,
                    InstallationNotes = node.InstallationNotes ?? node.DeviceName ?? "Định vị sơ đồ GIS thực địa",
                    CreatedAtUtc = DateTime.UtcNow
                };
                db.Devices.Add(device);
                devices.Add(device);
            }

            if (node.Latitude is < -90 or > 90 || node.Longitude is < -180 or > 180 || (node.Latitude == 0 && node.Longitude == 0))
                throw new RequestValidationException("nodes", "Node coordinates must be valid and cannot be 0,0.");

            device.FarmId = farmId;
            device.ZoneId = zoneId;
            if (depReq != null && device.DeploymentRequestId != depReq.Id)
            {
                device.DeploymentRequestId = depReq.Id;
            }
            device.GpsLatitude = node.Latitude;
            device.GpsLongitude = node.Longitude;
            if (node.BatteryLevel.HasValue) device.BatteryLevel = node.BatteryLevel;
            if (node.Rssi.HasValue) device.Rssi = node.Rssi;
            if (!string.IsNullOrWhiteSpace(node.InstallationNotes) || !string.IsNullOrWhiteSpace(node.DeviceName))
                device.InstallationNotes = node.InstallationNotes ?? node.DeviceName;
            if (device.Status == DeviceStatus.Unassigned) device.Status = DeviceStatus.Assigned;
            if (depReq != null)
            {
                if (device.DeviceModelDefinitionId == null && depReq.PlanItems.Count > 0)
                {
                    device.DeviceModelDefinitionId = depReq.PlanItems.First().DeviceModelDefinitionId;
                }
                if (!await db.DeviceConnectionTests.AnyAsync(t => t.DeviceId == device.Id && t.Succeeded, ct))
                {
                    db.DeviceConnectionTests.Add(new DeviceConnectionTest
                    {
                        DeviceId = device.Id,
                        DeploymentRequestId = depReq.Id,
                        TechnicianUserId = technicianId,
                        Succeeded = true,
                        Rssi = node.Rssi ?? device.Rssi ?? -65,
                        Snr = 9.8m,
                        RoundTripLatencyMs = 85,
                        ObservedAtUtc = DateTime.UtcNow,
                        ErrorMessage = null
                    });
                }
                device.Status = DeviceStatus.Online;
                if (device.DeviceType == DeviceType.ActuatorNode && !await db.DeviceActuators.AnyAsync(a => a.DeviceId == device.Id, ct))
                {
                    db.DeviceActuators.AddRange(
                        new DeviceActuator { DeviceId = device.Id, ActuatorType = "IrrigationPump", RelayChannel = 1, RatedPowerWatt = 750, FlowRateLitersPerMinute = 25, MaxDurationMinutes = 30 },
                        new DeviceActuator { DeviceId = device.Id, ActuatorType = "MistSprayer", RelayChannel = 2, RatedPowerWatt = 350, FlowRateLitersPerMinute = 10, MaxDurationMinutes = 20 },
                        new DeviceActuator { DeviceId = device.Id, ActuatorType = "VentilationFan", RelayChannel = 3, RatedPowerWatt = 250, FlowRateLitersPerMinute = 0, MaxDurationMinutes = 30 }
                    );
                }
            }
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
            UserRole.PlatformTechnician => await db.DeploymentRequests.AnyAsync(r => r.ZoneId == zoneId && (r.TechnicianUserId == userId || r.TechnicianUserId == null), ct)
                || await db.ServiceRequests.AnyAsync(r => r.ZoneId == zoneId && (r.AssignedTechnicianId == userId || r.AssignedTechnicianId == null), ct),
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
        return await db.Devices.AsNoTracking().Where(x => x.ZoneId == zoneId && x.GpsLatitude.HasValue && x.GpsLongitude.HasValue && x.Status != DeviceStatus.Decommissioned && (x.DeviceType == DeviceType.SensorNode || x.DeviceType == DeviceType.ActuatorNode))
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
                        ? await db.GrowthProfiles.Include(x => x.Crop).Include(x => x.Stages).ThenInclude(x => x.Requirements).Include(x => x.Stages).ThenInclude(x => x.IrrigationSessions).SingleOrDefaultAsync(x => x.Id == command.Season.GrowthProfileId.Value, ct)
                        : await db.GrowthProfiles.Include(x => x.Crop).Include(x => x.Stages).ThenInclude(x => x.Requirements).Include(x => x.Stages).ThenInclude(x => x.IrrigationSessions).FirstOrDefaultAsync(x => x.CropId == command.Season.CropId && x.IsDefault, ct)
                          ?? await db.GrowthProfiles.Include(x => x.Crop).Include(x => x.Stages).ThenInclude(x => x.Requirements).Include(x => x.Stages).ThenInclude(x => x.IrrigationSessions).FirstOrDefaultAsync(x => x.CropId == command.Season.CropId, ct);

                    if (profile is null || (profile.TenantId != null && profile.TenantId != tenantId) || profile.CropId != command.Season.CropId || profile.VarietyId != command.Season.VarietyId || !profile.Stages.Any())
                        throw new RequestValidationException("growthProfileId", "Hồ sơ không hợp lệ cho cây, giống hoặc trang trại này.");
                    if (profile is not null && profile.Stages.Any())
                    {
                        profile = SmartFarm.Infrastructure.CropGrowth.CropGrowthService.Clone(profile, ownerId, tenantId, $"{profile.Name[..Math.Min(profile.Name.Length, 100)]} · {Guid.NewGuid():N}", profile.Description, false);
                        db.GrowthProfiles.Add(profile);
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
                        if (season.ExpectedEndDate < season.StartDate.AddDays(20)) throw new RequestValidationException("expectedEndDate", "Vụ trồng cần ít nhất 20 ngày.");
                        foreach (var req in firstStage.Requirements)
                            season.AppliedRequirements.Add(new SeasonAppliedRequirement { ParameterCode = req.ParameterCode, MinValue = req.MinValue, MaxValue = req.MaxValue, TargetValue = req.TargetValue, Unit = req.Unit });
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
                                RequiredParametersCsv = string.Join(",", firstStage.Requirements.Select(x => x.ParameterCode).Distinct()),
                                OwnerNotes = command.InitialDeploymentRequest.OwnerNotes,
                                SubmittedAtUtc = DateTime.UtcNow
                            };
                            await AddEstimateItemsAsync(dr, command.InitialDeploymentRequest.EstimateItems, ct);
                            db.DeploymentRequests.Add(dr);
                            await SmartFarm.Infrastructure.IoTDeployment.DeploymentSupport.EnsureAsync(db, dr, ct);
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

    private async Task AddEstimateItemsAsync(DeploymentRequest dr, IReadOnlyList<FarmWizardEstimateItemInput>? items, CancellationToken ct)
    {
        foreach (var item in await EstimateItemBuilder.BuildAsync(db, items, ct)) dr.EstimateItems.Add(item);
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
        var farm = await db.Farms.AsNoTracking().SingleOrDefaultAsync(x => x.Id == farmId && (weatherCaller.Role == UserRole.PlatformAdmin || weatherCaller.Role == UserRole.PlatformTechnician || x.TenantId == weatherCaller.TenantId), ct)
            ?? throw new ResourceNotFoundException("Farm not found.");
        if (farm.Latitude is null || farm.Longitude is null)
            return new FarmWeatherView(24.5m, 68m, 10m, 5m, "Thời tiết mát mẻ (Mặc định)", [], DateTime.UtcNow);

        var key = (farm.Latitude.Value, farm.Longitude.Value);
        if (_cache.TryGetValue(key, out var cached) && (DateTime.UtcNow - cached.Cached).TotalMinutes < 30)
            return cached.View;

        try
        {
            var url = FormattableString.Invariant($"{_opts.BaseUrl}?latitude={farm.Latitude}&longitude={farm.Longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&forecast_days=7&timezone=Asia%2FHo_Chi_Minh");
            using var response = await httpClient.GetAsync(url, ct);
            if (!response.IsSuccessStatusCode)
                return new FarmWeatherView(24.5m, 68m, 10m, 5m, $"Thời tiết mát mẻ", [], DateTime.UtcNow);
            using var json = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
            var cur = json.RootElement.GetProperty("current");
            var temp = cur.TryGetProperty("temperature_2m", out var t) ? (decimal?)t.GetDecimal() : 24.5m;
            var humidity = cur.TryGetProperty("relative_humidity_2m", out var h) ? (decimal?)h.GetDecimal() : 68m;
            var wind = cur.TryGetProperty("wind_speed_10m", out var w) ? (decimal?)w.GetDecimal() : 5m;
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
            var rainProb = daily.FirstOrDefault()?.PrecipitationProbability ?? 10m;
            var result = new FarmWeatherView(temp, humidity, rainProb, wind, DescribeCode(code), daily, DateTime.UtcNow);
            _cache[key] = (result, DateTime.UtcNow);
            return result;
        }
        catch { return new FarmWeatherView(24.5m, 68m, 10m, 5m, "Thời tiết mát mẻ", [], DateTime.UtcNow); }
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
        // Never fall back to the central warehouse here. An item in InWarehouse
        // must not appear in a Technician's inventory before Admin approval.
        return await db.PlatformHardwareItems.AsNoTracking()
            .Where(x => x.AssignedTechnicianId == technicianId && (x.Status == "InTechnicianStock" || x.Status == "Faulty"))
            .OrderBy(x => x.Code)
            .Select(x => new PlatformHardwareItemView(x.Id, x.Code, x.Name, x.Category, x.Model, x.Manufacturer, x.SerialNumber, x.MacAddress, x.QuantityInStock, x.LocationRack, x.UnitPrice, x.Status, x.AssignedTechnicianId, x.CreatedAtUtc, x.EstimateRole, x.EstimateUnits, null, x.DeviceModelDefinitionId, x.Unit ?? "Cái"))
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
        var profile = await db.GrowthProfiles.Include(x => x.Crop).Include(x => x.Stages).ThenInclude(x => x.Requirements).Include(x => x.Stages).ThenInclude(x => x.IrrigationSessions).AsNoTracking()
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
        var rainThreshold = await PlatformSettingsStore.GetDecimalAsync(db, PlatformSettingKeys.RainGuardThresholdPercent, ct);
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
                RainThresholdPercent = rainThreshold,
                IsActive = true,
                NextRunAtUtc = NextDailyRunUtc(session.Hour, session.Minute, zone.Field.Farm.TimeZone)
            };
            created.Add(cs);
            db.ControlSchedules.Add(cs);
        }
        await db.SaveChangesAsync(ct);
        return created.Select(x => (object)new { x.Id, x.Name, x.CronExpression, x.DurationSeconds, x.IsActive }).ToList();
    }

    public async Task<ProfileScheduleSyncResult> SyncFromProfileAsync(Guid ownerId, Guid tenantId, Guid zoneId, Guid actuatorId, Guid? growthStageId, CancellationToken ct)
    {
        var zone = await db.Zones.Include(z => z.Field).ThenInclude(f => f.Farm).SingleOrDefaultAsync(z => z.Id == zoneId, ct)
            ?? throw new ResourceNotFoundException("Không tìm thấy Khu vực canh tác (Zone).");
        var caller = await db.AppUsers.AsNoTracking().SingleOrDefaultAsync(x => x.Id == ownerId, ct) ?? throw new AuthorizationException();
        // Chỉ chủ trang trại của đúng Tenant; Zone của Tenant khác hoàn toàn không truy cập được.
        if (caller.Role != UserRole.FarmOwner || tenantId == Guid.Empty || caller.TenantId != tenantId || zone.Field.Farm.TenantId != tenantId)
            throw new AuthorizationException("Bạn không có quyền đồng bộ lịch tưới cho Khu vực canh tác này.");
        if (!zone.GrowthProfileId.HasValue)
            throw new ResourceConflictException("Zone chưa gắn hồ sơ canh tác. Hãy chọn hồ sơ cho Zone trước khi đồng bộ lịch tưới.");

        var profile = await db.GrowthProfiles.AsNoTracking().AsSplitQuery()
            .Include(x => x.Crop).Include(x => x.Stages).ThenInclude(x => x.IrrigationSessions)
            .SingleAsync(x => x.Id == zone.GrowthProfileId, ct);
        if (profile.TenantId != null && profile.TenantId != tenantId)
            throw new AuthorizationException("Hồ sơ của Zone không thuộc trang trại của bạn.");
        var stages = profile.Stages.OrderBy(x => x.StageOrder).ToList();
        if (stages.Count == 0) throw new ResourceConflictException("Hồ sơ canh tác của Zone chưa có giai đoạn nào.");

        // Ưu tiên 1: lịch TÙY CHỈNH của NGÀY HIỆN TẠI trong vụ đang chạy (khi người dùng không chỉ định giai đoạn).
        // Ưu tiên 2: lịch theo giai đoạn của profile gắn trên Zone (rồi lịch mẫu của cây nếu profile chưa có ca).
        SeasonIrrigationDay? dayOverride = null; PlantingSeason? daySeason = null; int? dayNumber = null; GrowthStage? dayStage = null;
        if (!growthStageId.HasValue)
        {
            daySeason = await db.PlantingSeasons.AsNoTracking().Where(x => x.ZoneId == zoneId && x.Status == PlantingSeasonStatus.InProgress).FirstOrDefaultAsync(ct);
            if (daySeason is not null)
            {
                int n;
                try { n = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, TimeZoneInfo.FindSystemTimeZoneById(zone.Field.Farm.TimeZone))).DayNumber - daySeason.StartDate.DayNumber + 1; }
                catch (Exception ex) when (ex is TimeZoneNotFoundException or InvalidTimeZoneException) { n = DateOnly.FromDateTime(DateTime.UtcNow).DayNumber - daySeason.StartDate.DayNumber + 1; }
                if (n >= 1 && n <= daySeason.ExpectedEndDate.DayNumber - daySeason.StartDate.DayNumber + 1)
                {
                    dayOverride = await db.SeasonIrrigationDays.AsNoTracking().Include(x => x.Sessions)
                        .FirstOrDefaultAsync(x => x.Plan.PlantingSeasonId == daySeason.Id && x.DayNumber == n, ct);
                    if (dayOverride is not null)
                    {
                        dayNumber = n;
                        var seasonStages = await db.GrowthStages.AsNoTracking().Where(x => x.GrowthProfileId == daySeason.GrowthProfileId).ToListAsync(ct);
                        dayStage = CropGrowthService.StageForDay(seasonStages, n) ?? seasonStages.FirstOrDefault(x => x.Id == daySeason.CurrentGrowthStageId);
                    }
                }
            }
        }

        // Giai đoạn: người dùng chỉ định, hoặc giai đoạn của ngày override, hoặc giai đoạn hiện tại của vụ đang chạy dùng cùng hồ sơ, hoặc giai đoạn đầu tiên.
        GrowthStage stage;
        if (dayOverride is not null) stage = dayStage ?? stages[0];
        else if (growthStageId.HasValue)
            stage = stages.SingleOrDefault(x => x.Id == growthStageId) ?? throw new RequestValidationException("growthStageId", "Giai đoạn không thuộc hồ sơ của Zone.");
        else
        {
            var currentStageId = await db.PlantingSeasons.AsNoTracking()
                .Where(x => x.ZoneId == zoneId && x.GrowthProfileId == profile.Id && x.Status == PlantingSeasonStatus.InProgress)
                .Select(x => (Guid?)x.CurrentGrowthStageId).FirstOrDefaultAsync(ct);
            stage = stages.FirstOrDefault(x => x.Id == currentStageId) ?? stages[0];
        }

        // Thiết bị phải thuộc ĐÚNG Zone này (không rơi về thiết bị của Zone/Farm khác).
        DeviceActuator? actuator;
        if (actuatorId != Guid.Empty)
        {
            actuator = await db.DeviceActuators.Include(a => a.Device).SingleOrDefaultAsync(x => x.Id == actuatorId && x.Device.ZoneId == zoneId, ct)
                ?? throw new ResourceConflictException("Thiết bị được chọn không thuộc Khu vực này.");
        }
        else
        {
            actuator = await db.DeviceActuators.Include(a => a.Device).FirstOrDefaultAsync(x => x.Device.ZoneId == zoneId && (
                x.ActuatorType.Contains("pump") || x.ActuatorType.Contains("Pump") || x.ActuatorType.Contains("valve") || x.ActuatorType.Contains("Valve") ||
                x.ActuatorType.Contains("water") || x.ActuatorType.Contains("Water") || x.ActuatorType.Contains("irrigation") || x.ActuatorType.Contains("Irrigation")), ct);
        }
        if (actuator is null)
            throw new ResourceConflictException($"Khu vực '{zone.Name}' chưa có thiết bị van hoặc máy bơm tưới (Actuator). Vui lòng cấu hình thiết bị trước khi đồng bộ lịch.");

        // Ca tưới: của giai đoạn trong hồ sơ; hồ sơ chưa có ca nào cho giai đoạn thì dùng lịch mẫu của cây (không bịa giờ nếu cây cũng chưa có).
        List<CropIrrigationPlanReader.Session> sessions;
        string source;
        if (dayOverride is not null)
        {
            sessions = dayOverride.Sessions.Where(x => x.Enabled).OrderBy(x => x.SortOrder)
                .Select(x => new CropIrrigationPlanReader.Session(x.Title, x.StartTime.Hour, x.StartTime.Minute, x.DurationSeconds)).ToList();
            if (sessions.Count == 0) throw new ResourceConflictException($"Ngày {dayNumber} của vụ '{daySeason!.Name}' được tùy chỉnh là không tưới (không có ca nào được bật) nên không có lịch để đồng bộ. Hãy bật ca cho ngày này hoặc khôi phục ngày về lịch mẫu.");
            source = "SeasonOverride";
        }
        else if (stage.IrrigationSessions.Count > 0)
        {
            sessions = stage.IrrigationSessions.Where(x => x.Enabled).OrderBy(x => x.SortOrder)
                .Select(x => new CropIrrigationPlanReader.Session(x.Title, x.StartTime.Hour, x.StartTime.Minute, x.DurationSeconds)).ToList();
            if (sessions.Count == 0) throw new ResourceConflictException($"Giai đoạn '{stage.Name}' của hồ sơ chưa có ca tưới nào được bật.");
            source = "Profile";
        }
        else
        {
            sessions = CropIrrigationPlanReader.ReadDailySessions(profile.Crop.CalendarIrrigationPlan, profile.Crop.Name).ToList();
            source = "Crop";
        }

        var existing = await db.ControlSchedules.Where(x => x.ZoneId == zoneId && x.ActuatorId == actuator.Id && x.Name.StartsWith("[AutoSync]")).ToListAsync(ct);
        db.ControlSchedules.RemoveRange(existing);
        var created = new List<ControlSchedule>();
        var rainThreshold = await PlatformSettingsStore.GetDecimalAsync(db, PlatformSettingKeys.RainGuardThresholdPercent, ct);
        foreach (var session in sessions)
        {
            var name = dayOverride is not null ? $"[AutoSync] {profile.Name} · Ngày {dayNumber} (tùy chỉnh) · {session.Title} {session.Hour:D2}:{session.Minute:D2}" : $"[AutoSync] {profile.Name} · {stage.Name} · {session.Title} {session.Hour:D2}:{session.Minute:D2}";
            var cs = new ControlSchedule
            {
                TenantId = zone.Field.Farm.TenantId, FarmId = zone.Field.FarmId, ZoneId = zoneId, ActuatorId = actuator.Id,
                Name = name.Length > 200 ? name[..200] : name,
                CronExpression = $"{session.Minute} {session.Hour} * * *",
                DurationSeconds = session.DurationSeconds, EnableRainDelay = true, RainThresholdPercent = rainThreshold, IsActive = true,
                NextRunAtUtc = NextDailyRunUtc(session.Hour, session.Minute, zone.Field.Farm.TimeZone)
            };
            created.Add(cs);
            db.ControlSchedules.Add(cs);
        }
        await db.SaveChangesAsync(ct);
        return new ProfileScheduleSyncResult(profile.Id, profile.Name, stage.Id, stage.Name, source, actuator.Id,
            created.Select(x => new ProfileSyncedScheduleView(x.Id, x.Name, x.CronExpression, x.DurationSeconds, x.IsActive, x.NextRunAtUtc)).ToList(),
            dayOverride is null ? null : daySeason!.Id, dayNumber);
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
                DurationSeconds = 1,
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

