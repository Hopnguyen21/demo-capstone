using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class FirmwareReleaseRegistry : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Older databases may never have contained these legacy columns.
            // Keep this migration idempotent so startup migration also works
            // against databases created from a slightly different baseline.
            migrationBuilder.Sql("ALTER TABLE actuator_command_events DROP COLUMN IF EXISTS heartbeat_interval_seconds;");
            migrationBuilder.Sql("ALTER TABLE actuator_command_events DROP COLUMN IF EXISTS last_seen_at_utc;");

            migrationBuilder.AddColumn<string>(
                name: "ConfigSyncStatus",
                table: "gateways",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "ConfigVersion",
                table: "gateways",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "HeartbeatIntervalSeconds",
                table: "gateways",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<long>(
                name: "LastAckedSequenceNumber",
                table: "gateways",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<int>(
                name: "PollingIntervalSeconds",
                table: "gateways",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "ResponseTimeoutMs",
                table: "gateways",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "RetryCount",
                table: "gateways",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AlterColumn<Guid>(
                name: "planting_season_id",
                table: "deployment_requests",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.Sql("ALTER TABLE agriculture_documents ADD COLUMN IF NOT EXISTS effective_date timestamp with time zone;");
            migrationBuilder.Sql("ALTER TABLE agriculture_documents ADD COLUMN IF NOT EXISTS expiration_date timestamp with time zone;");
            migrationBuilder.Sql("ALTER TABLE agriculture_documents ADD COLUMN IF NOT EXISTS issued_date timestamp with time zone;");
            migrationBuilder.Sql("ALTER TABLE agriculture_documents ADD COLUMN IF NOT EXISTS previous_version_id uuid;");
            migrationBuilder.Sql("ALTER TABLE agriculture_documents ADD COLUMN IF NOT EXISTS standard_code character varying(100);");

            migrationBuilder.CreateTable(
                name: "firmware_releases",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    hardware_target = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    version = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    protocol_version = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    source_repository = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    git_tag = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    commit_sha = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    artifact_url = table.Column<string>(type: "character varying(1500)", maxLength: 1500, nullable: false),
                    artifact_sha256 = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    release_notes = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    published_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    approved_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_firmware_releases", x => x.id);
                    table.ForeignKey(
                        name: "FK_firmware_releases_app_users_approved_by_user_id",
                        column: x => x.approved_by_user_id,
                        principalTable: "app_users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.Sql("CREATE INDEX IF NOT EXISTS \"IX_agriculture_documents_previous_version_id\" ON agriculture_documents (previous_version_id);");

            migrationBuilder.CreateIndex(
                name: "IX_firmware_releases_approved_by_user_id",
                table: "firmware_releases",
                column: "approved_by_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_firmware_releases_hardware_target_version",
                table: "firmware_releases",
                columns: new[] { "hardware_target", "version" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "firmware_releases");

            migrationBuilder.DropIndex(
                name: "IX_agriculture_documents_previous_version_id",
                table: "agriculture_documents");

            migrationBuilder.DropColumn(
                name: "ConfigSyncStatus",
                table: "gateways");

            migrationBuilder.DropColumn(
                name: "ConfigVersion",
                table: "gateways");

            migrationBuilder.DropColumn(
                name: "HeartbeatIntervalSeconds",
                table: "gateways");

            migrationBuilder.DropColumn(
                name: "LastAckedSequenceNumber",
                table: "gateways");

            migrationBuilder.DropColumn(
                name: "PollingIntervalSeconds",
                table: "gateways");

            migrationBuilder.DropColumn(
                name: "ResponseTimeoutMs",
                table: "gateways");

            migrationBuilder.DropColumn(
                name: "RetryCount",
                table: "gateways");

            migrationBuilder.DropColumn(
                name: "effective_date",
                table: "agriculture_documents");

            migrationBuilder.DropColumn(
                name: "expiration_date",
                table: "agriculture_documents");

            migrationBuilder.DropColumn(
                name: "issued_date",
                table: "agriculture_documents");

            migrationBuilder.DropColumn(
                name: "previous_version_id",
                table: "agriculture_documents");

            migrationBuilder.DropColumn(
                name: "standard_code",
                table: "agriculture_documents");

            migrationBuilder.AlterColumn<Guid>(
                name: "planting_season_id",
                table: "deployment_requests",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<int>(
                name: "heartbeat_interval_seconds",
                table: "actuator_command_events",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "last_seen_at_utc",
                table: "actuator_command_events",
                type: "timestamp with time zone",
                nullable: true);
        }
    }
}
