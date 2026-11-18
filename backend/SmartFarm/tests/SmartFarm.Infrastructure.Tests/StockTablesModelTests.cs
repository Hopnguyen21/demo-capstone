using Microsoft.EntityFrameworkCore;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Inventory;
using SmartFarm.Infrastructure.Persistence;
using Xunit;

namespace SmartFarm.Infrastructure.Tests;

/// <summary>Khóa cấu hình bảng StockIns/StockOuts: mã phiếu duy nhất theo farm, cột InventoryItemId đa nghĩa không có FK.</summary>
public sealed class StockTablesModelTests
{
    private static SmartFarmDbContext NpgsqlModel() => new(new DbContextOptionsBuilder<SmartFarmDbContext>()
        .UseNpgsql("Host=localhost;Database=smartfarm_model_tests;Username=smartfarm", o => { o.UseNetTopologySuite(); o.UseVector(); })
        .Options);

    private static SmartFarmDbContext InMemory() =>
        new(new DbContextOptionsBuilder<SmartFarmDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    [Theory]
    [InlineData(typeof(StockIn), nameof(StockIn.StockInCode))]
    [InlineData(typeof(StockOut), nameof(StockOut.StockOutCode))]
    public void Voucher_code_is_unique_per_tenant_and_farm(Type entity, string codeProp)
    {
        using var db = NpgsqlModel();
        var type = db.Model.FindEntityType(entity)!;
        Assert.Contains(type.GetIndexes(), i => i.IsUnique
            && i.Properties.Select(p => p.Name).SequenceEqual(new[] { "TenantId", "FarmId", codeProp }));
    }

    [Theory]
    [InlineData(typeof(StockInDetail))]
    [InlineData(typeof(StockOutDetail))]
    public void Detail_item_id_is_polymorphic_so_it_has_no_foreign_key(Type entity)
    {
        using var db = NpgsqlModel();
        var type = db.Model.FindEntityType(entity)!;
        Assert.DoesNotContain(type.GetForeignKeys(), fk => fk.Properties.Any(p => p.Name == "InventoryItemId"));
        Assert.Contains(type.GetIndexes(), i => i.Properties.Any(p => p.Name == "InventoryItemId"));
    }

    [Fact]
    public void StockIn_quantity_and_price_precision_match_database()
    {
        using var db = NpgsqlModel();
        var d = db.Model.FindEntityType(typeof(StockInDetail))!;
        Assert.Equal(4, d.FindProperty(nameof(StockInDetail.Quantity))!.GetScale());
        Assert.Equal(2, d.FindProperty(nameof(StockInDetail.UnitPrice))!.GetScale());
    }

    [Fact]
    public void FarmingSeason_text_columns_match_database_lengths()
    {
        using var db = NpgsqlModel();
        var t = db.Model.FindEntityType(typeof(FarmingSeason))!;
        Assert.Equal(100, t.FindProperty(nameof(FarmingSeason.Code))!.GetMaxLength());
        Assert.Equal(250, t.FindProperty(nameof(FarmingSeason.Name))!.GetMaxLength());
        Assert.Equal(50, t.FindProperty(nameof(FarmingSeason.Status))!.GetMaxLength());
    }

    [Fact]
    public void Contract_and_depreciation_tables_have_indexed_foreign_keys()
    {
        using var db = NpgsqlModel();
        foreach (var type in new[] { typeof(DeviceDepreciation), typeof(ZoneContractRenewal), typeof(ZoneContract) })
        {
            var e = db.Model.FindEntityType(type)!;
            foreach (var fk in e.GetForeignKeys())
                Assert.Contains(e.GetIndexes(), i => i.Properties.Count > 0 && i.Properties[0] == fk.Properties[0]);
        }
    }
}

public sealed class StockOutServiceRequestLinkTests
{
    [Fact]
    public void StockOut_has_optional_foreign_key_to_ServiceRequest_with_SetNull()
    {
        using var db = new SmartFarmDbContext(new DbContextOptionsBuilder<SmartFarmDbContext>()
            .UseNpgsql("Host=localhost;Database=smartfarm_model_tests;Username=smartfarm", o => { o.UseNetTopologySuite(); o.UseVector(); })
            .Options);
        var t = db.Model.FindEntityType(typeof(StockOut))!;
        var fk = Assert.Single(t.GetForeignKeys(), f => f.PrincipalEntityType.ClrType == typeof(ServiceRequest));
        Assert.Equal("ServiceRequestId", fk.Properties.Single().Name);
        Assert.False(fk.IsRequired);
        Assert.Equal(DeleteBehavior.SetNull, fk.DeleteBehavior);
    }

}
