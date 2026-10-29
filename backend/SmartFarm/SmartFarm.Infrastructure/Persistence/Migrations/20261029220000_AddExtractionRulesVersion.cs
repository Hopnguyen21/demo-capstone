using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using SmartFarm.Infrastructure.Persistence;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Phiên bản quy tắc kiểm chứng của kết quả trích xuất. Kết quả cũ (0) được worker nền trích xuất lại theo quy tắc
    /// hiện hành (ngày không dấu, khoảng ngày, khớp trích dẫn khi AI thêm dấu).
    /// </summary>
    [DbContext(typeof(SmartFarmDbContext))]
    [Migration("20261029220000_AddExtractionRulesVersion")]
    public partial class AddExtractionRulesVersion : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "extraction_rules_version", table: "agriculture_documents", type: "integer", nullable: false, defaultValue: 0);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "extraction_rules_version", table: "agriculture_documents");
        }
    }
}
