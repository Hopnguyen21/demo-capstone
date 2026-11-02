using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class SyncGatewayTelemetryColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "antenna_direction",
                table: "gateways",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "configured_at_utc",
                table: "gateways",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "configured_node_ids_csv",
                table: "gateways",
                type: "character varying(4000)",
                maxLength: 4000,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "installation_location",
                table: "gateways",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "samples_per_interval",
                table: "gateways",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "telemetry_interval_sec",
                table: "gateways",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "antenna_direction",
                table: "gateways");

            migrationBuilder.DropColumn(
                name: "configured_at_utc",
                table: "gateways");

            migrationBuilder.DropColumn(
                name: "configured_node_ids_csv",
                table: "gateways");

            migrationBuilder.DropColumn(
                name: "installation_location",
                table: "gateways");

            migrationBuilder.DropColumn(
                name: "samples_per_interval",
                table: "gateways");

            migrationBuilder.DropColumn(
                name: "telemetry_interval_sec",
                table: "gateways");
        }
    }
}
