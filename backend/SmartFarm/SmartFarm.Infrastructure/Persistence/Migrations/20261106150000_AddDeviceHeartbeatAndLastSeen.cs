using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using SmartFarm.Infrastructure.Persistence;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    [DbContext(typeof(SmartFarmDbContext))]
    [Migration("20261106150000_AddDeviceHeartbeatAndLastSeen")]
    public partial class AddDeviceHeartbeatAndLastSeen : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "last_seen_at_utc",
                table: "devices",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "heartbeat_interval_seconds",
                table: "devices",
                type: "integer",
                nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "heartbeat_interval_seconds",
                table: "devices");

            migrationBuilder.DropColumn(
                name: "last_seen_at_utc",
                table: "devices");
        }
    }
}

