using SmartFarm.Domain.Entities;

namespace SmartFarm.Application.Features.Fields;

public static class FieldMapping
{
    public static Field ToEntity(this CreateFieldCommand command, Guid farmId, string boundaryGeoJson) => new()
    {
        FarmId = farmId,
        Name = command.Name,
        AreaM2 = command.AreaM2,
        AvailableAreaM2 = command.AreaM2,
        SoilType = command.SoilType,
        Latitude = command.Latitude,
        Longitude = command.Longitude,
        BoundaryGeoJson = boundaryGeoJson
    };

    public static void ApplyTo(this UpdateFieldCommand command, Field field, string? boundaryGeoJson)
    {
        field.Name = command.Name;
        field.SoilType = command.SoilType;
        field.Latitude = command.Latitude;
        field.Longitude = command.Longitude;
        if (boundaryGeoJson is not null)
        {
            field.BoundaryGeoJson = boundaryGeoJson;
        }
    }
}
