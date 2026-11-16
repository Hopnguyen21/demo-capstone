using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class FirmwareInstallations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "firmware_installations",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    preparation_session_id = table.Column<Guid>(type: "uuid", nullable: false),
                    technician_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    firmware_version = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    upload_method = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    board_profile = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    bootloader_profile = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    result = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    error_message = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    completed_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_firmware_installations", x => x.id);
                    table.ForeignKey(
                        name: "FK_firmware_installations_app_users_technician_user_id",
                        column: x => x.technician_user_id,
                        principalTable: "app_users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_firmware_installations_hardware_preparation_sessions_prepar~",
                        column: x => x.preparation_session_id,
                        principalTable: "hardware_preparation_sessions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_firmware_installations_preparation_session_id_created_at_utc",
                table: "firmware_installations",
                columns: new[] { "preparation_session_id", "created_at_utc" });

            migrationBuilder.CreateIndex(
                name: "IX_firmware_installations_technician_user_id",
                table: "firmware_installations",
                column: "technician_user_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "firmware_installations");
        }
    }
}
