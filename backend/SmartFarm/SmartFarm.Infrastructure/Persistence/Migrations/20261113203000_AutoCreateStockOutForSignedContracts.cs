using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace SmartFarm.Infrastructure.Persistence.Migrations;

[DbContext(typeof(SmartFarmDbContext))]
[Migration("20261113203000_AutoCreateStockOutForSignedContracts")]
public sealed class AutoCreateStockOutForSignedContracts : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // Auto-create a StockOut for the signed & 30% deposited Service Request (1f473476-6f33-4f91-b235-aaaae984018e)
        migrationBuilder.Sql(@"
            -- 1. Create StockOut for quotation 1e71619d-1f66-4378-bd62-64c16b0b28b2 if not exists
            INSERT INTO ""StockOuts"" (
                ""Id"", ""TenantId"", ""FarmId"", ""ZoneId"", ""StockOutCode"", 
                ""Status"", ""CreatedByUserId"", ""Notes"", ""CreatedAtUtc""
            )
            SELECT
                'a1000000-0000-0000-0000-000000000010'::uuid,
                sr.tenant_id,
                sr.farm_id,
                sr.zone_id,
                'PXK-202611-301',
                1, -- Pending (Chờ duyệt xuất kho)
                COALESCE(sr.assigned_technician_id, q.""TechnicianUserId""),
                '[Tự động tạo từ HĐ HD-SR-1E71619D] Xuất thiết bị IoT theo hợp đồng đã thanh toán cọc 30%.',
                NOW()
            FROM ""ServiceRequestQuotations"" q
            JOIN service_requests sr ON q.""ServiceRequestId"" = sr.id
            WHERE q.""Id"" = '1e71619d-1f66-4378-bd62-64c16b0b28b2'::uuid
              AND NOT EXISTS (
                  SELECT 1 FROM ""StockOuts"" WHERE ""StockOutCode"" = 'PXK-202611-301'
              );

            -- 2. Insert StockOutDetails for all items from quotation 1e71619d-1f66-4378-bd62-64c16b0b28b2
            INSERT INTO ""StockOutDetails"" (""Id"", ""StockOutId"", ""InventoryItemId"", ""Quantity"", ""Notes"", ""CreatedAtUtc"")
            SELECT
                gen_random_uuid(),
                'a1000000-0000-0000-0000-000000000010'::uuid,
                COALESCE(
                    phi.""Id"",
                    (SELECT p.""Id"" FROM ""PlatformHardwareItems"" p WHERE p.""Category"" = qi.""Category"" LIMIT 1),
                    qi.""Id""
                ),
                qi.""Quantity"",
                'Xuất theo HĐ HD-SR-1E71619D: ' || qi.""HardwareItemName"" || ' (' || qi.""Category"" || ')',
                NOW()
            FROM ""ServiceRequestQuotationItems"" qi
            LEFT JOIN ""PlatformHardwareItems"" phi ON phi.""Code"" = qi.""HardwareItemCode""
            WHERE qi.""QuotationId"" = '1e71619d-1f66-4378-bd62-64c16b0b28b2'::uuid
              AND EXISTS (
                  SELECT 1 FROM ""StockOuts"" WHERE ""Id"" = 'a1000000-0000-0000-0000-000000000010'::uuid
              )
              AND NOT EXISTS (
                  SELECT 1 FROM ""StockOutDetails"" WHERE ""StockOutId"" = 'a1000000-0000-0000-0000-000000000010'::uuid
              );

            -- 3. Ensure hardware item references for PXK-202611-301 are linked to active platform hardware items
            UPDATE ""StockOutDetails""
            SET ""InventoryItemId"" = '75000000-0000-0000-0000-000000000003'::uuid
            WHERE ""StockOutId"" = 'a1000000-0000-0000-0000-000000000010'::uuid
              AND ""Notes"" LIKE '%SOIL_SENSOR%';

            UPDATE ""StockOutDetails""
            SET ""InventoryItemId"" = '75000000-0000-0000-0000-000000000004'::uuid
            WHERE ""StockOutId"" = 'a1000000-0000-0000-0000-000000000010'::uuid
              AND ""Notes"" LIKE '%AIR_SENSOR%';
        ");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
    }
}
