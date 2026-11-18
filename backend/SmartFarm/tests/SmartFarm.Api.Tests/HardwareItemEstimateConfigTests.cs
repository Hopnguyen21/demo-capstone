using Microsoft.EntityFrameworkCore;
using SmartFarm.Application.Common.Exceptions;
using SmartFarm.Application.Features.Platform;
using SmartFarm.Infrastructure.Persistence;
using SmartFarm.Infrastructure.Platform;
using Xunit;

namespace SmartFarm.Api.Tests;

/// <summary>Danh mục phần cứng: lưu/giữ đúng đơn giá và cấu hình dự toán IoT (dữ liệu in-memory, không phải DB thật).</summary>
public class HardwareItemEstimateConfigTests
{
    private static PlatformAdminService NewService()
    {
        var options = new DbContextOptionsBuilder<SmartFarmDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        return new PlatformAdminService(new SmartFarmDbContext(options));
    }

    private static CreateHardwareItemCommand Create(string code, decimal price, string? role = null, int? units = null, IReadOnlyList<string>? measured = null) =>
        new(code, "Thiet bi " + code, "Actuator", "M-" + code, null, null, null, 5, null, price, "InWarehouse", role, units, measured);

    [Fact]
    public async Task Create_PersistsAndReturnsUnitPrice()
    {
        var svc = NewService();
        var created = await svc.CreateHardwareItemAsync(Create("A1", 1_200_000m), CancellationToken.None);
        Assert.Equal(1_200_000m, created.UnitPrice);
        var listed = (await svc.ListHardwareItemsAsync(CancellationToken.None)).Single();
        Assert.Equal(1_200_000m, listed.UnitPrice);
    }

    [Fact]
    public async Task Update_WithoutUnitPrice_KeepsExistingPrice_RegressionForWebFormThatOmittedPrice()
    {
        var svc = NewService();
        var created = await svc.CreateHardwareItemAsync(Create("A1", 4_500_000m), CancellationToken.None);
        // Client cũ (form sửa trên web) không gửi unitPrice -> trước đây bị hiểu là 0 và xóa giá.
        var updated = await svc.UpdateHardwareItemAsync(created.Id,
            new UpdateHardwareItemCommand("Ten moi", "Gateway", "LG308N", null, "SN-GW-1", "AA:BB:CC:DD:EE:01", 1, null, null, "InWarehouse"), CancellationToken.None);
        Assert.Equal(4_500_000m, updated.UnitPrice);
        Assert.Equal("Ten moi", updated.Name);
    }

    [Fact]
    public async Task Update_WithUnitPrice_ChangesPrice()
    {
        var svc = NewService();
        var created = await svc.CreateHardwareItemAsync(Create("A1", 100m), CancellationToken.None);
        var updated = await svc.UpdateHardwareItemAsync(created.Id,
            new UpdateHardwareItemCommand("n", "Actuator", null, null, null, null, 1, null, 250_000m, "InWarehouse"), CancellationToken.None);
        Assert.Equal(250_000m, updated.UnitPrice);
    }

    [Fact]
    public async Task NegativePrice_IsRejected()
    {
        var svc = NewService();
        await Assert.ThrowsAsync<RequestValidationException>(() => svc.CreateHardwareItemAsync(Create("A1", -1m), CancellationToken.None));
        var ok = await svc.CreateHardwareItemAsync(Create("A2", 10m), CancellationToken.None);
        await Assert.ThrowsAsync<RequestValidationException>(() => svc.UpdateHardwareItemAsync(ok.Id,
            new UpdateHardwareItemCommand("n", "Actuator", null, null, null, null, 1, null, -5m, "InWarehouse"), CancellationToken.None));
    }

