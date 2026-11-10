using Microsoft.EntityFrameworkCore;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;
using Xunit;

namespace SmartFarm.Infrastructure.Tests;

public sealed class NewFeaturesTests
{
    private static SmartFarmDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<SmartFarmDbContext>()
            .UseNpgsql("Host=localhost;Database=smartfarm_model_tests;Username=smartfarm", options =>
            {
                options.UseNetTopologySuite();
                options.UseVector();
            })
            .Options;

        return new SmartFarmDbContext(options);
    }

    [Fact]
    public void Model_contains_StockOut_Bill_and_ContractPackage_entities()
    {
        using var context = CreateContext();
        var entityTypes = context.Model.GetEntityTypes().Select(x => x.ClrType).ToHashSet();

        Assert.Contains(typeof(StockOut), entityTypes);
        Assert.Contains(typeof(StockOutDetail), entityTypes);
        Assert.Contains(typeof(Bill), entityTypes);
        Assert.Contains(typeof(ContractPackage), entityTypes);
    }

    [Fact]
    public void ZoneContract_has_optional_ContractPackage_relationship()
    {
        using var context = CreateContext();
        var zoneContractType = context.Model.FindEntityType(typeof(ZoneContract));

        Assert.NotNull(zoneContractType);
        var packageProp = zoneContractType.FindProperty(nameof(ZoneContract.ContractPackageId));
        Assert.NotNull(packageProp);
        Assert.True(packageProp.IsNullable);
    }

    [Fact]
    public void StockOut_entity_has_required_header_and_detail_fields()
    {
        using var context = CreateContext();
        var stockOutType = context.Model.FindEntityType(typeof(StockOut));
        var detailType = context.Model.FindEntityType(typeof(StockOutDetail));

        Assert.NotNull(stockOutType);
        Assert.NotNull(detailType);

        Assert.NotNull(stockOutType.FindProperty(nameof(StockOut.StockOutCode)));
        Assert.NotNull(stockOutType.FindProperty(nameof(StockOut.Status)));
        Assert.NotNull(stockOutType.FindProperty(nameof(StockOut.CreatedByUserId)));

        Assert.NotNull(detailType.FindProperty(nameof(StockOutDetail.InventoryItemId)));
        Assert.NotNull(detailType.FindProperty(nameof(StockOutDetail.Quantity)));
    }

    [Fact]
    public void Bill_entity_has_required_financial_and_status_fields()
    {
        using var context = CreateContext();
        var billType = context.Model.FindEntityType(typeof(Bill));

        Assert.NotNull(billType);
        Assert.NotNull(billType.FindProperty(nameof(Bill.BillCode)));
        Assert.NotNull(billType.FindProperty(nameof(Bill.ContractId)));
        Assert.NotNull(billType.FindProperty(nameof(Bill.Amount)));
        Assert.NotNull(billType.FindProperty(nameof(Bill.PaidAmount)));
        Assert.NotNull(billType.FindProperty(nameof(Bill.RemainingAmount)));
        Assert.NotNull(billType.FindProperty(nameof(Bill.Status)));
    }

    [Fact]
    public void ContractPackage_entity_has_duration_maxzones_and_price_fields()
    {
        using var context = CreateContext();
        var packageType = context.Model.FindEntityType(typeof(ContractPackage));

        Assert.NotNull(packageType);
        Assert.NotNull(packageType.FindProperty(nameof(ContractPackage.PackageName)));
        Assert.NotNull(packageType.FindProperty(nameof(ContractPackage.DurationMonths)));
        Assert.NotNull(packageType.FindProperty(nameof(ContractPackage.MaxZones)));
        Assert.NotNull(packageType.FindProperty(nameof(ContractPackage.Price)));
        Assert.NotNull(packageType.FindProperty(nameof(ContractPackage.Status)));
    }
}

