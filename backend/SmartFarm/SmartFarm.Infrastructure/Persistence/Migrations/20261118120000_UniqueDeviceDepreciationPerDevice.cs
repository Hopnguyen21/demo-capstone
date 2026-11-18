using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using SmartFarm.Infrastructure.Persistence;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    /// <summary>Mỗi thiết bị chỉ có MỘT hồ sơ khấu hao (trước đây chỉ kiểm tra bằng code nên bị trùng khi seed/tự sinh).</summary>
    [DbContext(typeof(SmartFarmDbContext))]
    [Migration("20261118120000_UniqueDeviceDepreciationPerDevice")]
    public partial class UniqueDeviceDepreciationPerDevice : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Dữ liệu cũ có thể trùng: giữ dòng tạo MỚI nhất cho mỗi thiết bị rồi mới tạo chỉ mục duy nhất.
            migrationBuilder.Sql(@"
DELETE FROM ""DeviceDepreciations"" d
USING ""DeviceDepreciations"" n
WHERE d.""DeviceId"" = n.""DeviceId""
  AND d.""Id"" <> n.""Id""
  AND (d.""CreatedAtUtc"" < n.""CreatedAtUtc"" OR (d.""CreatedAtUtc"" = n.""CreatedAtUtc"" AND d.""Id"" < n.""Id""));
");
            migrationBuilder.Sql(@"DROP INDEX IF EXISTS ""IX_DeviceDepreciations_DeviceId"";");
            migrationBuilder.Sql(@"CREATE UNIQUE INDEX IF NOT EXISTS ""IX_DeviceDepreciations_DeviceId"" ON ""DeviceDepreciations"" (""DeviceId"");");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"DROP INDEX IF EXISTS ""IX_DeviceDepreciations_DeviceId"";");
            migrationBuilder.Sql(@"CREATE INDEX IF NOT EXISTS ""IX_DeviceDepreciations_DeviceId"" ON ""DeviceDepreciations"" (""DeviceId"");");
        }
    }
}
