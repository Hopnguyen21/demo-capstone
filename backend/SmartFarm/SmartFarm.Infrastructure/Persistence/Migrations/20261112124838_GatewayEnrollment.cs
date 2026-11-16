using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class GatewayEnrollment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "gateway_enrollments",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    hardware_item_id = table.Column<Guid>(type: "uuid", nullable: false),
                    technician_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    mac_address = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    chip_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    gateway_serial = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    bootstrap_token_hash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    bootstrap_firmware_version = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    EnrolledAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_gateway_enrollments", x => x.id);
                    table.ForeignKey(
                        name: "FK_gateway_enrollments_PlatformHardwareItems_hardware_item_id",
                        column: x => x.hardware_item_id,
                        principalTable: "PlatformHardwareItems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_gateway_enrollments_app_users_technician_user_id",
                        column: x => x.technician_user_id,
                        principalTable: "app_users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_gateway_enrollments_hardware_item_id_status",
                table: "gateway_enrollments",
                columns: new[] { "hardware_item_id", "status" });

            migrationBuilder.CreateIndex(
                name: "IX_gateway_enrollments_technician_user_id",
                table: "gateway_enrollments",
                column: "technician_user_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "gateway_enrollments");
        }
    }
}
