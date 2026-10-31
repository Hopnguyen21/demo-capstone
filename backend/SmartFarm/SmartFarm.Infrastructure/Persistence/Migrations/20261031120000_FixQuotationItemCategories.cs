using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using SmartFarm.Infrastructure.Persistence;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Giao diện cũ gán mọi dòng báo giá là GATEWAY. Phân loại lại theo mã/tên thiết bị rồi lập lại danh mục thiết bị của hợp đồng.
    /// Chỉ đụng các dòng đang là GATEWAY nhưng không phải gateway; chạy lại không đổi gì thêm.
    /// </summary>
    [DbContext(typeof(SmartFarmDbContext))]
    [Migration("20261031120000_FixQuotationItemCategories")]
    public partial class FixQuotationItemCategories : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
UPDATE ""ServiceRequestQuotationItems"" i
SET ""Category"" = CASE
    WHEN upper(i.""HardwareItemCode"") LIKE '%VALVE%' OR i.""HardwareItemName"" ILIKE '%van %' OR i.""HardwareItemName"" ILIKE '%solenoid%' THEN 'VALVE'
    WHEN upper(i.""HardwareItemCode"") LIKE '%PUMP%' OR i.""HardwareItemName"" ILIKE '%bơm%' THEN 'PUMP'
    WHEN upper(i.""HardwareItemCode"") LIKE '%SOIL%' OR i.""HardwareItemName"" ILIKE '%đất%' THEN 'SOIL_SENSOR'
    WHEN upper(i.""HardwareItemCode"") LIKE '%AIR%' OR i.""HardwareItemName"" ILIKE '%không khí%' OR i.""HardwareItemName"" ILIKE '%vi khí hậu%' THEN 'AIR_SENSOR'
    ELSE 'SENSOR_NODE' END
WHERE i.""Category"" = 'GATEWAY'
  AND NOT (upper(i.""HardwareItemCode"") LIKE 'GW%' OR i.""HardwareItemName"" ILIKE '%gateway%' OR i.""HardwareItemName"" ILIKE '%trạm central%');");

            migrationBuilder.Sql(@"
UPDATE ""ZoneContracts"" c
SET ""EquipmentJson"" = (
    SELECT json_agg(json_build_object(
        'code', i.""HardwareItemCode"", 'name', i.""HardwareItemName"", 'category', i.""Category"",
        'unit', i.""Unit"", 'quantity', i.""Quantity"", 'unitPrice', i.""UnitPrice"") ORDER BY i.""HardwareItemName"")::text
    FROM ""ServiceRequestQuotationItems"" i
    JOIN ""ServiceRequestQuotations"" q ON q.""Id"" = i.""QuotationId""
    WHERE upper(left(q.""Id""::text, 8)) = substr(c.""ContractNumber"", 7))
WHERE c.""ContractNumber"" LIKE 'HD-SR-%' AND c.""EquipmentJson"" IS NOT NULL;");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}
