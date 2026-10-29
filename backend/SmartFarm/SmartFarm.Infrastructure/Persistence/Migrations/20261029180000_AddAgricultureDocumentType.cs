using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using SmartFarm.Infrastructure.Persistence;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    /// <summary>Phân loại tài liệu. Dòng cũ nhận OfficialStandard (đúng với cách kiểm tra trước đây).</summary>
    [DbContext(typeof(SmartFarmDbContext))]
    [Migration("20261029180000_AddAgricultureDocumentType")]
    public partial class AddAgricultureDocumentType : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "document_type",
                table: "agriculture_documents",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "OfficialStandard");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "document_type", table: "agriculture_documents");
        }
    }
}
