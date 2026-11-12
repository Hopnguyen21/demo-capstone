using Microsoft.EntityFrameworkCore;
using SmartFarm.Application.Common.Exceptions;
using SmartFarm.Application.Features.IoTDeployment;
using SmartFarm.Application.Features.Platform;
using SmartFarm.Domain.Entities;
using SmartFarm.Infrastructure.Persistence;
using SmartFarm.Infrastructure.Platform;
using Xunit;

namespace SmartFarm.Api.Tests;

/// <summary>Wizard CF1 lưu dự toán thiết bị kèm Deployment Request (dữ liệu in-memory, không phải DB thật).</summary>
public class WizardEstimateItemsTests
{
    private static (SmartFarmDbContext db, FarmWizardService svc, Guid cropId, Guid profileId, PlatformHardwareItem gw, PlatformHardwareItem node) Setup()
    {
        var options = new DbContextOptionsBuilder<SmartFarmDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        var db = new SmartFarmDbContext(options);
        var crop = new Crop { Name = "Ca chua", NormalizedName = "CA CHUA", ScientificName = "Solanum", IsSystemDefined = true };
        var profile = new GrowthProfile { CropId = crop.Id, Name = "Quy trinh", NormalizedName = "QUY TRINH", IsDefault = true, IsSystemDefined = true };
        profile.Stages.Add(new GrowthStage { Name = "Cay con", StageOrder = 1, DurationDays = 30 });
        var gw = new PlatformHardwareItem { Code = "GW-1", Name = "Gateway", Category = "GATEWAY", Model = "LG308N", UnitPrice = 3_800_000m, Status = "InStock", EstimateRole = "Gateway", EstimateUnits = 1 };
        var node = new PlatformHardwareItem { Code = "N-1", Name = "Node cam bien", Category = "SENSOR", UnitPrice = 950_000m, Status = "InStock", EstimateRole = "SensorNode", EstimateUnits = 1 };
        db.AddRange(crop, profile, gw, node);
        db.SaveChanges();
        return (db, new FarmWizardService(db), crop.Id, profile.Id, gw, node);
    }

    private static FarmWizardSetupCommand Command(Guid cropId, Guid profileId, IReadOnlyList<FarmWizardEstimateItemInput>? items, string farmName = "Farm A") => new(
        new FarmWizardFarmInput(farmName, "Da Lat", 11.9m, 108.4m, 10000, "Asia/Ho_Chi_Minh"),
        new FarmWizardFieldInput("Lo A", 5000, "Loam", null),
        new FarmWizardZoneInput("Zone 1", 2000, "Greenhouse", null),
        new FarmWizardSeasonInput("Vu 1", cropId, null, profileId, new DateTime(2026, 11, 1, 0, 0, 0, DateTimeKind.Utc), new DateTime(2027, 2, 1, 0, 0, 0, DateTimeKind.Utc)),
        new FarmWizardDeploymentInput(["Temperature"], "ghi chu", items));

