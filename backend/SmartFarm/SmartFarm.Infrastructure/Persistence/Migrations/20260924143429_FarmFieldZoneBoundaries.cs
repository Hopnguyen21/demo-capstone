using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class FarmFieldZoneBoundaries : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "boundary_geo_json",
                table: "zones",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "boundary_geo_json",
                table: "fields",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "ck_zones_boundary_json",
                table: "zones",
                sql: "boundary_geo_json IS NULL OR jsonb_typeof(boundary_geo_json) = 'object'");

            migrationBuilder.AddCheckConstraint(
                name: "ck_fields_boundary_json",
                table: "fields",
                sql: "boundary_geo_json IS NULL OR jsonb_typeof(boundary_geo_json) = 'object'");

            migrationBuilder.AddCheckConstraint(
                name: "ck_farms_max_area",
                table: "farms",
                sql: "total_area_m2 <= 1000000");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_zones_boundary_json",
                table: "zones");

            migrationBuilder.DropCheckConstraint(
                name: "ck_fields_boundary_json",
                table: "fields");

            migrationBuilder.DropCheckConstraint(
                name: "ck_farms_max_area",
                table: "farms");

            migrationBuilder.DropColumn(
                name: "boundary_geo_json",
                table: "zones");

            migrationBuilder.DropColumn(
                name: "boundary_geo_json",
                table: "fields");
        }
    }
}
