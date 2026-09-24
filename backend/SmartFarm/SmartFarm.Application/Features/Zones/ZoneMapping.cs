using SmartFarm.Domain.Entities;

namespace SmartFarm.Application.Features.Zones;

public static class ZoneMapping
{
    public static Zone ToEntity(this CreateZoneCommand command, Guid fieldId, string boundaryGeoJson) => new()
    {
        FieldId = fieldId,
        Name = command.Name,
        AreaM2 = command.AreaM2,
        BoundaryGeoJson = boundaryGeoJson,
        ZoneType = command.ZoneType,
        Notes = command.Notes
    };

    public static void ApplyTo(this UpdateZoneCommand command, Zone zone, string? boundaryGeoJson)
    {
        zone.Name = command.Name;
        if (command.AreaM2.HasValue)
        {
            zone.AreaM2 = command.AreaM2.Value;
        }
        if (boundaryGeoJson is not null)
        {
            zone.BoundaryGeoJson = boundaryGeoJson;
        }
        if (!string.IsNullOrWhiteSpace(command.ZoneType))
        {
            zone.ZoneType = command.ZoneType;
        }
        zone.Notes = command.Notes;
        if (command.Status.HasValue)
        {
            zone.Status = command.Status.Value;
        }
    }
}
