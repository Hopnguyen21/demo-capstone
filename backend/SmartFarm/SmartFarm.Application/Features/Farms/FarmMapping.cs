using SmartFarm.Domain.Entities;

namespace SmartFarm.Application.Features.Farms;

public static class FarmMapping
{
    public static Farm ToEntity(this CreateFarmCommand command, Guid tenantId) => new()
    {
        TenantId = tenantId,
        Name = command.Name,
        LocationText = command.LocationText,
        Latitude = command.Latitude,
        Longitude = command.Longitude,
        TotalAreaM2 = command.TotalAreaM2,
        TimeZone = command.TimeZone
    };

    public static void ApplyTo(this UpdateFarmCommand command, Farm farm)
    {
        farm.Name = command.Name;
        farm.LocationText = command.LocationText;
        farm.Latitude = command.Latitude;
        farm.Longitude = command.Longitude;
        farm.TotalAreaM2 = command.TotalAreaM2;
        farm.TimeZone = command.TimeZone;
    }
}
