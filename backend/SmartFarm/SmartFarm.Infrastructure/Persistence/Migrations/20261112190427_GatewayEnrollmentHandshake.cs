using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class GatewayEnrollmentHandshake : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "EnrolledAtUtc",
                table: "gateway_enrollments",
                newName: "enrolled_at_utc");

            migrationBuilder.AddColumn<DateTime>(
                name: "handshake_verified_at_utc",
                table: "gateway_enrollments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "FirmwareReleaseId",
                table: "firmware_installations",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_firmware_installations_FirmwareReleaseId",
                table: "firmware_installations",
                column: "FirmwareReleaseId");

            migrationBuilder.AddForeignKey(
                name: "FK_firmware_installations_firmware_releases_FirmwareReleaseId",
                table: "firmware_installations",
                column: "FirmwareReleaseId",
                principalTable: "firmware_releases",
                principalColumn: "id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_firmware_installations_firmware_releases_FirmwareReleaseId",
                table: "firmware_installations");

            migrationBuilder.DropIndex(
                name: "IX_firmware_installations_FirmwareReleaseId",
                table: "firmware_installations");

            migrationBuilder.DropColumn(
                name: "handshake_verified_at_utc",
                table: "gateway_enrollments");

            migrationBuilder.DropColumn(
                name: "FirmwareReleaseId",
                table: "firmware_installations");

            migrationBuilder.RenameColumn(
                name: "enrolled_at_utc",
                table: "gateway_enrollments",
                newName: "EnrolledAtUtc");
        }
    }
}
