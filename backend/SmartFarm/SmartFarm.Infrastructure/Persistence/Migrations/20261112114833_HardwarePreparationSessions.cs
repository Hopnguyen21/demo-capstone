using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class HardwarePreparationSessions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "hardware_preparation_sessions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    hardware_item_id = table.Column<Guid>(type: "uuid", nullable: false),
                    technician_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    device_type = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    node_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    lora_address = table.Column<int>(type: "integer", nullable: true),
                    board_profile = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    completed_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_hardware_preparation_sessions", x => x.id);
                    table.ForeignKey(
                        name: "FK_hardware_preparation_sessions_PlatformHardwareItems_hardwar~",
                        column: x => x.hardware_item_id,
                        principalTable: "PlatformHardwareItems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_hardware_preparation_sessions_app_users_technician_user_id",
                        column: x => x.technician_user_id,
                        principalTable: "app_users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_hardware_preparation_sessions_hardware_item_id_status",
                table: "hardware_preparation_sessions",
                columns: new[] { "hardware_item_id", "status" });

            migrationBuilder.CreateIndex(
                name: "IX_hardware_preparation_sessions_technician_user_id_status",
                table: "hardware_preparation_sessions",
                columns: new[] { "technician_user_id", "status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "hardware_preparation_sessions");
        }
    }
}
