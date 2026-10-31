using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using SmartFarm.Infrastructure.Persistence;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Lưu danh mục thiết bị của hợp đồng để hiển thị số lượng/loại thiết bị thật.
    /// Hợp đồng sinh từ báo giá được điền lại từ các dòng báo giá gốc; hợp đồng khác để null.
    /// </summary>
    [DbContext(typeof(SmartFarmDbContext))]
    [Migration("20261031110000_AddZoneContractEquipment")]
    public partial class AddZoneContractEquipment : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(name: "EquipmentJson", table: "ZoneContracts", type: "text", nullable: true);

            migrationBuilder.Sql(@"
UPDATE ""ZoneContracts"" c
SET ""EquipmentJson"" = (
    SELECT json_agg(json_build_object(
        'code', i.""HardwareItemCode"", 'name', i.""HardwareItemName"", 'category', i.""Category"",
        'unit', i.""Unit"", 'quantity', i.""Quantity"", 'unitPrice', i.""UnitPrice"") ORDER BY i.""HardwareItemName"")::text
    FROM ""ServiceRequestQuotationItems"" i
    JOIN ""ServiceRequestQuotations"" q ON q.""Id"" = i.""QuotationId""
    WHERE upper(left(q.""Id""::text, 8)) = substr(c.""ContractNumber"", 7))
WHERE c.""ContractNumber"" LIKE 'HD-SR-%';");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "EquipmentJson", table: "ZoneContracts");
        }
    }
}
