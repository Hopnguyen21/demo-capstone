using Microsoft.EntityFrameworkCore;
using SmartFarm.Application.Common.Exceptions;
using SmartFarm.Application.Features.Finance;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;

namespace SmartFarm.Infrastructure.Finance;

public sealed class DiscountCodeService(SmartFarmDbContext db, TimeProvider clock) : IDiscountCodeService
{
    public async Task<IReadOnlyList<DiscountCodeView>> GetAllAsync(bool activeOnly, CancellationToken ct)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        var query = db.DiscountCodes
            .Include(d => d.CreatedByUser)
            .AsNoTracking();

        if (activeOnly)
        {
            query = query.Where(d => d.IsActive
                && (!d.StartDateUtc.HasValue || d.StartDateUtc.Value <= now)
                && (!d.EndDateUtc.HasValue || d.EndDateUtc.Value >= now)
                && (!d.UsageLimit.HasValue || d.UsedCount < d.UsageLimit.Value));
        }

        var list = await query.OrderByDescending(d => d.CreatedAtUtc).ToListAsync(ct);
        return list.Select(ToView).ToList();
    }

    public async Task<DiscountCodeView> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var entity = await db.DiscountCodes
            .Include(d => d.CreatedByUser)
            .AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == id, ct)
            ?? throw new ResourceNotFoundException($"Không tìm thấy mã giảm giá #{id}");

        return ToView(entity);
    }

    public async Task<DiscountCodeView> CreateAsync(Guid adminUserId, CreateDiscountCodeCommand command, CancellationToken ct)
    {
        var admin = await db.AppUsers.AsNoTracking().FirstOrDefaultAsync(u => u.Id == adminUserId, ct)
            ?? throw new AuthorizationException("Người dùng không tồn tại.");

        if (admin.Role != UserRole.PlatformAdmin)
        {
            throw new AuthorizationException("Chỉ Platform Admin mới có quyền tạo mã giảm giá.");
        }

        var code = command.Code.Trim().ToUpperInvariant();
        if (string.IsNullOrWhiteSpace(code))
        {
            throw new RequestValidationException("code", "Mã giảm giá không được để trống.");
        }

        if (await db.DiscountCodes.AnyAsync(d => d.Code == code, ct))
        {
            throw new ResourceConflictException($"Mã giảm giá '{code}' đã tồn tại trong hệ thống.");
        }

        if (command.DiscountValue <= 0)
        {
            throw new RequestValidationException("discountValue", "Mức giảm giá phải lớn hơn 0.");
        }

        if (command.DiscountType == DiscountType.Percentage && command.DiscountValue > 100)
        {
            throw new RequestValidationException("discountValue", "Phần trăm giảm giá không được vượt quá 100%.");
        }

        var now = clock.GetUtcNow().UtcDateTime;
        var entity = new DiscountCode
        {
            Code = code,
            Description = command.Description?.Trim() ?? string.Empty,
            DiscountType = command.DiscountType,
            DiscountValue = command.DiscountValue,
            MinContractValue = Math.Max(0, command.MinContractValue),
            MaxDiscountAmount = command.MaxDiscountAmount,
            StartDateUtc = command.StartDateUtc,
            EndDateUtc = command.EndDateUtc,
            UsageLimit = command.UsageLimit,
            UsedCount = 0,
            IsActive = command.IsActive,
            CreatedByUserId = adminUserId,
            CreatedAtUtc = now
        };

        db.DiscountCodes.Add(entity);
        await db.SaveChangesAsync(ct);

        return ToView(entity);
    }

    public async Task<DiscountCodeView> UpdateAsync(Guid adminUserId, Guid id, UpdateDiscountCodeCommand command, CancellationToken ct)
    {
        var admin = await db.AppUsers.AsNoTracking().FirstOrDefaultAsync(u => u.Id == adminUserId, ct)
            ?? throw new AuthorizationException("Người dùng không tồn tại.");

        if (admin.Role != UserRole.PlatformAdmin)
        {
            throw new AuthorizationException("Chỉ Platform Admin mới có quyền chỉnh sửa mã giảm giá.");
        }

        var entity = await db.DiscountCodes
            .Include(d => d.CreatedByUser)
            .FirstOrDefaultAsync(d => d.Id == id, ct)
            ?? throw new ResourceNotFoundException($"Không tìm thấy mã giảm giá #{id}");

        if (command.DiscountValue <= 0)
        {
            throw new RequestValidationException("discountValue", "Mức giảm giá phải lớn hơn 0.");
        }

        if (command.DiscountType == DiscountType.Percentage && command.DiscountValue > 100)
        {
            throw new RequestValidationException("discountValue", "Phần trăm giảm giá không được vượt quá 100%.");
        }

        entity.Description = command.Description?.Trim() ?? string.Empty;
        entity.DiscountType = command.DiscountType;
        entity.DiscountValue = command.DiscountValue;
        entity.MinContractValue = Math.Max(0, command.MinContractValue);
        entity.MaxDiscountAmount = command.MaxDiscountAmount;
        entity.StartDateUtc = command.StartDateUtc;
        entity.EndDateUtc = command.EndDateUtc;
        entity.UsageLimit = command.UsageLimit;
        entity.IsActive = command.IsActive;
        entity.UpdatedAtUtc = clock.GetUtcNow().UtcDateTime;

        await db.SaveChangesAsync(ct);
        return ToView(entity);
    }

    public async Task DeleteAsync(Guid adminUserId, Guid id, CancellationToken ct)
    {
        var admin = await db.AppUsers.AsNoTracking().FirstOrDefaultAsync(u => u.Id == adminUserId, ct)
            ?? throw new AuthorizationException("Người dùng không tồn tại.");

        if (admin.Role != UserRole.PlatformAdmin)
        {
            throw new AuthorizationException("Chỉ Platform Admin mới có quyền xóa mã giảm giá.");
        }

        var entity = await db.DiscountCodes.FirstOrDefaultAsync(d => d.Id == id, ct)
            ?? throw new ResourceNotFoundException($"Không tìm thấy mã giảm giá #{id}");

        db.DiscountCodes.Remove(entity);
        await db.SaveChangesAsync(ct);
    }

    public async Task<ValidateDiscountResult> ValidateCodeAsync(string code, decimal contractAmount, CancellationToken ct)
    {
        var trimmed = (code ?? string.Empty).Trim().ToUpperInvariant();
        if (string.IsNullOrWhiteSpace(trimmed))
        {
            return new ValidateDiscountResult(false, "Vui lòng nhập mã giảm giá.", null, null, 0, 0, contractAmount);
        }

        var now = clock.GetUtcNow().UtcDateTime;
        var entity = await db.DiscountCodes.AsNoTracking().FirstOrDefaultAsync(d => d.Code == trimmed, ct);
        if (entity == null)
        {
            return new ValidateDiscountResult(false, $"Mã giảm giá '{trimmed}' không tồn tại.", trimmed, null, 0, 0, contractAmount);
        }

        if (!entity.IsActive)
        {
            return new ValidateDiscountResult(false, $"Mã giảm giá '{trimmed}' hiện đang tạm khóa.", trimmed, null, 0, 0, contractAmount);
        }

        if (entity.StartDateUtc.HasValue && entity.StartDateUtc.Value > now)
        {
            return new ValidateDiscountResult(false, $"Mã giảm giá '{trimmed}' chưa đến thời gian áp dụng (bắt đầu từ {entity.StartDateUtc.Value:dd/MM/yyyy}).", trimmed, null, 0, 0, contractAmount);
        }

        if (entity.EndDateUtc.HasValue && entity.EndDateUtc.Value < now)
        {
            return new ValidateDiscountResult(false, $"Mã giảm giá '{trimmed}' đã hết hạn vào ngày {entity.EndDateUtc.Value:dd/MM/yyyy}.", trimmed, null, 0, 0, contractAmount);
        }

        if (entity.UsageLimit.HasValue && entity.UsedCount >= entity.UsageLimit.Value)
        {
            return new ValidateDiscountResult(false, $"Mã giảm giá '{trimmed}' đã hết lượt sử dụng.", trimmed, null, 0, 0, contractAmount);
        }

        if (contractAmount < entity.MinContractValue)
        {
            return new ValidateDiscountResult(false, $"Mã '{trimmed}' chỉ áp dụng cho hợp đồng từ {entity.MinContractValue:N0} VNĐ trở lên (giá trị hiện tại: {contractAmount:N0} VNĐ).", trimmed, null, 0, 0, contractAmount);
        }

        decimal discountAmount;
        decimal discountPercent;

        if (entity.DiscountType == DiscountType.Percentage)
        {
            discountPercent = entity.DiscountValue;
            discountAmount = contractAmount * (discountPercent / 100m);
            if (entity.MaxDiscountAmount.HasValue && discountAmount > entity.MaxDiscountAmount.Value)
            {
                discountAmount = entity.MaxDiscountAmount.Value;
                discountPercent = contractAmount > 0 ? Math.Round((discountAmount / contractAmount) * 100m, 2) : 0;
            }
        }
        else
        {
            discountAmount = Math.Min(contractAmount, entity.DiscountValue);
            discountPercent = contractAmount > 0 ? Math.Round((discountAmount / contractAmount) * 100m, 2) : 0;
        }

        var finalAmount = Math.Max(0, contractAmount - discountAmount);

        return new ValidateDiscountResult(
            true,
            $"Áp dụng thành công mã {trimmed}: Giảm {discountAmount:N0} VNĐ.",
            entity.Code,
            entity.DiscountType,
            discountPercent,
            discountAmount,
            finalAmount);
    }

    public async Task<BestDiscountResult> GetBestDiscountAsync(decimal contractAmount, CancellationToken ct)
    {
        if (contractAmount <= 0)
        {
            return new BestDiscountResult(false, null, null, null, 0, 0, 0, "Giá trị hợp đồng không hợp lệ.");
        }

        var now = clock.GetUtcNow().UtcDateTime;
        var candidates = await db.DiscountCodes
            .AsNoTracking()
            .Where(d => d.IsActive
                && (!d.StartDateUtc.HasValue || d.StartDateUtc.Value <= now)
                && (!d.EndDateUtc.HasValue || d.EndDateUtc.Value >= now)
                && (!d.UsageLimit.HasValue || d.UsedCount < d.UsageLimit.Value)
                && d.MinContractValue <= contractAmount)
            .ToListAsync(ct);

        if (candidates.Count == 0)
        {
            return new BestDiscountResult(false, null, null, null, 0, 0, contractAmount, "Không có mã giảm giá nào phù hợp với giá trị hợp đồng này.");
        }

        DiscountCode? bestCode = null;
        decimal maxDiscount = -1;
        decimal bestPercent = 0;

        foreach (var c in candidates)
        {
            decimal amt;
            decimal pct;
            if (c.DiscountType == DiscountType.Percentage)
            {
                pct = c.DiscountValue;
                amt = contractAmount * (pct / 100m);
                if (c.MaxDiscountAmount.HasValue && amt > c.MaxDiscountAmount.Value)
                {
                    amt = c.MaxDiscountAmount.Value;
                    pct = Math.Round((amt / contractAmount) * 100m, 2);
                }
            }
            else
            {
                amt = Math.Min(contractAmount, c.DiscountValue);
                pct = Math.Round((amt / contractAmount) * 100m, 2);
            }

            if (amt > maxDiscount)
            {
                maxDiscount = amt;
                bestCode = c;
                bestPercent = pct;
            }
        }

        if (bestCode == null || maxDiscount <= 0)
        {
            return new BestDiscountResult(false, null, null, null, 0, 0, contractAmount, "Không tìm thấy mã giảm giá áp dụng được.");
        }

        var final = Math.Max(0, contractAmount - maxDiscount);
        return new BestDiscountResult(
            true,
            bestCode.Code,
            bestCode.Description,
            bestCode.DiscountType,
            bestPercent,
            maxDiscount,
            final,
            $"Đã tự động chọn mã tối ưu nhất '{bestCode.Code}' ({bestCode.Description}): Giảm {maxDiscount:N0} VNĐ ({bestPercent}%).");
    }

    private static DiscountCodeView ToView(DiscountCode d) => new(
        d.Id,
        d.Code,
        d.Description,
        d.DiscountType,
        d.DiscountType == DiscountType.Percentage ? $"{d.DiscountValue:0.##}%" : $"{d.DiscountValue:N0} đ",
        d.DiscountValue,
        d.MinContractValue,
        d.MaxDiscountAmount,
        d.StartDateUtc,
        d.EndDateUtc,
        d.UsageLimit,
        d.UsedCount,
        d.IsActive,
        d.CreatedByUserId,
        d.CreatedByUser?.FullName ?? "Platform Admin",
        d.CreatedAtUtc);
}
