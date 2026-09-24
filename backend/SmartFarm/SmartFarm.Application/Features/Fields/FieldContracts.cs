using System.Text.Json;
using SmartFarm.Application.Features.Zones;

namespace SmartFarm.Application.Features.Fields;

public sealed record CreateFieldCommand(
    string Name,
    decimal AreaM2,
    string? SoilType,
    decimal? Latitude,
    decimal? Longitude,
    JsonElement BoundaryGeoJson);

public sealed record UpdateFieldCommand(
    string Name,
    string? SoilType,
    decimal? Latitude,
    decimal? Longitude,
    JsonElement? BoundaryGeoJson);

public sealed record FieldSummaryView(
    Guid FieldId,
    Guid FarmId,
    string Name,
    decimal AreaM2,
    decimal AvailableAreaM2,
    int ZonesCount);

public sealed record FieldDetailView(
    Guid FieldId,
    Guid FarmId,
    string Name,
    decimal AreaM2,
    decimal AvailableAreaM2,
    string? SoilType,
    decimal? Latitude,
    decimal? Longitude,
    JsonElement? BoundaryGeoJson,
    IReadOnlyList<ZoneSummaryView> Zones,
    DateTime CreatedAtUtc,
    DateTime? UpdatedAtUtc,
    DateTime? ArchivedAtUtc);

public sealed record FieldStructureView(
    Guid FieldId,
    string Name,
    decimal AreaM2,
    decimal AvailableAreaM2,
    IReadOnlyList<ZoneSummaryView> Zones);
