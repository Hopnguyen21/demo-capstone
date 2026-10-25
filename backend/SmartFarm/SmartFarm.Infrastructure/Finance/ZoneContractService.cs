using Microsoft.EntityFrameworkCore;
using SmartFarm.Application.Features.Finance;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;

namespace SmartFarm.Infrastructure.Finance;

public sealed class ZoneContractService(SmartFarmDbContext db, TimeProvider clock) : IZoneContractService
{
    private static bool IsDevelopment() =>
        string.Equals(Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"), "Development", StringComparison.OrdinalIgnoreCase);
    public async Task<IReadOnlyList<ZoneContractView>> GetAllContractsAsync(Guid ownerId, Guid? tenantId, CancellationToken ct)
    {
        await EnsureSeedDataAsync(ownerId, tenantId, ct);

        var today = DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);
        var query = db.ZoneContracts
            .Include(c => c.Farm)
            .Include(c => c.Zone)
            .Include(c => c.ParentContract)
            .Include(c => c.Renewals)
            .AsNoTracking();

        if (tenantId.HasValue && tenantId.Value != Guid.Empty)
        {
            query = query.Where(c => c.TenantId == tenantId.Value);
        }

        var contracts = await query
            .OrderByDescending(c => c.CreatedAtUtc)
            .ToListAsync(ct);

        return contracts.Select(c => MapToView(c, today)).ToList();
    }

    public async Task<IReadOnlyList<ZoneContractView>> GetContractsByZoneAsync(Guid ownerId, Guid? tenantId, Guid zoneId, CancellationToken ct)
    {
        await EnsureSeedDataAsync(ownerId, tenantId, ct);

        var today = DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);
        var query = db.ZoneContracts
            .Include(c => c.Farm)
            .Include(c => c.Zone)
            .Include(c => c.ParentContract)
            .Include(c => c.Renewals)
            .AsNoTracking()
            .Where(c => c.ZoneId == zoneId);

        if (tenantId.HasValue && tenantId.Value != Guid.Empty)
        {
            query = query.Where(c => c.TenantId == tenantId.Value);
        }

        var contracts = await query
            .OrderByDescending(c => c.CreatedAtUtc)
            .ToListAsync(ct);

