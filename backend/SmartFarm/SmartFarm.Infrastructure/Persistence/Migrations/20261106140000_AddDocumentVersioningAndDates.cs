using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using SmartFarm.Infrastructure.Persistence;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    [DbContext(typeof(SmartFarmDbContext))]
    [Migration("20261106140000_AddDocumentVersioningAndDates")]
    public partial class AddDocumentVersioningAndDates : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "standard_code",
                table: "agriculture_documents",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "issued_date",
                table: "agriculture_documents",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "effective_date",
                table: "agriculture_documents",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "expiration_date",
                table: "agriculture_documents",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "previous_version_id",
                table: "agriculture_documents",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_agriculture_documents_previous_version_id",
                table: "agriculture_documents",
                column: "previous_version_id");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_agriculture_documents_previous_version_id",
                table: "agriculture_documents");

            migrationBuilder.DropColumn(
                name: "previous_version_id",
                table: "agriculture_documents");

            migrationBuilder.DropColumn(
                name: "expiration_date",
                table: "agriculture_documents");

            migrationBuilder.DropColumn(
                name: "effective_date",
                table: "agriculture_documents");

            migrationBuilder.DropColumn(
                name: "issued_date",
                table: "agriculture_documents");

            migrationBuilder.DropColumn(
                name: "standard_code",
                table: "agriculture_documents");
        }
    }
}

