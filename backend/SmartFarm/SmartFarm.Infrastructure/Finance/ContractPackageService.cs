using Microsoft.EntityFrameworkCore;
using SmartFarm.Application.Common.Exceptions;
using SmartFarm.Application.Features.Finance;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;

namespace SmartFarm.Infrastructure.Finance;

public sealed class ContractPackageService(SmartFarmDbContext db, TimeProvider clock) : IContractPackageService
{
    public async Task<IReadOnlyList<ContractPackageView>> GetAllPackagesAsync(bool? activeOnly, bool? isCustom = false, CancellationToken ct = default)
    {
        var query = db.ContractPackages
            .Include(p => p.CreatedByUser)
            .AsNoTracking();

        if (activeOnly.HasValue && activeOnly.Value)
        {
            query = query.Where(p => p.Status == PackageStatus.Active);
        }

        if (isCustom.HasValue)
        {
            query = query.Where(p => p.IsCustom == isCustom.Value);
        }

        var packages = await query.OrderBy(p => p.Price).ToListAsync(ct);
        return packages.Select(MapToView).ToList();
    }

    public async Task<ContractPackageView> GetPackageByIdAsync(Guid id, CancellationToken ct)
    {
        var package = await db.ContractPackages
            .Include(p => p.CreatedByUser)
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == id, ct)
            ?? throw new ResourceNotFoundException($"Không tìm thấy gói hợp đồng #{id}");

        return MapToView(package);
    }

    public async Task<ContractPackageView> CreatePackageAsync(Guid userId, CreateContractPackageCommand command, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(command.PackageName))
        {
            throw new RequestValidationException("packageName", "Tên gói hợp đồng là bắt buộc.");
        }

        if (command.DurationMonths <= 0)
        {
            throw new RequestValidationException("durationMonths", "Thời hạn gói (tháng) phải lớn hơn 0.");
        }

        if (command.MaxZones <= 0)
        {
            throw new RequestValidationException("maxZones", "Số lượng Zone tối đa phải lớn hơn 0.");
        }

        if (command.Price < 0)
        {
            throw new RequestValidationException("price", "Giá gói hợp đồng không được âm.");
        }

        var package = new ContractPackage
        {
            PackageName = command.PackageName.Trim(),
            Description = command.Description?.Trim(),
            DurationMonths = command.DurationMonths,
            MaxZones = command.MaxZones,
            Price = command.Price,
            Currency = string.IsNullOrWhiteSpace(command.Currency) ? "VND" : command.Currency.Trim(),
            Status = PackageStatus.Active,
            CreatedByUserId = userId
        };

        db.ContractPackages.Add(package);
        await db.SaveChangesAsync(ct);

        return await GetPackageByIdAsync(package.Id, ct);
    }

    public async Task<ContractPackageView> UpdatePackageAsync(Guid userId, Guid id, UpdateContractPackageCommand command, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(command.PackageName))
        {
            throw new RequestValidationException("packageName", "Tên gói hợp đồng là bắt buộc.");
        }

        if (command.DurationMonths <= 0)
        {
            throw new RequestValidationException("durationMonths", "Thời hạn gói (tháng) phải lớn hơn 0.");
        }

        if (command.MaxZones <= 0)
        {
            throw new RequestValidationException("maxZones", "Số lượng Zone tối đa phải lớn hơn 0.");
        }

        if (command.Price < 0)
        {
            throw new RequestValidationException("price", "Giá gói hợp đồng không được âm.");
        }

        var package = await db.ContractPackages.FirstOrDefaultAsync(p => p.Id == id, ct)
            ?? throw new ResourceNotFoundException($"Không tìm thấy gói hợp đồng #{id}");

        package.PackageName = command.PackageName.Trim();
        package.Description = command.Description?.Trim();
        package.DurationMonths = command.DurationMonths;
        package.MaxZones = command.MaxZones;
        package.Price = command.Price;
        if (!string.IsNullOrWhiteSpace(command.Currency)) package.Currency = command.Currency.Trim();
        if (command.Status.HasValue) package.Status = command.Status.Value;

        package.UpdatedAtUtc = clock.GetUtcNow().UtcDateTime;
        await db.SaveChangesAsync(ct);

        return await GetPackageByIdAsync(package.Id, ct);
    }

    public async Task<ContractPackageView> TogglePackageStatusAsync(Guid userId, Guid id, CancellationToken ct)
    {
        var package = await db.ContractPackages.FirstOrDefaultAsync(p => p.Id == id, ct)
            ?? throw new ResourceNotFoundException($"Không tìm thấy gói hợp đồng #{id}");

        package.Status = package.Status == PackageStatus.Active ? PackageStatus.Inactive : PackageStatus.Active;
        package.UpdatedAtUtc = clock.GetUtcNow().UtcDateTime;
        await db.SaveChangesAsync(ct);

        return await GetPackageByIdAsync(package.Id, ct);
    }

    public async Task DeletePackageAsync(Guid userId, Guid id, CancellationToken ct)
    {
        var package = await db.ContractPackages.FirstOrDefaultAsync(p => p.Id == id, ct)
            ?? throw new ResourceNotFoundException($"Không tìm thấy gói hợp đồng #{id}");

        var hasAssociatedContracts = await db.ZoneContracts.AnyAsync(c => c.ContractPackageId == id, ct);
        if (hasAssociatedContracts)
        {
            throw new ResourceConflictException("Không thể xóa gói hợp đồng đã được liên kết với Hợp đồng trong hệ thống. Bạn có thể Vô hiệu hóa (Deactivate) gói thay thế.");
        }

        db.ContractPackages.Remove(package);
        await db.SaveChangesAsync(ct);
    }

    private static ContractPackageView MapToView(ContractPackage p)
    {
        return new ContractPackageView(
            p.Id,
            p.PackageName,
            p.Description,
            p.DurationMonths,
            p.MaxZones,
            p.Price,
            p.Currency,
            p.Status,
            p.Status == PackageStatus.Active ? "Đang áp dụng" : "Vô hiệu hóa",
            p.CreatedByUserId,
            p.CreatedByUser?.FullName ?? "Quản trị viên",
            p.CreatedAtUtc,
            p.UpdatedAtUtc,
            p.IsCustom,
            p.CustomerName,
            p.ContractId
        );
    }
}

