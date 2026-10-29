using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using SmartFarm.Infrastructure.Persistence;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    [DbContext(typeof(SmartFarmDbContext))]
    [Migration("20261029170000_AddDocumentStructuredExtraction")]
    public partial class AddDocumentStructuredExtraction : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "structured_extraction",
                table: "agriculture_documents",
                type: "text",
                nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "structured_extraction", table: "agriculture_documents");
        }
    }
}
