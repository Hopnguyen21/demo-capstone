using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFirmwareOtaDispatch : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "attempt_count",
                table: "firmware_jobs",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "command_id",
                table: "firmware_jobs",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "command_sent_at_utc",
                table: "firmware_jobs",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "error_code",
                table: "firmware_jobs",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "error_message",
                table: "firmware_jobs",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "finished_at_utc",
                table: "firmware_jobs",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "started_at_utc",
                table: "firmware_jobs",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_firmware_jobs_command_id",
                table: "firmware_jobs",
                column: "command_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_firmware_jobs_command_id",
                table: "firmware_jobs");

            migrationBuilder.DropColumn(
                name: "attempt_count",
                table: "firmware_jobs");

            migrationBuilder.DropColumn(
                name: "command_id",
                table: "firmware_jobs");

            migrationBuilder.DropColumn(
                name: "command_sent_at_utc",
                table: "firmware_jobs");

            migrationBuilder.DropColumn(
                name: "error_code",
                table: "firmware_jobs");

            migrationBuilder.DropColumn(
                name: "error_message",
                table: "firmware_jobs");

            migrationBuilder.DropColumn(
                name: "finished_at_utc",
                table: "firmware_jobs");

            migrationBuilder.DropColumn(
                name: "started_at_utc",
                table: "firmware_jobs");
        }
    }
}
