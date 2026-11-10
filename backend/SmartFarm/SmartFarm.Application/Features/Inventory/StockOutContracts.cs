using SmartFarm.Domain.Enums;

namespace SmartFarm.Application.Features.Inventory;

public sealed record StockOutDetailView(
    Guid Id,
    Guid StockOutId,
    Guid InventoryItemId,
    string ItemName,
    string Unit,
    decimal Quantity,
    decimal CurrentStock,
    string? Notes);

public sealed record StockOutView(
    Guid Id,
    Guid TenantId,
    Guid FarmId,
    string FarmName,
    Guid? ZoneId,
    string? ZoneName,
    string StockOutCode,
    StockOutStatus Status,
    string StatusText,
    Guid CreatedByUserId,
    string CreatedByName,
    Guid? ApprovedByUserId,
    string? ApprovedByName,
    DateTime? CompletedAtUtc,
    string? Notes,
    DateTime CreatedAtUtc,
    IReadOnlyList<StockOutDetailView> Details);

public sealed record CreateStockOutDetailCommand(
    Guid InventoryItemId,
    decimal Quantity,
    string? Notes);

public sealed record CreateStockOutCommand(
    Guid? ZoneId,
    string? Notes,
    IReadOnlyList<CreateStockOutDetailCommand> Details);

public sealed record UpdateStockOutCommand(
    Guid? ZoneId,
    string? Notes,
    IReadOnlyList<CreateStockOutDetailCommand> Details);

public sealed record UpdateStockOutStatusCommand(
    StockOutStatus Status,
    string? Notes);

public interface IStockOutService
{
    Task<IReadOnlyList<StockOutView>> GetListAsync(Guid userId, Guid tenantId, Guid farmId, StockOutStatus? status, CancellationToken ct);
    Task<StockOutView> GetByIdAsync(Guid userId, Guid tenantId, Guid farmId, Guid id, CancellationToken ct);
    Task<StockOutView> CreateAsync(Guid userId, Guid tenantId, Guid farmId, CreateStockOutCommand command, CancellationToken ct);
    Task<StockOutView> UpdateAsync(Guid userId, Guid tenantId, Guid farmId, Guid id, UpdateStockOutCommand command, CancellationToken ct);
    Task<StockOutView> UpdateStatusAsync(Guid userId, Guid tenantId, Guid farmId, Guid id, UpdateStockOutStatusCommand command, CancellationToken ct);
    Task DeleteAsync(Guid userId, Guid tenantId, Guid farmId, Guid id, CancellationToken ct);
}

