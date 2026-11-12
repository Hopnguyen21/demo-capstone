using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using SmartFarm.Infrastructure.Persistence;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    /// <summary>Cấu hình dự toán IoT trên danh mục phần cứng. Chỉ thêm cột; KHÔNG sửa hay ghi đè dữ liệu/giá hiện có.</summary>
    [DbContext(typeof(SmartFarmDbContext))]
    [Migration("20261111120000_AddHardwareItemEstimateConfig")]
    public partial class AddHardwareItemEstimateConfig : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(name: "EstimateRole", table: "PlatformHardwareItems", type: "text", nullable: true);
            migrationBuilder.AddColumn<int>(name: "EstimateUnits", table: "PlatformHardwareItems", type: "integer", nullable: false, defaultValue: 1);
            migrationBuilder.AddColumn<string>(name: "MeasuredParametersCsv", table: "PlatformHardwareItems", type: "text", nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "MeasuredParametersCsv", table: "PlatformHardwareItems");
            migrationBuilder.DropColumn(name: "EstimateUnits", table: "PlatformHardwareItems");
            migrationBuilder.DropColumn(name: "EstimateRole", table: "PlatformHardwareItems");
        }
    }
}
