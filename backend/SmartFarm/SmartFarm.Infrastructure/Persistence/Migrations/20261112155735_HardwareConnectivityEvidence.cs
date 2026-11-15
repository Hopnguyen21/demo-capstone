using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class HardwareConnectivityEvidence : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "ConnectivityCheckPassed",
                table: "hardware_preparation_sessions",
                type: "boolean",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ConnectivityCheckedAtUtc",
                table: "hardware_preparation_sessions",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ConnectivityEvidence",
                table: "hardware_preparation_sessions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "ConnectivityCheckPassed",
                table: "deployment_requests",
                type: "boolean",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ConnectivityCheckedAtUtc",
                table: "deployment_requests",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ConnectivityEvidence",
                table: "deployment_requests",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ConnectivityCheckPassed",
                table: "hardware_preparation_sessions");

            migrationBuilder.DropColumn(
                name: "ConnectivityCheckedAtUtc",
                table: "hardware_preparation_sessions");

            migrationBuilder.DropColumn(
                name: "ConnectivityEvidence",
                table: "hardware_preparation_sessions");

            migrationBuilder.DropColumn(
                name: "ConnectivityCheckPassed",
                table: "deployment_requests");

            migrationBuilder.DropColumn(
                name: "ConnectivityCheckedAtUtc",
                table: "deployment_requests");

            migrationBuilder.DropColumn(
                name: "ConnectivityEvidence",
                table: "deployment_requests");
        }
    }
}