    [Fact]
    public async Task EstimateConfig_RoundTrips_AndIsPreservedWhenUpdateOmitsIt()
    {
        var svc = NewService();
        var node = await svc.CreateHardwareItemAsync(Create("N1", 3_000_000m, "sensornode", 1, ["Ph", "SoilMoisture", "ph"]), CancellationToken.None);
        Assert.Equal("SensorNode", node.EstimateRole);
        Assert.Equal(1, node.EstimateUnits);
        Assert.Equal(["SoilMoisture", "Ph"], node.MeasuredParameters);

        var relay = await svc.CreateHardwareItemAsync(Create("R1", 1_200_000m, "ActuatorNode", 4), CancellationToken.None);
        Assert.Equal(4, relay.EstimateUnits);

        var after = await svc.UpdateHardwareItemAsync(node.Id,
            new UpdateHardwareItemCommand("n", "Sensor", null, null, null, null, 1, null, null, "InWarehouse"), CancellationToken.None);
        Assert.Equal("SensorNode", after.EstimateRole);
        Assert.Equal(["SoilMoisture", "Ph"], after.MeasuredParameters);

        var cleared = await svc.UpdateHardwareItemAsync(node.Id,
            new UpdateHardwareItemCommand("n", "Sensor", null, null, null, null, 1, null, null, "InWarehouse", "", null, []), CancellationToken.None);
        Assert.Null(cleared.EstimateRole);
        Assert.Empty(cleared.MeasuredParameters ?? []);
    }

    [Theory]
    [InlineData("Valve", 1)]
    [InlineData("Gateway", 0)]
    [InlineData("Gateway", 101)]
    public async Task InvalidRoleOrUnits_AreRejected(string role, int units)
    {
        var svc = NewService();
        await Assert.ThrowsAsync<RequestValidationException>(() => svc.CreateHardwareItemAsync(Create("X", 1m, role, units), CancellationToken.None));
    }

    [Fact]
    public async Task MeasuredParameters_OnlyForSensorNode_AndMustBeKnownCodes()
    {
        var svc = NewService();
        await Assert.ThrowsAsync<RequestValidationException>(() => svc.CreateHardwareItemAsync(Create("X", 1m, "ActuatorNode", 1, ["Ph"]), CancellationToken.None));
        await Assert.ThrowsAsync<RequestValidationException>(() => svc.CreateHardwareItemAsync(Create("Y", 1m, "SensorNode", 1, ["Co2"]), CancellationToken.None));
    }

    [Fact]
    public async Task List_NeverFails_OnLegacyOrUnknownInventoryStatus_AndAcceptsInStockOnWrite()
    {
        // Hồi quy: dòng kho có trạng thái "InStock" (do phiếu nhập kho ghi) làm cả danh mục thiết bị trả lỗi
        // "Unsupported inventory status 'InStock'" nên Owner không lấy được danh mục để dự toán.
        var options = new DbContextOptionsBuilder<SmartFarmDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        await using var db = new SmartFarmDbContext(options);
        foreach (var (code, status) in new[] { ("A", "InStock"), ("B", "Retired"), ("C", "Issued"), ("D", "TrangThaiLa"), ("E", "") })
            db.PlatformHardwareItems.Add(new SmartFarm.Domain.Entities.PlatformHardwareItem { Code = code, Name = code, Category = "Sensor", Status = status, QuantityInStock = 1, UnitPrice = 1 });
        await db.SaveChangesAsync();
        var svc = new PlatformAdminService(db);

        var list = await svc.ListHardwareItemsAsync(CancellationToken.None);
        Assert.Equal(5, list.Count);
        Assert.Equal("InStock", list.Single(x => x.Code == "A").Status);
        Assert.Equal("Retired", list.Single(x => x.Code == "B").Status);
        Assert.Equal("TrangThaiLa", list.Single(x => x.Code == "D").Status);
        Assert.Equal("InWarehouse", list.Single(x => x.Code == "E").Status);

        var created = await svc.CreateHardwareItemAsync(Create("NEW", 1m) with { Status = "InStock" }, CancellationToken.None);
        Assert.Equal("InStock", created.Status);
        await Assert.ThrowsAsync<RequestValidationException>(() =>
            svc.CreateHardwareItemAsync(Create("BAD", 1m) with { Status = "KhongHopLe" }, CancellationToken.None));
    }
}
