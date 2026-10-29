using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using SmartFarm.Infrastructure.Persistence;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    [DbContext(typeof(SmartFarmDbContext))]
    [Migration("20261029120000_AddAgricultureDocumentReview")]
    public partial class AddAgricultureDocumentReview : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "review_status",
                table: "agriculture_documents",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "Approved");

            migrationBuilder.AddColumn<string>(
                name: "review_notes",
                table: "agriculture_documents",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "reviewed_at_utc",
                table: "agriculture_documents",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "original_file_bytes",
                table: "agriculture_documents",
                type: "bytea",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "original_file_content_type",
                table: "agriculture_documents",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "review_status", table: "agriculture_documents");
            migrationBuilder.DropColumn(name: "review_notes", table: "agriculture_documents");
            migrationBuilder.DropColumn(name: "reviewed_at_utc", table: "agriculture_documents");
            migrationBuilder.DropColumn(name: "original_file_bytes", table: "agriculture_documents");
            migrationBuilder.DropColumn(name: "original_file_content_type", table: "agriculture_documents");
        }
    }
}
