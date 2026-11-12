using SmartFarm.Application.Features.IoTDeployment;
using SmartFarm.Domain.Entities;
using Xunit;

namespace SmartFarm.Api.Tests;

/// <summary>View yêu cầu triển khai kèm ngữ cảnh (farm, thửa đất, Zone, cây, vụ) để người nhận biết lắp đặt ở đâu.</summary>
public class DeploymentContextViewTests
{
    private static DeploymentRequest Request(bool withGraph)
    {
        var r = new DeploymentRequest { RequiredParametersCsv = "Temperature,SoilMoisture" };
        if (!withGraph) return r;
        var farm = new Farm { Name = "Farm A", LocationText = "Da Lat" };
        var field = new Field { Name = "Lo A1", SoilType = "Loam" };
        var zone = new Zone { Name = "Nha mang Z01", ZoneType = "Greenhouse", AreaM2 = 1926, Field = field };
        var crop = new Crop { Name = "Ca chua" };
        var season = new PlantingSeason
        {
            Name = "Vu Dong Xuan", Crop = crop, Variety = new CropVariety { Name = "Beefsteak" },
            StartDate = new DateOnly(2026, 11, 1), ExpectedEndDate = new DateOnly(2027, 2, 1), Status = SmartFarm.Domain.Enums.PlantingSeasonStatus.Planned,
        };
        r.Farm = farm; r.Zone = zone; r.PlantingSeason = season;
        return r;
    }

    [Fact]
    public void View_IncludesZoneFieldFarmCropAndSeasonContext()
    {
        var c = Request(withGraph: true).ToView().Context!;
        Assert.Equal("Farm A", c.FarmName);
        Assert.Equal("Da Lat", c.FarmLocation);
        Assert.Equal("Lo A1", c.FieldName);
        Assert.Equal("Loam", c.SoilType);
        Assert.Equal("Nha mang Z01", c.ZoneName);
        Assert.Equal("Greenhouse", c.ZoneType);
        Assert.Equal(1926m, c.ZoneAreaM2);
        Assert.Equal("Ca chua", c.CropName);
        Assert.Equal("Beefsteak", c.VarietyName);
        Assert.Equal("Vu Dong Xuan", c.SeasonName);
        Assert.Equal("Planned", c.SeasonStatus);
        Assert.Equal(new DateOnly(2026, 11, 1), c.SeasonStartDate);
        Assert.Equal(new DateOnly(2027, 2, 1), c.SeasonExpectedEndDate);
    }

    [Fact]
    public void View_WithoutLoadedRelations_HasNullContext_AndDoesNotThrow()
    {
        var view = Request(withGraph: false).ToView();
        Assert.Null(view.Context);
        Assert.Equal(2, view.RequiredParameters.Count);
    }
}
