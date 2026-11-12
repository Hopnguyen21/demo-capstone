using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using SmartFarm.Infrastructure.Persistence;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    /// <summary>Thêm phạm vi vùng khí hậu cho tài liệu tri thức RAG (rỗng = áp dụng mọi vùng).</summary>
    [DbContext(typeof(SmartFarmDbContext))]
    [Migration("20261109030000_AddDocumentRegionScope")]
    public partial class AddDocumentRegionScope : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "region_scope",
                table: "agriculture_documents",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "region_scope",
                table: "agriculture_documents");
        }
    }
}
