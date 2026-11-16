using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class LinkHardwareItemToDevice : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "HardwareItemId",
                table: "devices",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_devices_HardwareItemId",
                table: "devices",
                column: "HardwareItemId");

            migrationBuilder.AddForeignKey(
                name: "FK_devices_PlatformHardwareItems_HardwareItemId",
                table: "devices",
                column: "HardwareItemId",
                principalTable: "PlatformHardwareItems",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_devices_PlatformHardwareItems_HardwareItemId",
                table: "devices");

            migrationBuilder.DropIndex(
                name: "IX_devices_HardwareItemId",
                table: "devices");

            migrationBuilder.DropColumn(
                name: "HardwareItemId",
                table: "devices");
        }
    }
}