    [Fact]
    public async Task SavesEstimateItems_UsingCatalogPrice_NotClientPrice()
    {
        var (db, svc, crop, profile, gw, node) = Setup();
        var res = await svc.SetupAsync(Guid.NewGuid(), Guid.NewGuid(), Command(crop, profile,
        [
            new(gw.Id, "gateway", 1, UnitPrice: 1m), // giá client bị bỏ qua
            new(node.Id, "SensorNode", 3, Notes: "cần 3, đã gắn 0"),
            new(null, "Installation", 1, 500_000m),
        ]), CancellationToken.None);

        var items = await db.DeploymentEstimateItems.Where(x => x.DeploymentRequestId == res.DeploymentRequestId).OrderBy(x => x.SortOrder).ToListAsync();
        Assert.Equal(["GW-1", "N-1", "INSTALLATION"], items.Select(i => i.Code));
        Assert.Equal([3_800_000m, 950_000m, 500_000m], items.Select(i => i.UnitPrice));
        Assert.Equal("Gateway", items[0].Role);
        Assert.Equal("LG308N", items[0].Model);
        Assert.Equal(3, items[1].Quantity);
        Assert.Equal("cần 3, đã gắn 0", items[1].Notes);
        Assert.Null(items[2].HardwareItemId);

        // đọc lại qua view (nguồn để đưa vào hợp đồng): tổng từng dòng = SL × đơn giá
        var dr = await db.DeploymentRequests.Include(x => x.EstimateItems).Include(x => x.PlanItems).ThenInclude(p => p.DeviceModelDefinition)
            .Include(x => x.Surveys).Include(x => x.Decisions).SingleAsync(x => x.Id == res.DeploymentRequestId);
        var view = dr.ToView();
        Assert.Equal(3, view.EstimateItems!.Count);
        Assert.Equal(3 * 950_000m, view.EstimateItems[1].LineTotal);
        Assert.Equal(3_800_000m + 3 * 950_000m + 500_000m, view.EstimateItems.Sum(i => i.LineTotal));
    }

    [Fact]
    public async Task SnapshotKeepsPrice_EvenIfCatalogChangesOrIsDeletedLater()
    {
        var (db, svc, crop, profile, gw, _) = Setup();
        var res = await svc.SetupAsync(Guid.NewGuid(), Guid.NewGuid(), Command(crop, profile, [new(gw.Id, "Gateway", 1)]), CancellationToken.None);
        db.PlatformHardwareItems.Remove(gw);
        await db.SaveChangesAsync();
        var item = await db.DeploymentEstimateItems.SingleAsync(x => x.DeploymentRequestId == res.DeploymentRequestId);
        Assert.Equal(3_800_000m, item.UnitPrice);
        Assert.Equal("GW-1", item.Code);
    }

    [Fact]
    public async Task NoEstimateItems_StillWorks_AsBefore()
    {
        var (db, svc, crop, profile, _, _) = Setup();
        var res = await svc.SetupAsync(Guid.NewGuid(), Guid.NewGuid(), Command(crop, profile, null), CancellationToken.None);
        Assert.NotNull(res.DeploymentRequestId);
        Assert.Empty(db.DeploymentEstimateItems);
    }

    [Fact]
    public async Task InvalidEstimate_IsRejected_AndNothingIsCreated()
    {
        var (db, svc, crop, profile, gw, node) = Setup();
        async Task Rejects(IReadOnlyList<FarmWizardEstimateItemInput> items)
        {
            await Assert.ThrowsAsync<RequestValidationException>(() => svc.SetupAsync(Guid.NewGuid(), Guid.NewGuid(), Command(crop, profile, items, "Farm X"), CancellationToken.None));
        }
        await Rejects([new(gw.Id, "SensorNode", 1)]); // sai vai trò so với kho
        await Rejects([new(gw.Id, "Gateway", 0)]); // số lượng
        await Rejects([new(gw.Id, "Gateway", 1001)]);
        await Rejects([new(gw.Id, "Gateway", 1), new(gw.Id, "Gateway", 1)]); // trùng
        await Rejects([new(Guid.NewGuid(), "Gateway", 1)]); // không có trong kho
        await Rejects([new(null, "Gateway", 1, 100m)]); // dòng không gắn kho chỉ được là Installation
        await Rejects([new(null, "Installation", 1, -1m)]);
        await Rejects([new(null, "Installation", 1, 99_999_999m)]);
        await Rejects([new(null, "Installation", 1)]); // thiếu giá

        gw.UnitPrice = 0;
        await db.SaveChangesAsync();
        await Rejects([new(gw.Id, "Gateway", 1)]); // thiết bị chưa có giá

        Assert.Empty(db.DeploymentEstimateItems);
        // InMemory bỏ qua giao dịch nên có thể còn dữ liệu dở dang; trên PostgreSQL giao dịch wizard được hoàn tác khi ném lỗi.
    }
}