        return contracts.Select(c => MapToView(c, today)).ToList();
    }

    public async Task<IReadOnlyList<ZoneContractView>> GetContractsByFarmAsync(Guid ownerId, Guid? tenantId, Guid farmId, CancellationToken ct)
    {
        await EnsureSeedDataAsync(ownerId, tenantId, ct);

        var today = DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);
        var query = db.ZoneContracts
            .Include(c => c.Farm)
            .Include(c => c.Zone)
            .Include(c => c.ParentContract)
            .Include(c => c.Renewals)
            .AsNoTracking()
            .Where(c => c.FarmId == farmId);

        if (tenantId.HasValue && tenantId.Value != Guid.Empty)
        {
            query = query.Where(c => c.TenantId == tenantId.Value);
        }

        var contracts = await query
            .OrderByDescending(c => c.CreatedAtUtc)
            .ToListAsync(ct);

        return contracts.Select(c => MapToView(c, today)).ToList();
    }

    public async Task<ZoneContractView> GetContractByIdAsync(Guid ownerId, Guid? tenantId, Guid contractId, CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);
        var query = db.ZoneContracts
            .Include(c => c.Farm)
            .Include(c => c.Zone)
            .Include(c => c.ParentContract)
            .Include(c => c.Renewals)
            .AsNoTracking();

        if (tenantId.HasValue && tenantId.Value != Guid.Empty)
        {
            query = query.Where(c => c.TenantId == tenantId.Value);
        }

        var contract = await query.FirstOrDefaultAsync(c => c.Id == contractId, ct)
            ?? throw new KeyNotFoundException($"Không tìm thấy hợp đồng #{contractId}");

        return MapToView(contract, today);
    }

    public async Task<ZoneContractView> CreateContractAsync(Guid ownerId, Guid? tenantId, Guid zoneId, CreateZoneContractCommand command, CancellationToken ct)
    {
        var zone = await db.Zones.Include(z => z.Field).ThenInclude(f => f.Farm).FirstOrDefaultAsync(z => z.Id == zoneId, ct)
            ?? throw new KeyNotFoundException($"Không tìm thấy Zone #{zoneId}");

        if (tenantId.HasValue && tenantId.Value != Guid.Empty && zone.Field.Farm.TenantId != tenantId.Value)
        {
            throw new UnauthorizedAccessException("Khu vực canh tác này không thuộc về Trang trại của Tenant bạn.");
        }

        var effectiveTenantId = (tenantId.HasValue && tenantId.Value != Guid.Empty)
            ? tenantId.Value
            : zone.Field.Farm.TenantId;
        var farmId = command.FarmId != Guid.Empty ? command.FarmId : zone.Field.FarmId;

        // Auto-generate Contract Number if not provided
        var contractNumber = !string.IsNullOrWhiteSpace(command.ContractNumber)
            ? command.ContractNumber.Trim()
            : $"HD-ZN-{DateTime.UtcNow:yyyyMM}-{Random.Shared.Next(100, 999)}";

        // Auto calculate financials
        var totalMonths = Math.Max(1, ((command.EndDate.Year - command.StartDate.Year) * 12) + command.EndDate.Month - command.StartDate.Month);
        var rawTotal = command.TotalContractValueVnd > 0
            ? command.TotalContractValueVnd
            : command.MonthlyRentVnd * totalMonths;

        // Check if user is purchasing for the 2nd time within 2 months (60 days)
        var twoMonthsAgo = DateTime.UtcNow.AddDays(-60);
        var previousRecentContract = await db.ZoneContracts
            .Where(c => (c.CreatedByOwnerId == ownerId || (tenantId.HasValue && c.TenantId == tenantId.Value))
                     && (c.CreatedAtUtc >= twoMonthsAgo || (c.SignedAtUtc.HasValue && c.SignedAtUtc.Value >= twoMonthsAgo)))
            .OrderByDescending(c => c.CreatedAtUtc)
            .FirstOrDefaultAsync(ct);

        var isRepeatPurchaseInTwoMonths = previousRecentContract != null;
        var discountPercent = command.DiscountPercent ?? (isRepeatPurchaseInTwoMonths ? 15m : (command.ParentContractId.HasValue ? 10m : 0m));

        var discount = command.DiscountAmount ?? (discountPercent > 0 ? rawTotal * (discountPercent / 100m) : 0m);
        var finalTotal = Math.Max(0, rawTotal - discount);
        var deposit = command.DepositVnd > 0 ? command.DepositVnd : Math.Round(finalTotal * 0.30m);

        var notes = command.Notes;
        if (isRepeatPurchaseInTwoMonths && (notes == null || !notes.Contains("lần 2 trong 2 tháng")))
        {
            var notePrefix = $"[Ưu đãi Tri ân: Giảm {discountPercent}% cho khách hàng mua/ký hợp đồng lần thứ 2 trong vòng 2 tháng (HĐ trước: #{previousRecentContract!.ContractNumber})]. ";
            notes = notePrefix + (notes ?? string.Empty);
        }

        var today = DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);
        var status = command.EndDate < today
            ? ZoneContractStatus.Expired
            : (command.EndDate.DayNumber - today.DayNumber <= 30 ? ZoneContractStatus.ExpiringSoon : ZoneContractStatus.Active);

        var contract = new ZoneContract
        {
            TenantId = effectiveTenantId,
            FarmId = farmId,
            ZoneId = zoneId,
            CreatedByOwnerId = ownerId,
            ParentContractId = command.ParentContractId,
            ContractNumber = contractNumber,
            CropType = command.CropType ?? zone.Notes ?? "Rau màu VietGAP",
            MonthlyRentVnd = command.MonthlyRentVnd,
            DepositVnd = deposit,
            TotalContractValueVnd = finalTotal,
            StartDate = command.StartDate,
            EndDate = command.EndDate,
            Status = status,
            LesseeName = command.LesseeName,
            LesseePhone = command.LesseePhone,
            LesseeIdentityNumber = command.LesseeIdentityNumber,
            LesseeAddress = command.LesseeAddress,
            SpecialTerms = command.SpecialTerms,
            Notes = notes,
            SignedAtUtc = DateTime.UtcNow
        };

        // If this replaces an existing contract, update parent contract status to Renewed
        if (command.ParentContractId.HasValue)
        {
            var parent = await db.ZoneContracts.FirstOrDefaultAsync(c => c.Id == command.ParentContractId.Value && (tenantId == null || c.TenantId == tenantId.Value), ct);
            if (parent != null && parent.Status != ZoneContractStatus.Renewed)
            {
                parent.Status = ZoneContractStatus.Renewed;
                parent.UpdatedAtUtc = DateTime.UtcNow;
            }
        }

        db.ZoneContracts.Add(contract);
        await db.SaveChangesAsync(ct);

        return await GetContractByIdAsync(ownerId, tenantId, contract.Id, ct);
    }

    public async Task<ZoneContractView> RenewContractAsync(Guid ownerId, Guid? tenantId, Guid contractId, RenewZoneContractCommand command, CancellationToken ct)
    {
        var query = db.ZoneContracts.Include(c => c.Renewals).AsQueryable();
        if (tenantId.HasValue && tenantId.Value != Guid.Empty)
        {
            query = query.Where(c => c.TenantId == tenantId.Value);
        }

        var contract = await query.FirstOrDefaultAsync(c => c.Id == contractId, ct)
            ?? throw new KeyNotFoundException($"Không tìm thấy hợp đồng #{contractId} hoặc bạn không có quyền thao tác.");

        var baseEndDate = contract.EndDate;
        DateOnly newEndDate = command.DurationPreset switch
        {
            "6_MONTHS" => baseEndDate.AddMonths(6),
            "1_YEAR" => baseEndDate.AddYears(1),
            "3_YEARS" => baseEndDate.AddYears(3),
            "CUSTOM" => command.CustomEndDate ?? baseEndDate.AddMonths(6),
            _ => command.CustomEndDate ?? baseEndDate.AddYears(1)
        };

        // Check if renewing / purchasing for 2nd time within 2 months (60 days)
        var twoMonthsAgo = DateTime.UtcNow.AddDays(-60);
        var isRepeatWithinTwoMonths = contract.CreatedAtUtc >= twoMonthsAgo ||
            (contract.SignedAtUtc.HasValue && contract.SignedAtUtc.Value >= twoMonthsAgo) ||
            (contract.Renewals != null && contract.Renewals.Any(r => r.CreatedAtUtc >= twoMonthsAgo));

        var discountPercent = command.DiscountPercent ?? (isRepeatWithinTwoMonths ? 15m : 10m);
        var monthsAdded = Math.Max(1, ((newEndDate.Year - baseEndDate.Year) * 12) + newEndDate.Month - baseEndDate.Month);
        var rentPerMonth = command.NewMonthlyRentVnd ?? contract.MonthlyRentVnd;
        var rawRenewalValue = rentPerMonth * monthsAdded;
        var discount = command.DiscountAmount ?? (discountPercent > 0 ? rawRenewalValue * (discountPercent / 100m) : 0m);
        var finalRenewalValue = Math.Max(0, rawRenewalValue - discount);

        var notes = command.Notes;
        if (isRepeatWithinTwoMonths && (notes == null || !notes.Contains("lần 2 trong 2 tháng")))
        {
            var notePrefix = $"[Ưu đãi Tái ký / Mua lần 2 trong 2 tháng: Chiết khấu {discountPercent}%]. ";
            notes = notePrefix + (notes ?? string.Empty);
        }

        var renewal = new ZoneContractRenewal
        {
            ContractId = contract.Id,
            CreatedByOwnerId = ownerId,
            NewEndDate = newEndDate,
            NewMonthlyRentVnd = command.NewMonthlyRentVnd,
            RenewalValueVnd = finalRenewalValue,
            Notes = notes ?? $"Gia hạn thêm {monthsAdded} tháng (đến {newEndDate:dd/MM/yyyy}). Chiết khấu: {discount:N0} VNĐ."
        };

        db.ZoneContractRenewals.Add(renewal);

        // Update contract end date and active status
        contract.EndDate = newEndDate;
        if (command.NewMonthlyRentVnd.HasValue && command.NewMonthlyRentVnd.Value > 0)
        {
            contract.MonthlyRentVnd = command.NewMonthlyRentVnd.Value;
        }
        contract.TotalContractValueVnd += finalRenewalValue;

        var today = DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);
        contract.Status = newEndDate < today
            ? ZoneContractStatus.Expired
            : (newEndDate.DayNumber - today.DayNumber <= 30 ? ZoneContractStatus.ExpiringSoon : ZoneContractStatus.Active);
        contract.UpdatedAtUtc = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);

        return await GetContractByIdAsync(ownerId, tenantId, contract.Id, ct);
    }

    public async Task<IReadOnlyList<ExpiringContractAlertView>> GetExpiringContractsAsync(Guid ownerId, Guid? tenantId, Guid? farmId, int daysThreshold, CancellationToken ct)
    {
        await EnsureSeedDataAsync(ownerId, tenantId, ct);

        var today = DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);
        var thresholdDate = today.AddDays(daysThreshold);

        var query = db.ZoneContracts
            .Include(c => c.Farm)
            .Include(c => c.Zone)
            .Where(c => c.Status != ZoneContractStatus.Terminated 
                     && c.Status != ZoneContractStatus.Renewed 
                     && c.Status != ZoneContractStatus.Expired)
            .Where(c => c.EndDate >= today && c.EndDate <= thresholdDate);

        if (tenantId.HasValue && tenantId.Value != Guid.Empty)
        {
            query = query.Where(c => c.TenantId == tenantId.Value);
        }

        if (farmId.HasValue && farmId.Value != Guid.Empty)
        {
            query = query.Where(c => c.FarmId == farmId.Value);
        }

        var list = await query.OrderBy(c => c.EndDate).ToListAsync(ct);

        return list.Select(c => new ExpiringContractAlertView(
            c.Id,
            c.ContractNumber,
            c.FarmId,
            c.Farm?.Name ?? "Trang trại",
            c.ZoneId,
            c.Zone?.Name ?? "Zone",
            c.CropType,
            c.EndDate,
            c.EndDate.DayNumber - today.DayNumber,
            c.EndDate < today ? ZoneContractStatus.Expired : ZoneContractStatus.ExpiringSoon,
            c.TotalContractValueVnd
        )).ToList();
    }

    public async Task<IReadOnlyList<DeviceDepreciationView>> GetDepreciationsByZoneAsync(Guid ownerId, Guid? tenantId, Guid zoneId, CancellationToken ct)
    {
        await EnsureSeedDepreciationsAsync(ownerId, tenantId, ct);

        var zone = await db.Zones.Include(z => z.Field).ThenInclude(f => f.Farm).FirstOrDefaultAsync(z => z.Id == zoneId, ct)
            ?? throw new KeyNotFoundException($"Không tìm thấy phân khu #{zoneId}");

        if (tenantId.HasValue && tenantId.Value != Guid.Empty && zone.Field.Farm.TenantId != tenantId.Value)
        {
            throw new UnauthorizedAccessException("Bạn không có quyền truy cập dữ liệu phân khu này.");
        }

        var today = DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);
        var activeContract = await db.ZoneContracts
            .Where(c => c.ZoneId == zoneId && (c.Status == ZoneContractStatus.Active || c.Status == ZoneContractStatus.ExpiringSoon))
            .OrderBy(c => c.EndDate)
            .FirstOrDefaultAsync(ct);

        var isNearContractRenewal = activeContract != null && (activeContract.EndDate.DayNumber - today.DayNumber <= 45);

        var query = db.DeviceDepreciations
            .Include(d => d.Zone)
            .Include(d => d.Device)
            .Where(d => d.ZoneId == zoneId);

        if (tenantId.HasValue && tenantId.Value != Guid.Empty)
        {
            query = query.Where(d => d.TenantId == tenantId.Value);
        }

        var list = await query.OrderBy(d => d.StartDate).ToListAsync(ct);

        return list.Select(d => MapToDepreciationView(d, today, isNearContractRenewal)).ToList();
    }

    public async Task<IReadOnlyList<DeviceDepreciationView>> GetDepreciationsByFarmAsync(Guid ownerId, Guid? tenantId, Guid farmId, CancellationToken ct)
    {
        await EnsureSeedDepreciationsAsync(ownerId, tenantId, ct);

        var farm = await db.Farms.FirstOrDefaultAsync(f => f.Id == farmId, ct)
            ?? throw new KeyNotFoundException($"Không tìm thấy trang trại #{farmId}");

        if (tenantId.HasValue && tenantId.Value != Guid.Empty && farm.TenantId != tenantId.Value)
        {
            throw new UnauthorizedAccessException("Bạn không có quyền truy cập dữ liệu trang trại này.");
        }

        var today = DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);
        var zonesInFarm = await db.Zones.Where(z => z.Field.FarmId == farmId).Select(z => z.Id).ToListAsync(ct);

        var query = db.DeviceDepreciations
            .Include(d => d.Zone)
            .Include(d => d.Device)
            .Where(d => zonesInFarm.Contains(d.ZoneId));

        if (tenantId.HasValue && tenantId.Value != Guid.Empty)
        {
            query = query.Where(d => d.TenantId == tenantId.Value);
        }

        var list = await query.OrderBy(d => d.StartDate).ToListAsync(ct);

        return list.Select(d => MapToDepreciationView(d, today, false)).ToList();
    }

    public async Task<DeviceDepreciationView> CreateDepreciationAsync(Guid ownerId, Guid? tenantId, Guid zoneId, CreateDeviceDepreciationCommand command, CancellationToken ct)
    {
        var zone = await db.Zones.Include(z => z.Field).ThenInclude(f => f.Farm).FirstOrDefaultAsync(z => z.Id == zoneId, ct)
            ?? throw new KeyNotFoundException($"Không tìm thấy phân khu #{zoneId}");

        if (tenantId.HasValue && tenantId.Value != Guid.Empty && zone.Field.Farm.TenantId != tenantId.Value)
        {
            throw new UnauthorizedAccessException("Bạn không có quyền tạo hồ sơ khấu hao cho phân khu thuộc Tenant khác.");
        }

        var device = await db.Devices.FirstOrDefaultAsync(d => d.Id == command.DeviceId, ct)
            ?? throw new KeyNotFoundException($"Không tìm thấy thiết bị #{command.DeviceId}");

        if (device.ZoneId != zoneId)
        {
            throw new InvalidOperationException("Thiết bị không thuộc phân khu được chọn.");
        }

        var today = DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);
        var lifetime = Math.Max(1, command.DepreciationLifetimeMonths);
        var monthly = Math.Round(command.OriginalCostVnd / lifetime, 0);

        var monthsElapsed = Math.Max(0, ((today.Year - command.StartDate.Year) * 12) + today.Month - command.StartDate.Month);
        var accumulated = Math.Min(command.OriginalCostVnd, monthly * monthsElapsed);
        var bookValue = Math.Max(0, command.OriginalCostVnd - accumulated);

        var effectiveTenantId = tenantId.HasValue && tenantId.Value != Guid.Empty
            ? tenantId.Value
            : zone.Field.Farm.TenantId;

        var dep = new DeviceDepreciation
        {
            TenantId = effectiveTenantId,
            ZoneId = zoneId,
            DeviceId = command.DeviceId,
            CreatedByOwnerId = ownerId,
            OriginalCostVnd = command.OriginalCostVnd,
            MonthlyDepreciationVnd = monthly,
            AccumulatedDepreciationVnd = accumulated,
            CurrentBookValueVnd = bookValue,
            DepreciationLifetimeMonths = lifetime,
            Method = "STRAIGHT_LINE",
            StartDate = command.StartDate,
            Notes = command.Notes
        };

        db.DeviceDepreciations.Add(dep);
        await db.SaveChangesAsync(ct);

        return MapToDepreciationView(dep, today, false);
    }

    private static string? MaskIdentityNumber(string? idNumber)
    {
        if (string.IsNullOrWhiteSpace(idNumber)) return idNumber;
        var trimmed = idNumber.Trim();
        if (trimmed.Length <= 6) return new string('*', trimmed.Length);
        return string.Concat(trimmed.AsSpan(0, 3), new string('*', trimmed.Length - 6), trimmed.AsSpan(trimmed.Length - 3));
    }

    private static ZoneContractView MapToView(ZoneContract c, DateOnly today)
    {
        var daysRemaining = c.EndDate.DayNumber - today.DayNumber;
        var status = c.Status;
        if (status == ZoneContractStatus.Active || status == ZoneContractStatus.ExpiringSoon)
        {
            if (daysRemaining < 0) status = ZoneContractStatus.Expired;
            else if (daysRemaining <= 30) status = ZoneContractStatus.ExpiringSoon;
            else status = ZoneContractStatus.Active;
        }

        var statusText = status switch
        {
            ZoneContractStatus.Active => "Còn hiệu lực",
            ZoneContractStatus.ExpiringSoon => $"Sắp hết hạn (còn {daysRemaining} ngày)",
            ZoneContractStatus.Expired => "Đã hết hạn",
            ZoneContractStatus.Terminated => "Đã thanh lý / Chấm dứt",
            ZoneContractStatus.Renewed => "Đã tái ký gia hạn",
            _ => "Không xác định"
        };

        return new ZoneContractView(
            c.Id,
            c.TenantId,
            c.FarmId,
            c.Farm?.Name ?? "Trang trại",
            c.ZoneId,
            c.Zone?.Name ?? "Zone",
            c.CreatedByOwnerId,
            c.ParentContractId,
            c.ParentContract?.ContractNumber,
            c.ContractNumber,
            c.CropType,
            c.MonthlyRentVnd,
            c.DepositVnd,
            c.TotalContractValueVnd,
            c.StartDate,
            c.EndDate,
            status,
            statusText,
            daysRemaining,
            c.LesseeName,
            c.LesseePhone,
            MaskIdentityNumber(c.LesseeIdentityNumber),
            c.LesseeAddress,
            c.SpecialTerms,
            c.Notes,
            c.SignedAtUtc,
            c.Renewals.Select(r => new ZoneContractRenewalView(
                r.Id,
                r.ContractId,
                r.CreatedByOwnerId,
                r.NewEndDate,
                r.NewMonthlyRentVnd,
                r.RenewalValueVnd,
                r.Notes,
                r.CreatedAtUtc
            )).OrderByDescending(r => r.CreatedAtUtc).ToList(),
            c.CreatedAtUtc
        );
    }

    private static DeviceDepreciationView MapToDepreciationView(DeviceDepreciation d, DateOnly today, bool isNearContractRenewal)
    {
        var monthsElapsed = Math.Max(0, ((today.Year - d.StartDate.Year) * 12) + today.Month - d.StartDate.Month);
        var remainingMonths = Math.Max(0, d.DepreciationLifetimeMonths - monthsElapsed);
        var monthly = d.MonthlyDepreciationVnd > 0 ? d.MonthlyDepreciationVnd : Math.Round(d.OriginalCostVnd / Math.Max(1, d.DepreciationLifetimeMonths), 0);
        var accumulated = Math.Min(d.OriginalCostVnd, monthly * monthsElapsed);
        var bookValue = Math.Max(0, d.OriginalCostVnd - accumulated);

        string depStatus = remainingMonths switch
        {
            <= 0 => "FullyDepreciated",
            <= 3 => "ExpiringSoon",
            _ => "Active"
        };

        return new DeviceDepreciationView(
            d.Id,
            d.ZoneId,
            d.Zone?.Name ?? "Phân khu",
            d.DeviceId,
            d.Device?.HardwareAddress != null ? $"Thiết bị ({d.Device.HardwareAddress})" : "Thiết bị IoT",
            d.Device?.HardwareAddress ?? "HW-LORA-NODE",
            d.Device?.DeviceType.ToString() ?? "SensorNode",
            d.OriginalCostVnd,
            monthly,
            accumulated,
            bookValue,
            d.DepreciationLifetimeMonths,
            monthsElapsed,
            remainingMonths,
            d.Method ?? "STRAIGHT_LINE",
            d.StartDate,
            depStatus,
            isNearContractRenewal && (depStatus == "ExpiringSoon" || depStatus == "FullyDepreciated"),
            d.Notes,
            d.CreatedAtUtc
        );
    }

    private async Task EnsureSeedDataAsync(Guid ownerId, Guid? tenantId, CancellationToken ct)
    {
        if (!IsDevelopment()) return;
        if (await db.ZoneContracts.AnyAsync(ct)) return;

        var zonesQuery = db.Zones.Include(z => z.Field).ThenInclude(f => f.Farm).AsQueryable();
        if (tenantId.HasValue && tenantId.Value != Guid.Empty)
        {
            zonesQuery = zonesQuery.Where(z => z.Field.Farm.TenantId == tenantId.Value);
        }

        var zones = await zonesQuery.Take(6).ToListAsync(ct);
        if (zones.Count == 0) return;

        var today = DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);
        var targetTenantId = (tenantId.HasValue && tenantId.Value != Guid.Empty)
            ? tenantId.Value
            : zones[0].Field.Farm.TenantId;

        // Contract 1: Active
        var z1 = zones[0];
        var c1 = new ZoneContract
        {
            TenantId = targetTenantId,
            FarmId = z1.Field.FarmId,
            ZoneId = z1.Id,
            CreatedByOwnerId = ownerId,
            ContractNumber = "HD-ZN-2026-001",
            CropType = "Cà chua Cherry Đà Lạt (VietGAP)",
            MonthlyRentVnd = 12000000m,
            DepositVnd = 36000000m,
            TotalContractValueVnd = 144000000m,
            StartDate = today.AddMonths(-6),
            EndDate = today.AddMonths(6),
            Status = ZoneContractStatus.Active,
            LesseeName = "Hợp tác xã Nông nghiệp Công nghệ cao LangBiang",
            LesseePhone = "0912345678",
            LesseeIdentityNumber = "049***001234",
            LesseeAddress = "Phường 7, TP. Đà Lạt, Tỉnh Lâm Đồng",
            SpecialTerms = "Cung cấp trọn gói hạ tầng LoRa, cảm biến độ ẩm đất và hệ thống châm phân tự động.",
            Notes = "Hợp đồng triển khai trọn gói 12 tháng, bảo hành thiết bị 2 năm.",
            SignedAtUtc = DateTime.UtcNow.AddMonths(-6)
        };
        db.ZoneContracts.Add(c1);

        // Contract 2: Expiring Soon (ends in 18 days)
        if (zones.Count > 1)
        {
            var z2 = zones[1];
            var c2 = new ZoneContract
            {
                TenantId = targetTenantId,
                FarmId = z2.Field.FarmId,
                ZoneId = z2.Id,
                CreatedByOwnerId = ownerId,
                ContractNumber = "HD-ZN-2026-002",
                CropType = "Dâu tây Hana Nhật Bản (Nhà màng)",
                MonthlyRentVnd = 15000000m,
                DepositVnd = 45000000m,
                TotalContractValueVnd = 90000000m,
                StartDate = today.AddMonths(-5).AddDays(-12),
                EndDate = today.AddDays(18),
                Status = ZoneContractStatus.ExpiringSoon,
                LesseeName = "Công ty TNHH Nông sản Sạch GreenValley",
                LesseePhone = "0987654321",
                LesseeIdentityNumber = "049***005678",
                LesseeAddress = "Xã Lát, Huyện Lạc Dương, Tỉnh Lâm Đồng",
                SpecialTerms = "Giữ nguyên đơn giá trong suốt thời hạn hợp đồng. Đạt chuẩn VietGAP.",
                Notes = "Sắp đến kỳ gia hạn hợp đồng! Khách hàng thân thiết đủ điều kiện nhận chiết khấu 10% khi tái ký.",
                SignedAtUtc = DateTime.UtcNow.AddMonths(-5).AddDays(-12)
            };
            db.ZoneContracts.Add(c2);
        }

        // Contract 3: Historical Expired Contract
        var cOld = new ZoneContract
        {
            TenantId = targetTenantId,
            FarmId = z1.Field.FarmId,
            ZoneId = z1.Id,
            CreatedByOwnerId = ownerId,
            ContractNumber = "HD-ZN-2025-089",
            CropType = "Ớt chuông Sweet Pepper (Hà Lan)",
            MonthlyRentVnd = 10000000m,
            DepositVnd = 30000000m,
            TotalContractValueVnd = 120000000m,
            StartDate = today.AddYears(-2),
            EndDate = today.AddYears(-1),
            Status = ZoneContractStatus.Expired,
            LesseeName = "Trang trại Hữu cơ An Nhiên",
            LesseePhone = "0903112233",
            LesseeIdentityNumber = "049***009876",
            LesseeAddress = "TP. Đà Lạt, Tỉnh Lâm Đồng",
            SpecialTerms = "Thử nghiệm mô hình cảm biến vi khí hậu SHT30.",
            Notes = "Hợp đồng đã kết thúc đúng hạn và bàn giao lại mặt bằng phân khu.",
            SignedAtUtc = DateTime.UtcNow.AddYears(-2)
        };
        db.ZoneContracts.Add(cOld);

        await db.SaveChangesAsync(ct);
    }

    private async Task EnsureSeedDepreciationsAsync(Guid ownerId, Guid? tenantId, CancellationToken ct)
    {
        if (!IsDevelopment()) return;
        if (await db.DeviceDepreciations.AnyAsync(ct)) return;

        var zonesQuery = db.Zones.Include(z => z.Field).ThenInclude(f => f.Farm).AsQueryable();
        if (tenantId.HasValue && tenantId.Value != Guid.Empty)
        {
            zonesQuery = zonesQuery.Where(z => z.Field.Farm.TenantId == tenantId.Value);
        }

        var zones = await zonesQuery.Take(4).ToListAsync(ct);
        if (zones.Count == 0) return;

        var targetZoneIds = zones.Select(z => (Guid?)z.Id).ToList();
        var devices = await db.Devices.Where(d => targetZoneIds.Contains(d.ZoneId)).Take(8).ToListAsync(ct);
        var targetTenantId = (tenantId.HasValue && tenantId.Value != Guid.Empty)
            ? tenantId.Value
            : zones[0].Field.Farm.TenantId;
        var today = DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);

        if (devices.Count > 0)
        {
            db.DeviceDepreciations.Add(new DeviceDepreciation
            {
                TenantId = targetTenantId,
                ZoneId = zones[0].Id,
                DeviceId = devices[0].Id,
                CreatedByOwnerId = ownerId,
                OriginalCostVnd = 12500000m,
                MonthlyDepreciationVnd = 347222m,
                AccumulatedDepreciationVnd = 8333328m,
                CurrentBookValueVnd = 4166672m,
                DepreciationLifetimeMonths = 36,
                Method = "STRAIGHT_LINE",
                StartDate = today.AddMonths(-24),
                Notes = "Bảo hành 24 tháng theo hợp đồng nhà sản xuất. Khấu hao đường thẳng 3 năm."
            });
        }

        if (devices.Count > 1 && zones.Count > 1)
        {
            db.DeviceDepreciations.Add(new DeviceDepreciation
            {
                TenantId = targetTenantId,
                ZoneId = zones[1].Id,
                DeviceId = devices[1].Id,
                CreatedByOwnerId = ownerId,
                OriginalCostVnd = 4800000m,
                MonthlyDepreciationVnd = 200000m,
                AccumulatedDepreciationVnd = 4400000m,
                CurrentBookValueVnd = 400000m,
                DepreciationLifetimeMonths = 24,
                Method = "STRAIGHT_LINE",
                StartDate = today.AddMonths(-22),
                Notes = "Cảm biến vi khí hậu Sensirion SHT30. Sắp hết thời gian khấu hao, cần kiểm tra bảo dưỡng hoặc thay thế trong đợt gia hạn hợp đồng."
            });
        }

        if (devices.Count > 2)
        {
            var targetZone = zones.Count > 1 ? zones[1].Id : zones[0].Id;
            db.DeviceDepreciations.Add(new DeviceDepreciation
            {
                TenantId = targetTenantId,
                ZoneId = targetZone,
                DeviceId = devices[2].Id,
                CreatedByOwnerId = ownerId,
                OriginalCostVnd = 3600000m,
                MonthlyDepreciationVnd = 150000m,
                AccumulatedDepreciationVnd = 3600000m,
                CurrentBookValueVnd = 0m,
                DepreciationLifetimeMonths = 24,
                Method = "STRAIGHT_LINE",
                StartDate = today.AddMonths(-26),
                Notes = "Van tưới điện từ 4 cổng. Đã khấu hao hết 100%, giá trị sổ sách còn lại 0đ. Cần đề xuất nâng cấp khi tái ký hợp đồng mới."
            });
        }

        await db.SaveChangesAsync(ct);
    }
}
