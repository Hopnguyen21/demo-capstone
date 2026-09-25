using Microsoft.EntityFrameworkCore.Migrations;
using NetTopologySuite.Geometries;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class UsePostGisBoundaries : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_zones_boundary_json",
                table: "zones");

            migrationBuilder.DropCheckConstraint(
                name: "ck_fields_boundary_json",
                table: "fields");

            migrationBuilder.RenameColumn(
                name: "boundary_geo_json",
                table: "zones",
                newName: "boundary_geo_json_legacy");

            migrationBuilder.RenameColumn(
                name: "boundary_geo_json",
                table: "fields",
                newName: "boundary_geo_json_legacy");

            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:PostgresExtension:postgis", ",,");

            migrationBuilder.AddColumn<Polygon>(
                name: "boundary",
                table: "zones",
                type: "geometry(Polygon,4326)",
                nullable: true);

            migrationBuilder.AddColumn<Polygon>(
                name: "boundary",
                table: "fields",
                type: "geometry(Polygon,4326)",
                nullable: true);

            migrationBuilder.Sql("""
                UPDATE fields
                SET boundary = ST_SetSRID(ST_GeomFromGeoJSON(boundary_geo_json_legacy::text), 4326)::geometry(Polygon,4326)
                WHERE boundary_geo_json_legacy IS NOT NULL;

                UPDATE zones
                SET boundary = ST_SetSRID(ST_GeomFromGeoJSON(boundary_geo_json_legacy::text), 4326)::geometry(Polygon,4326)
                WHERE boundary_geo_json_legacy IS NOT NULL;
                """);

            migrationBuilder.CreateIndex(
                name: "ix_zones_boundary_gist",
                table: "zones",
                column: "boundary")
                .Annotation("Npgsql:IndexMethod", "gist");

            migrationBuilder.AddCheckConstraint(
                name: "ck_zones_boundary_valid",
                table: "zones",
                sql: "boundary IS NULL OR ST_IsValid(boundary)");

            migrationBuilder.CreateIndex(
                name: "ix_fields_boundary_gist",
                table: "fields",
                column: "boundary")
                .Annotation("Npgsql:IndexMethod", "gist");

            migrationBuilder.AddCheckConstraint(
                name: "ck_fields_boundary_valid",
                table: "fields",
                sql: "boundary IS NULL OR ST_IsValid(boundary)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_zones_boundary_gist",
                table: "zones");

            migrationBuilder.DropCheckConstraint(
                name: "ck_zones_boundary_valid",
                table: "zones");

            migrationBuilder.DropIndex(
                name: "ix_fields_boundary_gist",
                table: "fields");

            migrationBuilder.DropCheckConstraint(
                name: "ck_fields_boundary_valid",
                table: "fields");

            migrationBuilder.DropColumn(name: "boundary", table: "zones");
            migrationBuilder.DropColumn(name: "boundary", table: "fields");

            migrationBuilder.RenameColumn(
                name: "boundary_geo_json_legacy",
                table: "zones",
                newName: "boundary_geo_json");

            migrationBuilder.RenameColumn(
                name: "boundary_geo_json_legacy",
                table: "fields",
                newName: "boundary_geo_json");

            migrationBuilder.AddCheckConstraint(
                name: "ck_zones_boundary_json",
                table: "zones",
                sql: "boundary_geo_json IS NULL OR jsonb_typeof(boundary_geo_json) = 'object'");

            migrationBuilder.AddCheckConstraint(
                name: "ck_fields_boundary_json",
                table: "fields",
                sql: "boundary_geo_json IS NULL OR jsonb_typeof(boundary_geo_json) = 'object'");
        }
    }
}
