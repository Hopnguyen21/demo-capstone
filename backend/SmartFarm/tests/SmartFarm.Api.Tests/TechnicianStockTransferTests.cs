using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;
using Xunit;

namespace SmartFarm.Api.Tests;

/// <summary>
/// Kho thiết bị của KTV: phiếu xuất kho chuyển hàng từ KHO CHÍNH sang kho của KTV tạo phiếu (khi Admin hoàn thành),
/// rồi gắn Node trừ chính kho KTV đó.
/// </summary>
public class TechnicianStockTransferTests
{
    private static async Task LoginAsync(HttpClient client, string email)
    {
        client.DefaultRequestHeaders.Authorization = null;
        var r = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = "ValidPassword1!" });
        r.EnsureSuccessStatusCode();
        using var j = JsonDocument.Parse(await r.Content.ReadAsStringAsync());
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", j.RootElement.GetProperty("accessToken").GetString());
    }

    private static PlatformHardwareItem MainItem(string code, string category, int qty) => new()
    {
        Code = code, Name = $"Thiết bị {code}", Category = category, QuantityInStock = qty, Status = "InWarehouse", UnitPrice = 1000, Unit = "Cái",
        SerialNumber = category.Contains("NODE", StringComparison.OrdinalIgnoreCase) || category.Contains("GATEWAY", StringComparison.OrdinalIgnoreCase) ? $"SN-{code}" : null
    };

    private static async Task<Guid> NewVoucherAsync(TestApplicationFactory factory, SeedData seed, Guid createdBy, params (Guid item, int qty)[] lines)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        var farm = await db.Farms.SingleAsync(f => f.Id == seed.FarmAId);
        var v = new StockOut { TenantId = farm.TenantId, FarmId = farm.Id, StockOutCode = $"PXK-T-{Guid.NewGuid():N}"[..16], Status = StockOutStatus.Pending, CreatedByUserId = createdBy };
        foreach (var (item, qty) in lines) v.Details.Add(new StockOutDetail { InventoryItemId = item, Quantity = qty });
        db.StockOuts.Add(v);
        await db.SaveChangesAsync();
        return v.Id;
    }

    private static Task<HttpResponseMessage> SetStatusAsync(HttpClient c, Guid farmId, Guid id, string status) =>
        c.PutAsJsonAsync($"/api/v1/farms/{farmId}/stock-outs/{id}/status", new { status });

    [Fact]
    public async Task Completing_a_technician_voucher_splits_main_stock_into_the_technician_stock_and_merges_later_transfers()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        Guid itemId;
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            var item = MainItem("SHT30-X", "Sensor", 10); db.PlatformHardwareItems.Add(item); await db.SaveChangesAsync(); itemId = item.Id;
        }
        var v1 = await NewVoucherAsync(factory, seed, seed.TechnicianId, (itemId, 3));
        var v2 = await NewVoucherAsync(factory, seed, seed.TechnicianId, (itemId, 2));
        using var client = factory.CreateClient();
        await LoginAsync(client, "admin@example.com");
        Assert.Equal(HttpStatusCode.OK, (await SetStatusAsync(client, seed.FarmAId, v1, "Completed")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await SetStatusAsync(client, seed.FarmAId, v2, "Completed")).StatusCode);

        await using var scope2 = factory.Services.CreateAsyncScope();
        var db2 = scope2.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        var main = await db2.PlatformHardwareItems.SingleAsync(x => x.Id == itemId);
        Assert.Equal(5, main.QuantityInStock);               // 10 - 3 - 2: kho chính chỉ giảm đúng số xuất
        Assert.Equal("InWarehouse", main.Status);
        Assert.Null(main.AssignedTechnicianId);              // dòng kho chính không bị gán cho KTV
        var tech = await db2.PlatformHardwareItems.Where(x => x.AssignedTechnicianId == seed.TechnicianId && x.Code == "SHT30-X").ToListAsync();
        var row = Assert.Single(tech);                       // hai phiếu gộp vào một dòng của KTV
        Assert.Equal(5, row.QuantityInStock);
        Assert.Equal("InTechnicianStock", row.Status);
    }

    [Fact]
    public async Task A_serial_tracked_node_changes_owner_once_and_cannot_be_issued_again()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        Guid nodeId;
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            var node = MainItem("NODE-S1", "Node Arduino Nano", 1); node.SerialNumber = "SN-S1"; db.PlatformHardwareItems.Add(node); await db.SaveChangesAsync(); nodeId = node.Id;
        }
        var v1 = await NewVoucherAsync(factory, seed, seed.TechnicianId, (nodeId, 1));
        var v2 = await NewVoucherAsync(factory, seed, seed.TechnicianId, (nodeId, 1));
        using var client = factory.CreateClient();
        await LoginAsync(client, "admin@example.com");
        Assert.Equal(HttpStatusCode.OK, (await SetStatusAsync(client, seed.FarmAId, v1, "Completed")).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await SetStatusAsync(client, seed.FarmAId, v2, "Completed")).StatusCode);
        await using var scope2 = factory.Services.CreateAsyncScope();
        var node2 = await scope2.ServiceProvider.GetRequiredService<SmartFarmDbContext>().PlatformHardwareItems.SingleAsync(x => x.Id == nodeId);
        Assert.Equal(seed.TechnicianId, node2.AssignedTechnicianId);
        Assert.Equal("InTechnicianStock", node2.Status);
    }

    [Fact]
    public async Task Hardware_goes_only_to_a_technician_and_a_cancelled_voucher_cannot_complete()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        Guid itemId, adminId;
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            var item = MainItem("CAP-1", "Sensor", 4); db.PlatformHardwareItems.Add(item); await db.SaveChangesAsync(); itemId = item.Id;
            adminId = await db.AppUsers.Where(x => x.Email == "admin@example.com").Select(x => x.Id).SingleAsync();
        }
        var byAdmin = await NewVoucherAsync(factory, seed, adminId, (itemId, 1));
        var cancelled = await NewVoucherAsync(factory, seed, seed.TechnicianId, (itemId, 1));
        using var client = factory.CreateClient();
        await LoginAsync(client, "admin@example.com");
        Assert.Equal(HttpStatusCode.Conflict, (await SetStatusAsync(client, seed.FarmAId, byAdmin, "Completed")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await SetStatusAsync(client, seed.FarmAId, cancelled, "Cancelled")).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await SetStatusAsync(client, seed.FarmAId, cancelled, "Completed")).StatusCode);
        await using var scope2 = factory.Services.CreateAsyncScope();
        var item2 = await scope2.ServiceProvider.GetRequiredService<SmartFarmDbContext>().PlatformHardwareItems.SingleAsync(x => x.Id == itemId);
        Assert.Equal(4, item2.QuantityInStock); // không phiếu nào trừ kho chính
    }

    // ───────── Gắn Node trừ kho của chính KTV ─────────

    private static async Task<(Guid depId, Guid farmId, Guid gatewayId)> InstallingAsync(TestApplicationFactory factory, SeedData seed)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        var farm = await db.Farms.SingleAsync(f => f.Id == seed.FarmAId);
        var dep = new DeploymentRequest
        {
            TenantId = farm.TenantId, FarmId = farm.Id, ZoneId = seed.ZoneAId, PlantingSeasonId = Guid.NewGuid(), OwnerUserId = seed.OwnerAId,
            TechnicianUserId = seed.TechnicianId, Status = DeploymentRequestStatus.Installing, RequiredParametersCsv = "SoilMoisture"
        };
        db.DeploymentRequests.Add(dep);
        db.ServiceRequests.Add(new ServiceRequest
        {
            TenantId = farm.TenantId, FarmId = farm.Id, ZoneId = seed.ZoneAId, DeploymentRequestId = dep.Id, Source = "Test", FailureCode = "INSTALLATION",
            Description = "Lắp đặt", Status = ServiceRequestStatus.Assigned, AssignedTechnicianId = seed.TechnicianId, IsContractSigned = true, IsDepositPaid = true
        });
        var gw = new Gateway { DeploymentRequestId = dep.Id, FarmId = farm.Id, MacAddress = "AA:BB:CC:00:09:01", GatewaySerial = "GW-STK-1", FrequencyBand = "433MHz", FirmwareVersion = "v1", MqttClientId = "gw-stk-1", ClientCertificateFingerprint = new string('B', 64) };
        db.Gateways.Add(gw);
        await db.SaveChangesAsync();
        return (dep.Id, farm.Id, gw.Id);
    }

    private static object Provision(Guid dep, Guid farm, Guid gw, string address, Guid? hardwareItemId) => new
    {
        deploymentRequestId = dep, gatewayId = gw, farmId = farm,
        nodes = new[] { new { hardwareAddress = address, deviceType = "SensorNode", hardwareItemId } }
    };

    private static async Task<Guid> TechItemAsync(TestApplicationFactory factory, Guid? technician, string category, int qty, string status = "InTechnicianStock")
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        var item = MainItem($"T-{Guid.NewGuid():N}"[..12], category, qty); item.Status = status; item.AssignedTechnicianId = technician;
        db.PlatformHardwareItems.Add(item); await db.SaveChangesAsync(); return item.Id;
    }

    private static async Task<PlatformHardwareItem> ReloadAsync(TestApplicationFactory factory, Guid id)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        return await scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>().PlatformHardwareItems.AsNoTracking().SingleAsync(x => x.Id == id);
    }

    [Fact]
    public async Task Provisioning_a_node_takes_the_device_from_the_technicians_own_stock()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        var (dep, farm, gw) = await InstallingAsync(factory, seed);
        var node = await TechItemAsync(factory, seed.TechnicianId, "Node Arduino Nano", 1);
        using var client = factory.CreateClient();
        await LoginAsync(client, "technician@example.com");

        var ok = await client.PostAsJsonAsync("/api/v1/devices/provision", Provision(dep, farm, gw, "NODE-A1", node));
        Assert.True(ok.IsSuccessStatusCode, await ok.Content.ReadAsStringAsync());
        Assert.Equal("Deployed", (await ReloadAsync(factory, node)).Status);

        // gọi lại cho đúng Node đã cấp phát: không trừ lần hai, không lỗi
        var again = await client.PostAsJsonAsync("/api/v1/devices/provision", Provision(dep, farm, gw, "NODE-A1", node));
        Assert.True(again.IsSuccessStatusCode, await again.Content.ReadAsStringAsync());

        // cùng thiết bị đã dùng cho Node khác: kho KTV không còn → 409
        var reuse = await client.PostAsJsonAsync("/api/v1/devices/provision", Provision(dep, farm, gw, "NODE-A2", node));
        Assert.Equal(HttpStatusCode.Conflict, reuse.StatusCode);
    }

    [Fact]
    public async Task Provisioning_decrements_quantity_rows_and_refuses_when_the_technician_has_too_few()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        var (dep, farm, gw) = await InstallingAsync(factory, seed);
        var stock = await TechItemAsync(factory, seed.TechnicianId, "Sensor", 1);
        using var client = factory.CreateClient();
        await LoginAsync(client, "technician@example.com");
        Assert.True((await client.PostAsJsonAsync("/api/v1/devices/provision", Provision(dep, farm, gw, "SENS-1", stock))).IsSuccessStatusCode);
        Assert.Equal(0, (await ReloadAsync(factory, stock)).QuantityInStock);
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync("/api/v1/devices/provision", Provision(dep, farm, gw, "SENS-2", stock))).StatusCode);
    }

    [Fact]
    public async Task Provisioning_refuses_hardware_that_is_not_in_this_technicians_stock()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        var (dep, farm, gw) = await InstallingAsync(factory, seed);
        var inWarehouse = await TechItemAsync(factory, null, "Node Arduino Nano", 1, "InWarehouse");   // còn kho chính
        var otherTech = await TechItemAsync(factory, Guid.NewGuid(), "Node Arduino Nano", 1);          // của KTV khác
        using var client = factory.CreateClient();
        await LoginAsync(client, "technician@example.com");
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync("/api/v1/devices/provision", Provision(dep, farm, gw, "NODE-W", inWarehouse))).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync("/api/v1/devices/provision", Provision(dep, farm, gw, "NODE-O", otherTech))).StatusCode);
        Assert.Equal("InWarehouse", (await ReloadAsync(factory, inWarehouse)).Status);
    }

    [Fact]
    public async Task Completing_keeps_the_remaining_quantity_in_the_technician_stock_and_stores_the_acceptance_notes()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        var (dep, farm, gw) = await InstallingAsync(factory, seed);
        var node = await TechItemAsync(factory, seed.TechnicianId, "Node Arduino Nano", 1);
        var bulk = await TechItemAsync(factory, seed.TechnicianId, "Sensor", 3);
        using var client = factory.CreateClient();
        await LoginAsync(client, "technician@example.com");
        Assert.True((await client.PostAsJsonAsync("/api/v1/devices/provision", Provision(dep, farm, gw, "NODE-C1", node))).IsSuccessStatusCode);
        Assert.True((await client.PostAsJsonAsync("/api/v1/devices/provision", Provision(dep, farm, gw, "SENS-C1", bulk))).IsSuccessStatusCode);
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            foreach (var d in await db.Devices.Where(x => x.DeploymentRequestId == dep).ToListAsync()) { d.ZoneId = seed.ZoneAId; d.Status = DeviceStatus.Online; }
            await db.SaveChangesAsync();
        }
        var done = await client.PostAsJsonAsync($"/api/v1/platform/deployment-requests/{dep}/complete", new { notes = "Đã nghiệm thu 2 node, kết nối ổn." });
        Assert.True(done.IsSuccessStatusCode, await done.Content.ReadAsStringAsync());
        using var json = JsonDocument.Parse(await done.Content.ReadAsStringAsync());
        Assert.Contains(json.RootElement.GetProperty("decisionHistory").EnumerateArray(),
            x => x.GetProperty("decisionType").GetString() == "DeploymentCompleted" && x.GetProperty("notes").GetString() == "Đã nghiệm thu 2 node, kết nối ổn.");
        Assert.Equal("Deployed", (await ReloadAsync(factory, node)).Status);
        var rest = await ReloadAsync(factory, bulk);
        Assert.Equal(2, rest.QuantityInStock);                 // đã dùng 1, còn 2
        Assert.Equal("InTechnicianStock", rest.Status);         // phần còn lại vẫn là kho KTV
        Assert.Equal(seed.TechnicianId, rest.AssignedTechnicianId);
    }

    [Fact]
    public async Task Completing_without_a_body_still_works()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        var (dep, farm, gw) = await InstallingAsync(factory, seed);
        var node = await TechItemAsync(factory, seed.TechnicianId, "Node Arduino Nano", 1);
        using var client = factory.CreateClient();
        await LoginAsync(client, "technician@example.com");
        Assert.True((await client.PostAsJsonAsync("/api/v1/devices/provision", Provision(dep, farm, gw, "NODE-D1", node))).IsSuccessStatusCode);
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            foreach (var d in await db.Devices.Where(x => x.DeploymentRequestId == dep).ToListAsync()) { d.ZoneId = seed.ZoneAId; d.Status = DeviceStatus.Online; }
            await db.SaveChangesAsync();
        }
        var done = await client.PostAsync($"/api/v1/platform/deployment-requests/{dep}/complete", null);
        Assert.True(done.IsSuccessStatusCode, await done.Content.ReadAsStringAsync());
    }

    // ───────── Trả hàng về kho chính ─────────

    [Fact]
    public async Task Returning_quantity_stock_adds_it_back_to_the_main_row_and_returning_a_serial_item_makes_it_available_again()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        Guid mainId, nodeId;
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            var main = MainItem("RET-SENS", "Sensor", 7); db.PlatformHardwareItems.Add(main);
            var node = MainItem("RET-NODE", "Node Arduino Nano", 1); node.SerialNumber = "SN-RET"; db.PlatformHardwareItems.Add(node);
            await db.SaveChangesAsync(); mainId = main.Id; nodeId = node.Id;
        }
        var v = await NewVoucherAsync(factory, seed, seed.TechnicianId, (mainId, 3), (nodeId, 1));
        using var client = factory.CreateClient();
        await LoginAsync(client, "admin@example.com");
        Assert.Equal(HttpStatusCode.OK, (await SetStatusAsync(client, seed.FarmAId, v, "Completed")).StatusCode);

        Guid techSensor;
        await using (var scope = factory.Services.CreateAsyncScope())
            techSensor = await scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>().PlatformHardwareItems.Where(x => x.AssignedTechnicianId == seed.TechnicianId && x.Code == "RET-SENS").Select(x => x.Id).SingleAsync();

        await LoginAsync(client, "technician@example.com");
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsync($"/api/v1/platform/hardware-items/{techSensor}/return", null)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsync($"/api/v1/platform/hardware-items/{nodeId}/return", null)).StatusCode);

        Assert.Equal(7, (await ReloadAsync(factory, mainId)).QuantityInStock);          // 7 - 3 + 3: không mất hàng khi trả
        var back = await ReloadAsync(factory, techSensor);
        Assert.Equal(0, back.QuantityInStock);
        Assert.Null(back.AssignedTechnicianId);
        var node2 = await ReloadAsync(factory, nodeId);
        Assert.Equal("InWarehouse", node2.Status);                                       // Node theo serial xuất lại được
        Assert.Null(node2.AssignedTechnicianId);
        // không còn trong kho KTV
        var mine = await client.GetFromJsonAsync<JsonElement>("/api/v1/platform/technicians/me/spare-parts");
        Assert.DoesNotContain(mine.EnumerateArray(), x => x.GetProperty("id").GetGuid() == techSensor || x.GetProperty("id").GetGuid() == nodeId);
    }

    [Fact]
    public async Task A_deployed_item_cannot_be_returned_to_the_warehouse()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        var deployed = await TechItemAsync(factory, seed.TechnicianId, "Node Arduino Nano", 1, "Deployed");
        using var client = factory.CreateClient();
        await LoginAsync(client, "technician@example.com");
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsync($"/api/v1/platform/hardware-items/{deployed}/return", null)).StatusCode);
    }

    // ───────── Các lỗi sau rà soát ─────────

    [Fact]
    public async Task Two_lines_of_the_same_item_in_one_voucher_merge_into_a_single_technician_row()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        Guid itemId;
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            var item = MainItem("DUP-SENS", "Sensor", 10); db.PlatformHardwareItems.Add(item); await db.SaveChangesAsync(); itemId = item.Id;
        }
        var v = await NewVoucherAsync(factory, seed, seed.TechnicianId, (itemId, 3), (itemId, 2));
        using var client = factory.CreateClient();
        await LoginAsync(client, "admin@example.com");
        Assert.Equal(HttpStatusCode.OK, (await SetStatusAsync(client, seed.FarmAId, v, "Completed")).StatusCode);
        await using var scope2 = factory.Services.CreateAsyncScope();
        var rows = await scope2.ServiceProvider.GetRequiredService<SmartFarmDbContext>().PlatformHardwareItems.Where(x => x.AssignedTechnicianId == seed.TechnicianId && x.Code == "DUP-SENS").ToListAsync();
        Assert.Equal(5, Assert.Single(rows).QuantityInStock);
        Assert.Equal(5, (await ReloadAsync(factory, itemId)).QuantityInStock);
    }

    [Fact]
    public async Task A_serial_row_with_stock_above_one_is_refused_instead_of_moving_the_whole_stock()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        Guid nodeId;
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            var node = MainItem("BIG-NODE", "Node Arduino Nano", 10); db.PlatformHardwareItems.Add(node); await db.SaveChangesAsync(); nodeId = node.Id;
        }
        var v = await NewVoucherAsync(factory, seed, seed.TechnicianId, (nodeId, 1));
        using var client = factory.CreateClient();
        await LoginAsync(client, "admin@example.com");
        Assert.Equal(HttpStatusCode.Conflict, (await SetStatusAsync(client, seed.FarmAId, v, "Completed")).StatusCode);
        var node2 = await ReloadAsync(factory, nodeId);
        Assert.Equal(10, node2.QuantityInStock);
        Assert.Null(node2.AssignedTechnicianId);
    }

    [Fact]
    public async Task Returning_a_faulty_item_keeps_it_faulty_so_it_never_looks_like_available_stock()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        var faulty = await TechItemAsync(factory, seed.TechnicianId, "Sensor", 2, "Faulty");
        using var client = factory.CreateClient();
        await LoginAsync(client, "technician@example.com");
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsync($"/api/v1/platform/hardware-items/{faulty}/return", null)).StatusCode);
        var back = await ReloadAsync(factory, faulty);
        Assert.Equal("Faulty", back.Status);
        Assert.Null(back.AssignedTechnicianId);
    }

    [Fact]
    public async Task Linking_an_existing_node_to_a_stock_item_also_takes_it_from_the_technician_stock()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        var (dep, farm, gw) = await InstallingAsync(factory, seed);
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            db.Devices.Add(new Device { FarmId = farm, GatewayId = gw, DeploymentRequestId = dep, HardwareAddress = "OLD-NODE-1", DeviceType = DeviceType.SensorNode, Status = DeviceStatus.Unassigned });
            await db.SaveChangesAsync();
        }
        var node = await TechItemAsync(factory, seed.TechnicianId, "Node Arduino Nano", 1);
        using var client = factory.CreateClient();
        await LoginAsync(client, "technician@example.com");
        var ok = await client.PostAsJsonAsync("/api/v1/devices/provision", Provision(dep, farm, gw, "OLD-NODE-1", node));
        Assert.True(ok.IsSuccessStatusCode, await ok.Content.ReadAsStringAsync());
        Assert.Equal("Deployed", (await ReloadAsync(factory, node)).Status);
        await using var scope2 = factory.Services.CreateAsyncScope();
        Assert.Equal(node, await scope2.ServiceProvider.GetRequiredService<SmartFarmDbContext>().Devices.Where(d => d.HardwareAddress == "OLD-NODE-1").Select(d => d.HardwareItemId!.Value).SingleAsync());
    }

    [Fact]
    public async Task Legacy_warehouse_rows_with_a_stale_holder_are_still_main_warehouse_stock_and_can_be_issued()
    {
        // Dữ liệu cũ: dòng InStock/InWarehouse kèm AssignedTechnicianId thừa (luồng xuất kho cũ gán người giữ mà không đổi trạng thái).
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        Guid legacyId;
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            var legacy = MainItem("LEG-KIT", "Peripheral", 20); legacy.Status = "InStock"; legacy.AssignedTechnicianId = Guid.NewGuid();
            db.PlatformHardwareItems.Add(legacy); await db.SaveChangesAsync(); legacyId = legacy.Id;
        }
        var v = await NewVoucherAsync(factory, seed, seed.TechnicianId, (legacyId, 4));
        using var client = factory.CreateClient();
        await LoginAsync(client, "admin@example.com");
        Assert.Equal(HttpStatusCode.OK, (await SetStatusAsync(client, seed.FarmAId, v, "Completed")).StatusCode);
        var main = await ReloadAsync(factory, legacyId);
        Assert.Equal(16, main.QuantityInStock);
        Assert.Null(main.AssignedTechnicianId); // người giữ thừa đã được xoá
        await using var scope2 = factory.Services.CreateAsyncScope();
        var mine = await scope2.ServiceProvider.GetRequiredService<SmartFarmDbContext>().PlatformHardwareItems.SingleAsync(x => x.AssignedTechnicianId == seed.TechnicianId && x.Code == "LEG-KIT");
        Assert.Equal(4, mine.QuantityInStock);
        Assert.Equal("InTechnicianStock", mine.Status);
    }

    // ───────── Nhập kho thiết bị (stock-in) ─────────

    private static async Task<Guid> NewStockInAsync(TestApplicationFactory factory, SeedData seed, Guid itemId, int qty)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        var farm = await db.Farms.SingleAsync(f => f.Id == seed.FarmAId);
        var v = new StockIn { TenantId = farm.TenantId, FarmId = farm.Id, StockInCode = $"PNK-T-{Guid.NewGuid():N}"[..16], Status = StockInStatus.Approved, CreatedByUserId = seed.TechnicianId };
        v.Details.Add(new StockInDetail { InventoryItemId = itemId, Quantity = qty, UnitPrice = 1000 });
        db.StockIns.Add(v);
        await db.SaveChangesAsync();
        return v.Id;
    }

    private static Task<HttpResponseMessage> CompleteStockInAsync(HttpClient c, Guid farmId, Guid id) =>
        c.PutAsJsonAsync($"/api/v1/farms/{farmId}/stock-ins/{id}/status", new { status = "Completed" });

    [Fact]
    public async Task Stock_in_adds_to_the_main_warehouse_row_and_clears_a_stale_holder()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        Guid itemId;
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            var item = MainItem("IN-KIT", "Peripheral", 5); item.Status = "InStock"; item.AssignedTechnicianId = Guid.NewGuid();
            db.PlatformHardwareItems.Add(item); await db.SaveChangesAsync(); itemId = item.Id;
        }
        var si = await NewStockInAsync(factory, seed, itemId, 7);
        using var client = factory.CreateClient();
        await LoginAsync(client, "admin@example.com");
        Assert.Equal(HttpStatusCode.OK, (await CompleteStockInAsync(client, seed.FarmAId, si)).StatusCode);
        var row = await ReloadAsync(factory, itemId);
        Assert.Equal(12, row.QuantityInStock);
        Assert.Equal("InStock", row.Status);
        Assert.Null(row.AssignedTechnicianId); // hàng kho chính không thuộc ai
    }

    [Fact]
    public async Task Stock_in_on_a_technician_row_goes_to_the_main_warehouse_row_of_the_same_code_never_to_the_technician()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        Guid mainId, techId;
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            var main = MainItem("IN-SENS", "Sensor", 10);
            var tech = MainItem("IN-SENS", "Sensor", 3); tech.Status = "InTechnicianStock"; tech.AssignedTechnicianId = seed.TechnicianId;
            db.PlatformHardwareItems.AddRange(main, tech); await db.SaveChangesAsync(); mainId = main.Id; techId = tech.Id;
        }
        var si = await NewStockInAsync(factory, seed, techId, 4);
        using var client = factory.CreateClient();
        await LoginAsync(client, "admin@example.com");
        Assert.Equal(HttpStatusCode.OK, (await CompleteStockInAsync(client, seed.FarmAId, si)).StatusCode);
        Assert.Equal(14, (await ReloadAsync(factory, mainId)).QuantityInStock);
        var tech2 = await ReloadAsync(factory, techId);
        Assert.Equal(3, tech2.QuantityInStock);                       // hàng của KTV không đổi
        Assert.Equal("InTechnicianStock", tech2.Status);
        Assert.Equal(seed.TechnicianId, tech2.AssignedTechnicianId);
    }

    [Fact]
    public async Task Stock_in_refuses_retired_deployed_or_faulty_rows_and_extra_units_for_a_serial_row()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        Guid retired, serial;
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            var r = MainItem("IN-OLD", "Gateway", 25); r.Status = "Retired"; r.SerialNumber = null;
            var n = MainItem("IN-SN", "Node Arduino Nano", 1); n.Status = "InStock";
            db.PlatformHardwareItems.AddRange(r, n); await db.SaveChangesAsync(); retired = r.Id; serial = n.Id;
        }
        var siRetired = await NewStockInAsync(factory, seed, retired, 5);
        var siSerial = await NewStockInAsync(factory, seed, serial, 2);
        using var client = factory.CreateClient();
        await LoginAsync(client, "admin@example.com");
        Assert.Equal(HttpStatusCode.Conflict, (await CompleteStockInAsync(client, seed.FarmAId, siRetired)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await CompleteStockInAsync(client, seed.FarmAId, siSerial)).StatusCode);
        Assert.Equal(25, (await ReloadAsync(factory, retired)).QuantityInStock);
        Assert.Equal(1, (await ReloadAsync(factory, serial)).QuantityInStock);
    }

    [Fact]
    public async Task A_gateway_or_node_without_a_serial_is_treated_as_quantity_stock()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        Guid gw;
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            var g = MainItem("QTY-GW", "Gateway ESP32", 49); g.SerialNumber = null; // danh mục tồn kho theo số lượng
            db.PlatformHardwareItems.Add(g); await db.SaveChangesAsync(); gw = g.Id;
        }
        var v = await NewVoucherAsync(factory, seed, seed.TechnicianId, (gw, 2));
        using var client = factory.CreateClient();
        await LoginAsync(client, "admin@example.com");
        Assert.Equal(HttpStatusCode.OK, (await SetStatusAsync(client, seed.FarmAId, v, "Completed")).StatusCode);
        Assert.Equal(47, (await ReloadAsync(factory, gw)).QuantityInStock);
        await using var scope2 = factory.Services.CreateAsyncScope();
        var mine = await scope2.ServiceProvider.GetRequiredService<SmartFarmDbContext>().PlatformHardwareItems.SingleAsync(x => x.AssignedTechnicianId == seed.TechnicianId && x.Code == "QTY-GW");
        Assert.Equal(2, mine.QuantityInStock);
    }

    [Fact]
    public async Task A_sensor_item_cannot_be_provisioned_as_an_actuator_node_and_the_stock_is_untouched()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        var (dep, farm, gw) = await InstallingAsync(factory, seed);
        Guid sensorItem, valveItem;
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            var s1 = MainItem("SN-ROLE", "SOIL_SENSOR", 9); s1.Status = "InTechnicianStock"; s1.AssignedTechnicianId = seed.TechnicianId; s1.EstimateRole = "SensorNode";
            var v1 = MainItem("ACT-ROLE", "VALVE", 5); v1.Status = "InTechnicianStock"; v1.AssignedTechnicianId = seed.TechnicianId; v1.EstimateRole = "ActuatorNode";
            db.PlatformHardwareItems.AddRange(s1, v1); await db.SaveChangesAsync(); sensorItem = s1.Id; valveItem = v1.Id;
        }
        using var client = factory.CreateClient();
        await LoginAsync(client, "technician@example.com");
        object Body(string address, string type, Guid item) => new { deploymentRequestId = dep, gatewayId = gw, farmId = farm, nodes = new[] { new { hardwareAddress = address, deviceType = type, hardwareItemId = (Guid?)item } } };

        // cảm biến dùng cho Node điều khiển: bị chặn, kho không đổi
        var bad = await client.PostAsJsonAsync("/api/v1/devices/provision", Body("SN-ROLE-01", "ActuatorNode", sensorItem));
        Assert.Equal(HttpStatusCode.Conflict, bad.StatusCode);
        Assert.Equal(9, (await ReloadAsync(factory, sensorItem)).QuantityInStock);
        // đúng loại: được, và trừ kho
        Assert.True((await client.PostAsJsonAsync("/api/v1/devices/provision", Body("SN-ROLE-02", "SensorNode", sensorItem))).IsSuccessStatusCode);
        Assert.Equal(8, (await ReloadAsync(factory, sensorItem)).QuantityInStock);
        Assert.True((await client.PostAsJsonAsync("/api/v1/devices/provision", Body("ACT-ROLE-01", "ActuatorNode", valveItem))).IsSuccessStatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync("/api/v1/devices/provision", Body("ACT-ROLE-02", "SensorNode", valveItem))).StatusCode);
    }

    [Fact]
    public async Task Role_is_inferred_from_category_when_unassigned_and_non_node_hardware_is_never_a_node()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        var (dep, farm, gw) = await InstallingAsync(factory, seed);
        Guid valve, sensor, camera, kit;
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            PlatformHardwareItem T(string code, string cat, string? role) { var i = MainItem(code, cat, 5); i.Status = "InTechnicianStock"; i.AssignedTechnicianId = seed.TechnicianId; i.EstimateRole = role; i.SerialNumber = null; return i; }
            var v = T("VALVE-NOROLE", "VALVE", null); var se = T("SENS-NOROLE", "SENSOR", null); var c = T("CAM-1", "Camera", null); var k = T("KIT-1", "Peripheral", "InstallKit");
            db.PlatformHardwareItems.AddRange(v, se, c, k); await db.SaveChangesAsync(); valve = v.Id; sensor = se.Id; camera = c.Id; kit = k.Id;
        }
        using var client = factory.CreateClient();
        await LoginAsync(client, "technician@example.com");
        Task<HttpResponseMessage> Go(string address, string type, Guid item) => client.PostAsJsonAsync("/api/v1/devices/provision",
            new { deploymentRequestId = dep, gatewayId = gw, farmId = farm, nodes = new[] { new { hardwareAddress = address, deviceType = type, hardwareItemId = (Guid?)item } } });

        // van chưa gán vai trò vẫn bị chặn làm Node cảm biến; cảm biến chưa gán vai trò bị chặn làm Node điều khiển
        Assert.Equal(HttpStatusCode.Conflict, (await Go("VAL-AS-SENSOR", "SensorNode", valve)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await Go("SEN-AS-ACT", "ActuatorNode", sensor)).StatusCode);
        // camera / bộ lắp đặt không phải Node
        Assert.Equal(HttpStatusCode.Conflict, (await Go("CAM-AS-NODE", "SensorNode", camera)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await Go("KIT-AS-NODE", "ActuatorNode", kit)).StatusCode);
        Assert.Equal(5, (await ReloadAsync(factory, valve)).QuantityInStock);
        // đúng loại thì qua
        Assert.True((await Go("VAL-OK-01", "ActuatorNode", valve)).IsSuccessStatusCode);
        Assert.True((await Go("SEN-OK-01", "SensorNode", sensor)).IsSuccessStatusCode);
        // gắn lại cùng địa chỉ với loại khác: bị chặn
        Assert.Equal(HttpStatusCode.Conflict, (await Go("SEN-OK-01", "ActuatorNode", sensor)).StatusCode);
    }

    // ───────── Quyền: KTV không tự cấp thiết bị cho mình ─────────

    [Fact]
    public async Task A_technician_cannot_approve_or_complete_a_voucher_even_their_own_but_can_submit_and_cancel_it()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        Guid itemId;
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            var item = MainItem("SELF-SENS", "Sensor", 10); db.PlatformHardwareItems.Add(item); await db.SaveChangesAsync(); itemId = item.Id;
        }
        var v = await NewVoucherAsync(factory, seed, seed.TechnicianId, (itemId, 3));
        using var client = factory.CreateClient();
        await LoginAsync(client, "technician@example.com");
        Assert.Equal(HttpStatusCode.Forbidden, (await SetStatusAsync(client, seed.FarmAId, v, "Completed")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await SetStatusAsync(client, seed.FarmAId, v, "Approved")).StatusCode);
        Assert.Equal(10, (await ReloadAsync(factory, itemId)).QuantityInStock);   // không có gì chuyển
        // KTV vẫn gửi duyệt / hủy được phiếu của mình
        Assert.Equal(HttpStatusCode.OK, (await SetStatusAsync(client, seed.FarmAId, v, "Pending")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await SetStatusAsync(client, seed.FarmAId, v, "Cancelled")).StatusCode);
    }

    [Fact]
    public async Task A_technician_only_sees_and_touches_their_own_vouchers()
    {
        using var factory = new TestApplicationFactory(); var seed = await factory.SeedAsync();
        Guid itemId, otherTech;
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
            var item = MainItem("OWN-SENS", "Sensor", 10); db.PlatformHardwareItems.Add(item); await db.SaveChangesAsync(); itemId = item.Id;
            otherTech = await db.AppUsers.Where(x => x.Email == "admin@example.com").Select(x => x.Id).SingleAsync(); // phiếu do người khác lập
        }
        var mine = await NewVoucherAsync(factory, seed, seed.TechnicianId, (itemId, 1));
        var others = await NewVoucherAsync(factory, seed, otherTech, (itemId, 1));
        using var client = factory.CreateClient();
        await LoginAsync(client, "technician@example.com");
        var list = await client.GetFromJsonAsync<JsonElement>($"/api/v1/farms/{seed.FarmAId}/stock-outs");
        var ids = list.EnumerateArray().Select(e => e.GetProperty("id").GetGuid()).ToList();
        Assert.Contains(mine, ids);
        Assert.DoesNotContain(others, ids);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/v1/farms/{seed.FarmAId}/stock-outs/{others}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await SetStatusAsync(client, seed.FarmAId, others, "Cancelled")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.DeleteAsync($"/api/v1/farms/{seed.FarmAId}/stock-outs/{others}")).StatusCode);
    }
}
