using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace SmartFarm.Infrastructure.Persistence.Migrations;

[DbContext(typeof(SmartFarmDbContext))]
[Migration("20261113200000_UpdateStockOutsToHardwareItems")]
public sealed class UpdateStockOutsToHardwareItems : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // 1. Update PXK-202611-201 (the one from user screenshot) to real LoRa Gateway IoT Hardware
        migrationBuilder.Sql(@"
            UPDATE ""StockOuts"" 
            SET ""Notes"" = 'Xuất trạm Central Gateway LoRa lắp đặt hoàn thiện theo yêu cầu kỹ thuật'
            WHERE ""StockOutCode"" = 'PXK-202611-201';

            UPDATE ""StockOutDetails""
            SET ""InventoryItemId"" = '75000000-0000-0000-0000-000000000001',
                ""Quantity"" = 1,
                ""Notes"" = 'Trạm Central Gateway ESP32-LoRa Dual Antenna'
            WHERE ""StockOutId"" IN (SELECT ""Id"" FROM ""StockOuts"" WHERE ""StockOutCode"" = 'PXK-202611-201');
        ");

        // 2. Update PXK-202611-907 to RS485 Soil Sensor
        migrationBuilder.Sql(@"
            UPDATE ""StockOuts"" 
            SET ""Notes"" = 'Xuất cảm biến đo độ ẩm và độ dẫn điện EC đất cho kỹ thuật viên khảo sát thực địa'
            WHERE ""StockOutCode"" = 'PXK-202611-907';

            UPDATE ""StockOutDetails""
            SET ""InventoryItemId"" = '75000000-0000-0000-0000-000000000003',
                ""Quantity"" = 2,
                ""Notes"" = 'Cảm biến Độ ẩm & EC Đất Công nghiệp RS485'
            WHERE ""StockOutId"" IN (SELECT ""Id"" FROM ""StockOuts"" WHERE ""StockOutCode"" = 'PXK-202611-907');
        ");

        // 3. Update PXK-202611-002 to Solenoid Valve Actuator
        migrationBuilder.Sql(@"
            UPDATE ""StockOuts"" 
            SET ""Notes"" = 'Cấp phát Node điều khiển van solenoid tưới nhỏ giọt phục vụ nâng cấp hệ thống tưới tự động'
            WHERE ""StockOutCode"" = 'PXK-202611-002';

            UPDATE ""StockOutDetails""
            SET ""InventoryItemId"" = '75000000-0000-0000-0000-000000000005',
                ""Quantity"" = 2,
                ""Notes"" = 'Node Điều khiển Van Solenoid Tưới nhỏ giọt 4 Cổng'
            WHERE ""StockOutId"" IN (SELECT ""Id"" FROM ""StockOuts"" WHERE ""StockOutCode"" = 'PXK-202611-002');
        ");

        // 4. Update PXK-202611-003 to Pump Actuator
        migrationBuilder.Sql(@"
            UPDATE ""StockOuts"" 
            SET ""Notes"" = 'Xuất thiết bị Node điều khiển bơm châm dinh dưỡng tự động theo gói hợp đồng canh tác'
            WHERE ""StockOutCode"" = 'PXK-202611-003';

            UPDATE ""StockOutDetails""
            SET ""InventoryItemId"" = '75000000-0000-0000-0000-000000000006',
                ""Quantity"" = 1,
                ""Notes"" = 'Node Điều khiển Bơm Phân Dinh dưỡng Châm tự động'
            WHERE ""StockOutId"" IN (SELECT ""Id"" FROM ""StockOuts"" WHERE ""StockOutCode"" = 'PXK-202611-003');
        ");

        // 5. Update PXK-202610-001 to full hardware package
        migrationBuilder.Sql(@"
            UPDATE ""StockOuts"" 
            SET ""Notes"" = 'Xuất trọn bộ thiết bị IoT: Gateway trạm phụ + Node cảm biến vi khí hậu + Pin Solar theo Hợp đồng canh tác HD-SR-A9694818'
            WHERE ""StockOutCode"" = 'PXK-202610-001';

            DELETE FROM ""StockOutDetails"" 
            WHERE ""StockOutId"" IN (SELECT ""Id"" FROM ""StockOuts"" WHERE ""StockOutCode"" = 'PXK-202610-001');

            INSERT INTO ""StockOutDetails"" (""Id"", ""StockOutId"", ""InventoryItemId"", ""Quantity"", ""Notes"", ""CreatedAtUtc"")
            SELECT 
                gen_random_uuid(),
                s.""Id"",
                '75000000-0000-0000-0000-000000000002',
                1,
                'Gateway Trạm Phụ ESP32-LoRa Outdoor IP67',
                NOW()
            FROM ""StockOuts"" s WHERE s.""StockOutCode"" = 'PXK-202610-001';

            INSERT INTO ""StockOutDetails"" (""Id"", ""StockOutId"", ""InventoryItemId"", ""Quantity"", ""Notes"", ""CreatedAtUtc"")
            SELECT 
                gen_random_uuid(),
                s.""Id"",
                '75000000-0000-0000-0000-000000000004',
                2,
                'Node Cảm biến Nhiệt độ - Độ ẩm Không khí Sensirion',
                NOW()
            FROM ""StockOuts"" s WHERE s.""StockOutCode"" = 'PXK-202610-001';

            INSERT INTO ""StockOutDetails"" (""Id"", ""StockOutId"", ""InventoryItemId"", ""Quantity"", ""Notes"", ""CreatedAtUtc"")
            SELECT 
                gen_random_uuid(),
                s.""Id"",
                '75000000-0000-0000-0000-000000000007',
                4,
                'Pin Lithium 3.7V 5000mAh Solar Grade',
                NOW()
            FROM ""StockOuts"" s WHERE s.""StockOutCode"" = 'PXK-202610-001';
        ");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
    }
}

