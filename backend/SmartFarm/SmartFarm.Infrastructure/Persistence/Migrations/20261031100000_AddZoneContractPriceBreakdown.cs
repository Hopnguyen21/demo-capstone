using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using SmartFarm.Infrastructure.Persistence;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Lưu bảng giá của hợp đồng (chiết khấu, VAT) để hiển thị đúng thay vì chỉ có tổng và tiền cọc.
    /// Hợp đồng tạo từ báo giá được điền lại từ báo giá gốc; hợp đồng khác để 0 (không có dữ liệu để suy ra).
    /// </summary>
    [DbContext(typeof(SmartFarmDbContext))]
    [Migration("20261031100000_AddZoneContractPriceBreakdown")]
    public partial class AddZoneContractPriceBreakdown : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(name: "DiscountPercent", table: "ZoneContracts", type: "numeric", nullable: false, defaultValue: 0m);
            migrationBuilder.AddColumn<decimal>(name: "DiscountVnd", table: "ZoneContracts", type: "numeric", nullable: false, defaultValue: 0m);
            migrationBuilder.AddColumn<decimal>(name: "VatAmountVnd", table: "ZoneContracts", type: "numeric", nullable: false, defaultValue: 0m);
            migrationBuilder.AddColumn<decimal>(name: "VatPercent", table: "ZoneContracts", type: "numeric", nullable: false, defaultValue: 0m);

            // Hợp đồng sinh từ báo giá có số HD-SR-{8 ký tự đầu của mã báo giá}.
            migrationBuilder.Sql(@"
UPDATE ""ZoneContracts"" c
SET ""VatAmountVnd"" = q.""VatAmount"", ""VatPercent"" = q.""VatPercent""
FROM ""ServiceRequestQuotations"" q
WHERE c.""ContractNumber"" LIKE 'HD-SR-%'
  AND upper(left(q.""Id""::text, 8)) = substr(c.""ContractNumber"", 7);");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "VatPercent", table: "ZoneContracts");
            migrationBuilder.DropColumn(name: "VatAmountVnd", table: "ZoneContracts");
            migrationBuilder.DropColumn(name: "DiscountVnd", table: "ZoneContracts");
            migrationBuilder.DropColumn(name: "DiscountPercent", table: "ZoneContracts");
        }
    }
}
