using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using SmartFarm.Infrastructure.Persistence;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    /// <summary>Xóa 3 gói hợp đồng mẫu (Starter/Standard/Professional) từng được seed; chỉ xóa gói chưa có hợp đồng nào dùng.</summary>
    [DbContext(typeof(SmartFarmDbContext))]
    [Migration("20261115070000_RemoveSampleContractPackages")]
    public partial class RemoveSampleContractPackages : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"DELETE FROM ""ContractPackages"" p
WHERE p.""Id"" IN ('a0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000003')
  AND NOT EXISTS (SELECT 1 FROM ""ZoneContracts"" c WHERE c.""ContractPackageId"" = p.""Id"");");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Dữ liệu mẫu đã xóa không khôi phục lại.
        }
    }
}
