using System.Text.Json;
using SmartFarm.Domain.Enums;

namespace SmartFarm.Application.Features.Zones;

public sealed record CreateZoneCommand(
    string Name,
    decimal AreaM2,
    JsonElement BoundaryGeoJson,
    string ZoneType,
    string? Notes);

public sealed record UpdateZoneCommand(
    string Name,
    decimal? AreaM2,
    JsonElement? BoundaryGeoJson,
    string? ZoneType,
    string? Notes,
    ZoneStatus? Status);

public sealed record ZoneSummaryView(
    Guid ZoneId,
    Guid FieldId,
    string Name,
    decimal AreaM2,
    string ZoneType,
    ZoneStatus Status);

public sealed record ZoneView(
    Guid ZoneId,
    Guid FieldId,
    Guid FarmId,
    string Name,
    decimal AreaM2,
    string ZoneType,
    string? Notes,
    ZoneStatus Status,
    JsonElement? BoundaryGeoJson,
    DateTime CreatedAtUtc,
    DateTime? UpdatedAtUtc,
    DateTime? ArchivedAtUtc);
