using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ControlAutomation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "auto_control_rules",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    farm_id = table.Column<Guid>(type: "uuid", nullable: false),
                    zone_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    parameter_code = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    @operator = table.Column<string>(name: "operator", type: "character varying(30)", maxLength: 30, nullable: false),
                    threshold = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    condition_duration_minutes = table.Column<int>(type: "integer", nullable: false),
                    actuator_id = table.Column<Guid>(type: "uuid", nullable: false),
                    action = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    duration_seconds = table.Column<int>(type: "integer", nullable: false),
                    priority = table.Column<int>(type: "integer", nullable: false),
                    cooldown_minutes = table.Column<int>(type: "integer", nullable: false),
                    enable_rain_delay = table.Column<bool>(type: "boolean", nullable: false),
                    rain_threshold_percent = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    last_triggered_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    condition_true_since_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    archived_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_auto_control_rules", x => x.id);
                    table.CheckConstraint("ck_auto_rule_condition_duration", "condition_duration_minutes BETWEEN 1 AND 1440");
                    table.CheckConstraint("ck_auto_rule_cooldown", "cooldown_minutes BETWEEN 1 AND 10080");
                    table.CheckConstraint("ck_auto_rule_duration", "duration_seconds BETWEEN 1 AND 1800");
                    table.CheckConstraint("ck_auto_rule_rain", "rain_threshold_percent BETWEEN 0 AND 100");
                    table.ForeignKey(
                        name: "FK_auto_control_rules_device_actuators_actuator_id",
                        column: x => x.actuator_id,
                        principalTable: "device_actuators",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_auto_control_rules_farms_farm_id",
                        column: x => x.farm_id,
                        principalTable: "farms",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_auto_control_rules_tenants_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_auto_control_rules_zones_zone_id",
                        column: x => x.zone_id,
                        principalTable: "zones",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "control_schedules",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    farm_id = table.Column<Guid>(type: "uuid", nullable: false),
                    zone_id = table.Column<Guid>(type: "uuid", nullable: false),
                    actuator_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    cron_expression = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    duration_seconds = table.Column<int>(type: "integer", nullable: false),
                    enable_rain_delay = table.Column<bool>(type: "boolean", nullable: false),
                    rain_threshold_percent = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    next_run_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    archived_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_control_schedules", x => x.id);
                    table.CheckConstraint("ck_control_schedule_duration", "duration_seconds BETWEEN 1 AND 1800");
                    table.CheckConstraint("ck_control_schedule_rain", "rain_threshold_percent BETWEEN 0 AND 100");
                    table.ForeignKey(
                        name: "FK_control_schedules_device_actuators_actuator_id",
                        column: x => x.actuator_id,
                        principalTable: "device_actuators",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_control_schedules_farms_farm_id",
                        column: x => x.farm_id,
                        principalTable: "farms",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_control_schedules_tenants_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_control_schedules_zones_zone_id",
                        column: x => x.zone_id,
                        principalTable: "zones",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "actuator_commands",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    farm_id = table.Column<Guid>(type: "uuid", nullable: false),
                    zone_id = table.Column<Guid>(type: "uuid", nullable: false),
                    actuator_id = table.Column<Guid>(type: "uuid", nullable: false),
                    device_id = table.Column<Guid>(type: "uuid", nullable: false),
                    gateway_id = table.Column<Guid>(type: "uuid", nullable: false),
                    triggered_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    schedule_id = table.Column<Guid>(type: "uuid", nullable: true),
                    auto_rule_id = table.Column<Guid>(type: "uuid", nullable: true),
                    recommendation_id = table.Column<Guid>(type: "uuid", nullable: true),
                    idempotency_key = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    trigger_source = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    action = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    duration_seconds = table.Column<int>(type: "integer", nullable: false),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    queued_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    sent_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ack_deadline_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    acknowledged_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    execution_ends_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    cancellation_requested_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    terminal_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    observed_state = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    error_code = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    error_message = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_actuator_commands", x => x.id);
                    table.CheckConstraint("ck_actuator_command_duration", "duration_seconds BETWEEN 1 AND 1800");
                    table.ForeignKey(
                        name: "FK_actuator_commands_app_users_triggered_by_user_id",
                        column: x => x.triggered_by_user_id,
                        principalTable: "app_users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_actuator_commands_auto_control_rules_auto_rule_id",
                        column: x => x.auto_rule_id,
                        principalTable: "auto_control_rules",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_actuator_commands_control_schedules_schedule_id",
                        column: x => x.schedule_id,
                        principalTable: "control_schedules",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_actuator_commands_device_actuators_actuator_id",
                        column: x => x.actuator_id,
                        principalTable: "device_actuators",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_actuator_commands_devices_device_id",
                        column: x => x.device_id,
                        principalTable: "devices",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_actuator_commands_farms_farm_id",
                        column: x => x.farm_id,
                        principalTable: "farms",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_actuator_commands_gateways_gateway_id",
                        column: x => x.gateway_id,
                        principalTable: "gateways",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_actuator_commands_tenants_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_actuator_commands_zones_zone_id",
                        column: x => x.zone_id,
                        principalTable: "zones",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "actuator_command_events",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    command_id = table.Column<Guid>(type: "uuid", nullable: false),
                    event_kind = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    occurred_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    detail = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    observed_state = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_actuator_command_events", x => x.id);
                    table.ForeignKey(
                        name: "FK_actuator_command_events_actuator_commands_command_id",
                        column: x => x.command_id,
                        principalTable: "actuator_commands",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_actuator_command_events_command_id_occurred_at_utc",
                table: "actuator_command_events",
                columns: new[] { "command_id", "occurred_at_utc" });

            migrationBuilder.CreateIndex(
                name: "IX_actuator_commands_actuator_id",
                table: "actuator_commands",
                column: "actuator_id");

            migrationBuilder.CreateIndex(
                name: "IX_actuator_commands_auto_rule_id",
                table: "actuator_commands",
                column: "auto_rule_id");

            migrationBuilder.CreateIndex(
                name: "IX_actuator_commands_device_id",
                table: "actuator_commands",
                column: "device_id");

            migrationBuilder.CreateIndex(
                name: "IX_actuator_commands_farm_id",
                table: "actuator_commands",
                column: "farm_id");

            migrationBuilder.CreateIndex(
                name: "IX_actuator_commands_gateway_id",
                table: "actuator_commands",
                column: "gateway_id");

            migrationBuilder.CreateIndex(
                name: "IX_actuator_commands_schedule_id",
                table: "actuator_commands",
                column: "schedule_id");

            migrationBuilder.CreateIndex(
                name: "IX_actuator_commands_tenant_id_idempotency_key",
                table: "actuator_commands",
                columns: new[] { "tenant_id", "idempotency_key" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_actuator_commands_triggered_by_user_id",
                table: "actuator_commands",
                column: "triggered_by_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_actuator_commands_zone_id_status_execution_ends_at_utc",
                table: "actuator_commands",
                columns: new[] { "zone_id", "status", "execution_ends_at_utc" });

            migrationBuilder.CreateIndex(
                name: "IX_auto_control_rules_actuator_id",
                table: "auto_control_rules",
                column: "actuator_id");

            migrationBuilder.CreateIndex(
                name: "IX_auto_control_rules_farm_id",
                table: "auto_control_rules",
                column: "farm_id");

            migrationBuilder.CreateIndex(
                name: "IX_auto_control_rules_tenant_id",
                table: "auto_control_rules",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_auto_control_rules_zone_id_is_active",
                table: "auto_control_rules",
                columns: new[] { "zone_id", "is_active" });

            migrationBuilder.CreateIndex(
                name: "IX_control_schedules_actuator_id",
                table: "control_schedules",
                column: "actuator_id");

            migrationBuilder.CreateIndex(
                name: "IX_control_schedules_farm_id",
                table: "control_schedules",
                column: "farm_id");

            migrationBuilder.CreateIndex(
                name: "IX_control_schedules_tenant_id",
                table: "control_schedules",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_control_schedules_zone_id_is_active_next_run_at_utc",
                table: "control_schedules",
                columns: new[] { "zone_id", "is_active", "next_run_at_utc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "actuator_command_events");

            migrationBuilder.DropTable(
                name: "actuator_commands");

            migrationBuilder.DropTable(
                name: "auto_control_rules");

            migrationBuilder.DropTable(
                name: "control_schedules");
        }
    }
}
