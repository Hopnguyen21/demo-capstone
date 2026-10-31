using System.Text.Json;
using SmartFarm.Domain.Enums;

namespace SmartFarm.Application.Features.Zones;

public sealed record CreateZoneCommand(
    string Name,
    decimal AreaM2,
    JsonElement BoundaryGeoJson,
    string ZoneType,
    string? Notes,
    Guid? CropId = null,
    Guid? VarietyId = null);

public sealed record UpdateZoneCommand(
    string Name,
    decimal? AreaM2,
    JsonElement? BoundaryGeoJson,
    string? ZoneType,
    string? Notes,
    ZoneStatus? Status,
    // Cây/giống hiện tại của Zone: bỏ trống CropId thì giữ nguyên; ClearCrop = true để chuyển Zone về trạng thái chưa gán cây.
    Guid? CropId = null,
    Guid? VarietyId = null,
    bool ClearCrop = false);

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
    DateTime? ArchivedAtUtc,
    string? CurrentCrop = null,
    string? CurrentStage = null,
    Guid? CropId = null,
    Guid? VarietyId = null,
    string? CropName = null,
    string? VarietyName = null,
    // None | InProgress | Mismatch (vụ đang chạy khác cây của Zone hoặc Zone chưa gán cây) | PlannedOnly
    string SeasonStatus = "None",
    string? SeasonName = null,
    string? SeasonCropName = null,
    string? PlannedCrop = null);
