using SmartFarm.Domain.Enums;

namespace SmartFarm.Application.Features.Inventory;

public sealed record StockInDetailView(
    Guid Id,
    Guid StockInId,
    Guid InventoryItemId,
    string ItemName,
    string Unit,
    decimal Quantity,
    decimal UnitPrice,
    decimal TotalAmount,
    decimal CurrentStock,
    string? Notes);

public sealed record StockInView(
    Guid Id,
    Guid TenantId,
    Guid FarmId,
    string FarmName,
    string StockInCode,
    string? SupplierName,
    StockInStatus Status,
    string StatusText,
    decimal TotalAmount,
    int TotalItems,
    Guid CreatedByUserId,
    string CreatedByName,
    Guid? ApprovedByUserId,
    string? ApprovedByName,
    DateTime? CompletedAtUtc,
    string? Notes,
    DateTime CreatedAtUtc,
    IReadOnlyList<StockInDetailView> Details);

public sealed record CreateStockInDetailCommand(
    Guid InventoryItemId,
    decimal Quantity,
    decimal UnitPrice,
    string? Notes);

public sealed record CreateStockInCommand(
    string? SupplierName,
    string? Notes,
    IReadOnlyList<CreateStockInDetailCommand> Details);

public sealed record UpdateStockInCommand(
    string? SupplierName,
    string? Notes,
    IReadOnlyList<CreateStockInDetailCommand> Details);

public sealed record UpdateStockInStatusCommand(
    StockInStatus Status,
    string? Notes);

public interface IStockInService
{
    Task<IReadOnlyList<StockInView>> GetListAsync(Guid userId, Guid tenantId, Guid farmId, StockInStatus? status, CancellationToken ct);
    Task<StockInView> GetByIdAsync(Guid userId, Guid tenantId, Guid farmId, Guid id, CancellationToken ct);
    Task<StockInView> CreateAsync(Guid userId, Guid tenantId, Guid farmId, CreateStockInCommand command, CancellationToken ct);
    Task<StockInView> UpdateAsync(Guid userId, Guid tenantId, Guid farmId, Guid id, UpdateStockInCommand command, CancellationToken ct);
    Task<StockInView> UpdateStatusAsync(Guid userId, Guid tenantId, Guid farmId, Guid id, UpdateStockInStatusCommand command, CancellationToken ct);
    Task DeleteAsync(Guid userId, Guid tenantId, Guid farmId, Guid id, CancellationToken ct);
}
