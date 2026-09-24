using SmartFarm.Domain.Enums;

namespace SmartFarm.Application.Features.Farms;

public sealed record CreateFarmCommand(
    string Name,
    string? LocationText,
    decimal? Latitude,
    decimal? Longitude,
    decimal TotalAreaM2,
    string TimeZone);

public sealed record UpdateFarmCommand(
    string Name,
    string? LocationText,
    decimal? Latitude,
    decimal? Longitude,
    decimal TotalAreaM2,
    string TimeZone);

public sealed record FarmSummaryView(
    Guid FarmId,
    string Name,
    FarmStatus Status,
    decimal TotalAreaM2,
    int FieldsCount,
    int ZonesCount);

public sealed record FarmDetailView(
    Guid FarmId,
    Guid TenantId,
    string Name,
    string? LocationText,
    decimal? Latitude,
    decimal? Longitude,
    decimal TotalAreaM2,
    string TimeZone,
    FarmStatus Status,
    int FieldsCount,
    int ZonesCount,
    DateTime CreatedAtUtc,
    DateTime? UpdatedAtUtc,
    DateTime? ArchivedAtUtc);

public sealed record FarmStructureView(
    Guid FarmId,
    string Name,
    FarmStatus Status,
    bool IsReadyForIoT,
    IReadOnlyList<Fields.FieldStructureView> Fields);

public sealed record ArchiveView(string Message, DateTime ArchivedAtUtc);
