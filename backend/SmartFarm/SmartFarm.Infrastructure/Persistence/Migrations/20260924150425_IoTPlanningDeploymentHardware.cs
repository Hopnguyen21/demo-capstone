using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class IoTPlanningDeploymentHardware : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "deployment_requests",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    farm_id = table.Column<Guid>(type: "uuid", nullable: false),
                    zone_id = table.Column<Guid>(type: "uuid", nullable: false),
                    planting_season_id = table.Column<Guid>(type: "uuid", nullable: false),
                    owner_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    technician_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    required_parameters_csv = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    owner_notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    failure_code = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    failure_description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    submitted_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    completed_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_deployment_requests", x => x.id);
                    table.ForeignKey(
                        name: "FK_deployment_requests_app_users_owner_user_id",
                        column: x => x.owner_user_id,
                        principalTable: "app_users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_deployment_requests_app_users_technician_user_id",
                        column: x => x.technician_user_id,
                        principalTable: "app_users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_deployment_requests_farms_farm_id",
                        column: x => x.farm_id,
                        principalTable: "farms",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_deployment_requests_planting_seasons_planting_season_id",
                        column: x => x.planting_season_id,
                        principalTable: "planting_seasons",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_deployment_requests_tenants_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_deployment_requests_zones_zone_id",
                        column: x => x.zone_id,
                        principalTable: "zones",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "device_model_definitions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    device_type = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    coverage_area_m2 = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_device_model_definitions", x => x.id);
                    table.CheckConstraint("ck_device_models_coverage", "coverage_area_m2 > 0");
                });

            migrationBuilder.CreateTable(
                name: "service_requests",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    farm_id = table.Column<Guid>(type: "uuid", nullable: false),
                    zone_id = table.Column<Guid>(type: "uuid", nullable: false),
                    deployment_request_id = table.Column<Guid>(type: "uuid", nullable: false),
                    device_id = table.Column<Guid>(type: "uuid", nullable: true),
                    source = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    failure_code = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_service_requests", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "deployment_decision_history",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    deployment_request_id = table.Column<Guid>(type: "uuid", nullable: false),
                    actor_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    decision_type = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    from_status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    to_status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_deployment_decision_history", x => x.id);
                    table.ForeignKey(
                        name: "FK_deployment_decision_history_app_users_actor_user_id",
                        column: x => x.actor_user_id,
                        principalTable: "app_users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_deployment_decision_history_deployment_requests_deployment_~",
                        column: x => x.deployment_request_id,
                        principalTable: "deployment_requests",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "deployment_surveys",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    deployment_request_id = table.Column<Guid>(type: "uuid", nullable: false),
                    technician_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    is_feasible = table.Column<bool>(type: "boolean", nullable: false),
                    site_conditions = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_deployment_surveys", x => x.id);
                    table.ForeignKey(
                        name: "FK_deployment_surveys_app_users_technician_user_id",
                        column: x => x.technician_user_id,
                        principalTable: "app_users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_deployment_surveys_deployment_requests_deployment_request_id",
                        column: x => x.deployment_request_id,
                        principalTable: "deployment_requests",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "gateways",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    farm_id = table.Column<Guid>(type: "uuid", nullable: false),
                    deployment_request_id = table.Column<Guid>(type: "uuid", nullable: false),
                    mac_address = table.Column<string>(type: "character varying(17)", maxLength: 17, nullable: false),
                    gateway_serial = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    frequency_band = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    firmware_version = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    last_seen_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_gateways", x => x.id);
                    table.ForeignKey(
                        name: "FK_gateways_deployment_requests_deployment_request_id",
                        column: x => x.deployment_request_id,
                        principalTable: "deployment_requests",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_gateways_farms_farm_id",
                        column: x => x.farm_id,
                        principalTable: "farms",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "deployment_plan_items",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    deployment_request_id = table.Column<Guid>(type: "uuid", nullable: false),
                    device_model_definition_id = table.Column<Guid>(type: "uuid", nullable: false),
                    quantity = table.Column<int>(type: "integer", nullable: false),
                    installation_notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_deployment_plan_items", x => x.id);
                    table.CheckConstraint("ck_deployment_plan_quantity", "quantity > 0");
                    table.ForeignKey(
                        name: "FK_deployment_plan_items_deployment_requests_deployment_reques~",
                        column: x => x.deployment_request_id,
                        principalTable: "deployment_requests",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_deployment_plan_items_device_model_definitions_device_model~",
                        column: x => x.device_model_definition_id,
                        principalTable: "device_model_definitions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "device_model_capabilities",
                columns: table => new
                {
                    device_model_definition_id = table.Column<Guid>(type: "uuid", nullable: false),
                    parameter_code = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_device_model_capabilities", x => new { x.device_model_definition_id, x.parameter_code });
                    table.ForeignKey(
                        name: "FK_device_model_capabilities_device_model_definitions_device_m~",
                        column: x => x.device_model_definition_id,
                        principalTable: "device_model_definitions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "devices",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    farm_id = table.Column<Guid>(type: "uuid", nullable: false),
                    gateway_id = table.Column<Guid>(type: "uuid", nullable: false),
                    deployment_request_id = table.Column<Guid>(type: "uuid", nullable: false),
                    zone_id = table.Column<Guid>(type: "uuid", nullable: true),
                    device_model_definition_id = table.Column<Guid>(type: "uuid", nullable: true),
                    hardware_address = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    device_type = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    installation_notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    gps_latitude = table.Column<decimal>(type: "numeric(9,6)", precision: 9, scale: 6, nullable: true),
                    gps_longitude = table.Column<decimal>(type: "numeric(9,6)", precision: 9, scale: 6, nullable: true),
                    decommissioned_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_devices", x => x.id);
                    table.ForeignKey(
                        name: "FK_devices_deployment_requests_deployment_request_id",
                        column: x => x.deployment_request_id,
                        principalTable: "deployment_requests",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_devices_device_model_definitions_device_model_definition_id",
                        column: x => x.device_model_definition_id,
                        principalTable: "device_model_definitions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_devices_farms_farm_id",
                        column: x => x.farm_id,
                        principalTable: "farms",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_devices_gateways_gateway_id",
                        column: x => x.gateway_id,
                        principalTable: "gateways",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_devices_zones_zone_id",
                        column: x => x.zone_id,
                        principalTable: "zones",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "firmware_jobs",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    gateway_id = table.Column<Guid>(type: "uuid", nullable: false),
                    target_version = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    firmware_url = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    scheduled_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_firmware_jobs", x => x.id);
                    table.ForeignKey(
                        name: "FK_firmware_jobs_gateways_gateway_id",
                        column: x => x.gateway_id,
                        principalTable: "gateways",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "device_actuators",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    device_id = table.Column<Guid>(type: "uuid", nullable: false),
                    actuator_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    relay_channel = table.Column<int>(type: "integer", nullable: false),
                    rated_power_watt = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: true),
                    max_duration_minutes = table.Column<int>(type: "integer", nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_device_actuators", x => x.id);
                    table.CheckConstraint("ck_actuator_duration", "max_duration_minutes BETWEEN 1 AND 30");
                    table.CheckConstraint("ck_actuator_relay", "relay_channel BETWEEN 1 AND 8");
                    table.ForeignKey(
                        name: "FK_device_actuators_devices_device_id",
                        column: x => x.device_id,
                        principalTable: "devices",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "device_assignment_history",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    device_id = table.Column<Guid>(type: "uuid", nullable: false),
                    zone_id = table.Column<Guid>(type: "uuid", nullable: true),
                    technician_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    action = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_device_assignment_history", x => x.id);
                    table.ForeignKey(
                        name: "FK_device_assignment_history_app_users_technician_user_id",
                        column: x => x.technician_user_id,
                        principalTable: "app_users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_device_assignment_history_devices_device_id",
                        column: x => x.device_id,
                        principalTable: "devices",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_device_assignment_history_zones_zone_id",
                        column: x => x.zone_id,
                        principalTable: "zones",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "device_connection_tests",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    device_id = table.Column<Guid>(type: "uuid", nullable: false),
                    deployment_request_id = table.Column<Guid>(type: "uuid", nullable: false),
                    technician_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    succeeded = table.Column<bool>(type: "boolean", nullable: false),
                    rssi = table.Column<decimal>(type: "numeric(8,2)", precision: 8, scale: 2, nullable: true),
                    snr = table.Column<decimal>(type: "numeric(8,2)", precision: 8, scale: 2, nullable: true),
                    round_trip_latency_ms = table.Column<int>(type: "integer", nullable: true),
                    observed_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    error_code = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    error_message = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_device_connection_tests", x => x.id);
                    table.ForeignKey(
                        name: "FK_device_connection_tests_app_users_technician_user_id",
                        column: x => x.technician_user_id,
                        principalTable: "app_users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_device_connection_tests_deployment_requests_deployment_requ~",
                        column: x => x.deployment_request_id,
                        principalTable: "deployment_requests",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_device_connection_tests_devices_device_id",
                        column: x => x.device_id,
                        principalTable: "devices",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "device_sensors",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    device_id = table.Column<Guid>(type: "uuid", nullable: false),
                    sensor_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    pin = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    model = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    @interface = table.Column<string>(name: "interface", type: "character varying(30)", maxLength: 30, nullable: true),
                    unit = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    min_value = table.Column<decimal>(type: "numeric(12,3)", precision: 12, scale: 3, nullable: true),
                    max_value = table.Column<decimal>(type: "numeric(12,3)", precision: 12, scale: 3, nullable: true),
                    sampling_interval_sec = table.Column<int>(type: "integer", nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_device_sensors", x => x.id);
                    table.CheckConstraint("ck_device_sensor_interval", "sampling_interval_sec BETWEEN 10 AND 3600");
                    table.ForeignKey(
                        name: "FK_device_sensors_devices_device_id",
                        column: x => x.device_id,
                        principalTable: "devices",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "device_model_definitions",
                columns: new[] { "id", "coverage_area_m2", "created_at_utc", "device_type", "is_active", "name", "updated_at_utc" },
                values: new object[] { new Guid("20000000-0000-0000-0000-000000000001"), 250m, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "SensorNode", true, "Environmental Sensor Node 4-in-1", null });

            migrationBuilder.InsertData(
                table: "device_model_capabilities",
                columns: new[] { "device_model_definition_id", "parameter_code" },
                values: new object[,]
                {
                    { new Guid("20000000-0000-0000-0000-000000000001"), "AirHumidity" },
                    { new Guid("20000000-0000-0000-0000-000000000001"), "Ec" },
                    { new Guid("20000000-0000-0000-0000-000000000001"), "LightIntensity" },
                    { new Guid("20000000-0000-0000-0000-000000000001"), "Ph" },
                    { new Guid("20000000-0000-0000-0000-000000000001"), "SoilMoisture" },
                    { new Guid("20000000-0000-0000-0000-000000000001"), "Temperature" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_deployment_decision_history_actor_user_id",
                table: "deployment_decision_history",
                column: "actor_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_deployment_decision_history_deployment_request_id",
                table: "deployment_decision_history",
                column: "deployment_request_id");

            migrationBuilder.CreateIndex(
                name: "IX_deployment_plan_items_deployment_request_id_device_model_de~",
                table: "deployment_plan_items",
                columns: new[] { "deployment_request_id", "device_model_definition_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_deployment_plan_items_device_model_definition_id",
                table: "deployment_plan_items",
                column: "device_model_definition_id");

            migrationBuilder.CreateIndex(
                name: "IX_deployment_requests_farm_id",
                table: "deployment_requests",
                column: "farm_id");

            migrationBuilder.CreateIndex(
                name: "IX_deployment_requests_owner_user_id",
                table: "deployment_requests",
                column: "owner_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_deployment_requests_planting_season_id",
                table: "deployment_requests",
                column: "planting_season_id");

            migrationBuilder.CreateIndex(
                name: "IX_deployment_requests_technician_user_id",
                table: "deployment_requests",
                column: "technician_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_deployment_requests_tenant_id",
                table: "deployment_requests",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_deployment_requests_zone_id",
                table: "deployment_requests",
                column: "zone_id",
                unique: true,
                filter: "status IN ('Submitted','Accepted','Surveyed','PlanConfirmed','Installing')");

            migrationBuilder.CreateIndex(
                name: "IX_deployment_surveys_deployment_request_id",
                table: "deployment_surveys",
                column: "deployment_request_id");

            migrationBuilder.CreateIndex(
                name: "IX_deployment_surveys_technician_user_id",
                table: "deployment_surveys",
                column: "technician_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_device_actuators_device_id_relay_channel",
                table: "device_actuators",
                columns: new[] { "device_id", "relay_channel" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_device_assignment_history_device_id",
                table: "device_assignment_history",
                column: "device_id");

            migrationBuilder.CreateIndex(
                name: "IX_device_assignment_history_technician_user_id",
                table: "device_assignment_history",
                column: "technician_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_device_assignment_history_zone_id",
                table: "device_assignment_history",
                column: "zone_id");

            migrationBuilder.CreateIndex(
                name: "IX_device_connection_tests_deployment_request_id",
                table: "device_connection_tests",
                column: "deployment_request_id");

            migrationBuilder.CreateIndex(
                name: "IX_device_connection_tests_device_id",
                table: "device_connection_tests",
                column: "device_id");

            migrationBuilder.CreateIndex(
                name: "IX_device_connection_tests_technician_user_id",
                table: "device_connection_tests",
                column: "technician_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_device_model_definitions_name",
                table: "device_model_definitions",
                column: "name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_device_sensors_device_id_pin",
                table: "device_sensors",
                columns: new[] { "device_id", "pin" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_devices_deployment_request_id",
                table: "devices",
                column: "deployment_request_id");

            migrationBuilder.CreateIndex(
                name: "IX_devices_device_model_definition_id",
                table: "devices",
                column: "device_model_definition_id");

            migrationBuilder.CreateIndex(
                name: "IX_devices_farm_id",
                table: "devices",
                column: "farm_id");

            migrationBuilder.CreateIndex(
                name: "IX_devices_gateway_id",
                table: "devices",
                column: "gateway_id");

            migrationBuilder.CreateIndex(
                name: "IX_devices_hardware_address",
                table: "devices",
                column: "hardware_address",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_devices_zone_id",
                table: "devices",
                column: "zone_id");

            migrationBuilder.CreateIndex(
                name: "IX_firmware_jobs_gateway_id",
                table: "firmware_jobs",
                column: "gateway_id");

            migrationBuilder.CreateIndex(
                name: "IX_gateways_deployment_request_id",
                table: "gateways",
                column: "deployment_request_id");

            migrationBuilder.CreateIndex(
                name: "IX_gateways_farm_id",
                table: "gateways",
                column: "farm_id");

            migrationBuilder.CreateIndex(
                name: "IX_gateways_gateway_serial",
                table: "gateways",
                column: "gateway_serial",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_gateways_mac_address",
                table: "gateways",
                column: "mac_address",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_service_requests_deployment_request_id_status",
                table: "service_requests",
                columns: new[] { "deployment_request_id", "status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "deployment_decision_history");

            migrationBuilder.DropTable(
                name: "deployment_plan_items");

            migrationBuilder.DropTable(
                name: "deployment_surveys");

            migrationBuilder.DropTable(
                name: "device_actuators");

            migrationBuilder.DropTable(
                name: "device_assignment_history");

            migrationBuilder.DropTable(
                name: "device_connection_tests");

            migrationBuilder.DropTable(
                name: "device_model_capabilities");

            migrationBuilder.DropTable(
                name: "device_sensors");

            migrationBuilder.DropTable(
                name: "firmware_jobs");

            migrationBuilder.DropTable(
                name: "service_requests");

            migrationBuilder.DropTable(
                name: "devices");

            migrationBuilder.DropTable(
                name: "device_model_definitions");

            migrationBuilder.DropTable(
                name: "gateways");

            migrationBuilder.DropTable(
                name: "deployment_requests");
        }
    }
}
