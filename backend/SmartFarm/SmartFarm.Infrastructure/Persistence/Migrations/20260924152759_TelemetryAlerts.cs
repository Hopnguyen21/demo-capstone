using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class TelemetryAlerts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "client_certificate_fingerprint",
                table: "gateways",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "mqtt_client_id",
                table: "gateways",
                type: "character varying(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.Sql("UPDATE gateways SET mqtt_client_id = 'legacy-' || id::text, client_certificate_fingerprint = upper(md5(id::text) || md5(id::text)) WHERE mqtt_client_id IS NULL OR client_certificate_fingerprint IS NULL;");

            migrationBuilder.AlterColumn<string>(
                name: "client_certificate_fingerprint",
                table: "gateways",
                type: "character varying(128)",
                maxLength: 128,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(128)",
                oldMaxLength: 128,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "mqtt_client_id",
                table: "gateways",
                type: "character varying(150)",
                maxLength: 150,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(150)",
                oldMaxLength: 150,
                oldNullable: true);

            migrationBuilder.CreateTable(
                name: "alert_rules",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    zone_id = table.Column<Guid>(type: "uuid", nullable: false),
                    growth_stage_id = table.Column<Guid>(type: "uuid", nullable: false),
                    parameter_code = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    min_threshold = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    max_threshold = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    severity = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    cooldown_minutes = table.Column<int>(type: "integer", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    is_system_generated = table.Column<bool>(type: "boolean", nullable: false),
                    archived_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_alert_rules", x => x.id);
                    table.CheckConstraint("ck_alert_rules_cooldown", "cooldown_minutes BETWEEN 1 AND 1440");
                    table.CheckConstraint("ck_alert_rules_range", "min_threshold <= max_threshold");
                    table.ForeignKey(
                        name: "FK_alert_rules_growth_stages_growth_stage_id",
                        column: x => x.growth_stage_id,
                        principalTable: "growth_stages",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_alert_rules_zones_zone_id",
                        column: x => x.zone_id,
                        principalTable: "zones",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "telemetry_readings",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    farm_id = table.Column<Guid>(type: "uuid", nullable: false),
                    zone_id = table.Column<Guid>(type: "uuid", nullable: false),
                    device_id = table.Column<Guid>(type: "uuid", nullable: false),
                    gateway_id = table.Column<Guid>(type: "uuid", nullable: false),
                    message_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    parameter_code = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    value = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    unit = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    captured_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    received_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_telemetry_readings", x => x.id);
                    table.ForeignKey(
                        name: "FK_telemetry_readings_devices_device_id",
                        column: x => x.device_id,
                        principalTable: "devices",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_telemetry_readings_farms_farm_id",
                        column: x => x.farm_id,
                        principalTable: "farms",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_telemetry_readings_gateways_gateway_id",
                        column: x => x.gateway_id,
                        principalTable: "gateways",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_telemetry_readings_tenants_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_telemetry_readings_zones_zone_id",
                        column: x => x.zone_id,
                        principalTable: "zones",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "alert_rule_evaluation_states",
                columns: table => new
                {
                    alert_rule_id = table.Column<Guid>(type: "uuid", nullable: false),
                    device_id = table.Column<Guid>(type: "uuid", nullable: false),
                    consecutive_violation_count = table.Column<int>(type: "integer", nullable: false),
                    last_violation_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    last_alert_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    last_message_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_alert_rule_evaluation_states", x => new { x.alert_rule_id, x.device_id });
                    table.ForeignKey(
                        name: "FK_alert_rule_evaluation_states_alert_rules_alert_rule_id",
                        column: x => x.alert_rule_id,
                        principalTable: "alert_rules",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_alert_rule_evaluation_states_devices_device_id",
                        column: x => x.device_id,
                        principalTable: "devices",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "alerts",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    farm_id = table.Column<Guid>(type: "uuid", nullable: false),
                    zone_id = table.Column<Guid>(type: "uuid", nullable: false),
                    device_id = table.Column<Guid>(type: "uuid", nullable: false),
                    alert_rule_id = table.Column<Guid>(type: "uuid", nullable: false),
                    planting_season_id = table.Column<Guid>(type: "uuid", nullable: false),
                    growth_stage_id = table.Column<Guid>(type: "uuid", nullable: false),
                    parameter_code = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    observed_value = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    min_threshold = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    max_threshold = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    unit = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    severity = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    title = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    acknowledged_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    resolved_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_alerts", x => x.id);
                    table.ForeignKey(
                        name: "FK_alerts_alert_rules_alert_rule_id",
                        column: x => x.alert_rule_id,
                        principalTable: "alert_rules",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_alerts_devices_device_id",
                        column: x => x.device_id,
                        principalTable: "devices",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_alerts_farms_farm_id",
                        column: x => x.farm_id,
                        principalTable: "farms",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_alerts_growth_stages_growth_stage_id",
                        column: x => x.growth_stage_id,
                        principalTable: "growth_stages",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_alerts_planting_seasons_planting_season_id",
                        column: x => x.planting_season_id,
                        principalTable: "planting_seasons",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_alerts_tenants_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_alerts_zones_zone_id",
                        column: x => x.zone_id,
                        principalTable: "zones",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "alert_history_events",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    alert_id = table.Column<Guid>(type: "uuid", nullable: false),
                    actor_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    event_type = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    action_taken = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_alert_history_events", x => x.id);
                    table.ForeignKey(
                        name: "FK_alert_history_events_alerts_alert_id",
                        column: x => x.alert_id,
                        principalTable: "alerts",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_alert_history_events_app_users_actor_user_id",
                        column: x => x.actor_user_id,
                        principalTable: "app_users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_gateways_client_certificate_fingerprint",
                table: "gateways",
                column: "client_certificate_fingerprint",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_gateways_mqtt_client_id",
                table: "gateways",
                column: "mqtt_client_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_alert_history_events_actor_user_id",
                table: "alert_history_events",
                column: "actor_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_alert_history_events_alert_id",
                table: "alert_history_events",
                column: "alert_id");

            migrationBuilder.CreateIndex(
                name: "IX_alert_rule_evaluation_states_device_id",
                table: "alert_rule_evaluation_states",
                column: "device_id");

            migrationBuilder.CreateIndex(
                name: "IX_alert_rules_growth_stage_id",
                table: "alert_rules",
                column: "growth_stage_id");

            migrationBuilder.CreateIndex(
                name: "IX_alert_rules_zone_id_growth_stage_id_parameter_code_severity",
                table: "alert_rules",
                columns: new[] { "zone_id", "growth_stage_id", "parameter_code", "severity" },
                unique: true,
                filter: "archived_at_utc IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_alerts_alert_rule_id",
                table: "alerts",
                column: "alert_rule_id");

            migrationBuilder.CreateIndex(
                name: "IX_alerts_device_id",
                table: "alerts",
                column: "device_id");

            migrationBuilder.CreateIndex(
                name: "IX_alerts_farm_id",
                table: "alerts",
                column: "farm_id");

            migrationBuilder.CreateIndex(
                name: "IX_alerts_growth_stage_id",
                table: "alerts",
                column: "growth_stage_id");

            migrationBuilder.CreateIndex(
                name: "IX_alerts_planting_season_id",
                table: "alerts",
                column: "planting_season_id");

            migrationBuilder.CreateIndex(
                name: "IX_alerts_tenant_id",
                table: "alerts",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_alerts_zone_id_parameter_code_severity_status",
                table: "alerts",
                columns: new[] { "zone_id", "parameter_code", "severity", "status" });

            migrationBuilder.CreateIndex(
                name: "IX_telemetry_readings_device_id_captured_at_utc_parameter_code",
                table: "telemetry_readings",
                columns: new[] { "device_id", "captured_at_utc", "parameter_code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_telemetry_readings_device_id_message_id_parameter_code",
                table: "telemetry_readings",
                columns: new[] { "device_id", "message_id", "parameter_code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_telemetry_readings_farm_id",
                table: "telemetry_readings",
                column: "farm_id");

            migrationBuilder.CreateIndex(
                name: "IX_telemetry_readings_gateway_id",
                table: "telemetry_readings",
                column: "gateway_id");

            migrationBuilder.CreateIndex(
                name: "IX_telemetry_readings_tenant_id",
                table: "telemetry_readings",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_telemetry_readings_zone_id_parameter_code_captured_at_utc",
                table: "telemetry_readings",
                columns: new[] { "zone_id", "parameter_code", "captured_at_utc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "alert_history_events");

            migrationBuilder.DropTable(
                name: "alert_rule_evaluation_states");

            migrationBuilder.DropTable(
                name: "telemetry_readings");

            migrationBuilder.DropTable(
                name: "alerts");

            migrationBuilder.DropTable(
                name: "alert_rules");

            migrationBuilder.DropIndex(
                name: "IX_gateways_client_certificate_fingerprint",
                table: "gateways");

            migrationBuilder.DropIndex(
                name: "IX_gateways_mqtt_client_id",
                table: "gateways");

            migrationBuilder.DropColumn(
                name: "client_certificate_fingerprint",
                table: "gateways");

            migrationBuilder.DropColumn(
                name: "mqtt_client_id",
                table: "gateways");
        }
    }
}
