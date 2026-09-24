using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CropGrowthPlantingSeason : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "crops",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    normalized_name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    scientific_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    is_system_defined = table.Column<bool>(type: "boolean", nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_crops", x => x.id);
                    table.CheckConstraint("ck_crops_scope", "(is_system_defined = true AND tenant_id IS NULL) OR (is_system_defined = false AND tenant_id IS NOT NULL)");
                    table.ForeignKey(
                        name: "FK_crops_app_users_created_by_user_id",
                        column: x => x.created_by_user_id,
                        principalTable: "app_users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_crops_tenants_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "crop_varieties",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    crop_id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    normalized_name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    is_system_defined = table.Column<bool>(type: "boolean", nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_crop_varieties", x => x.id);
                    table.CheckConstraint("ck_crop_varieties_scope", "(is_system_defined = true AND tenant_id IS NULL) OR (is_system_defined = false AND tenant_id IS NOT NULL)");
                    table.ForeignKey(
                        name: "FK_crop_varieties_app_users_created_by_user_id",
                        column: x => x.created_by_user_id,
                        principalTable: "app_users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_crop_varieties_crops_crop_id",
                        column: x => x.crop_id,
                        principalTable: "crops",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_crop_varieties_tenants_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "growth_profiles",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    crop_id = table.Column<Guid>(type: "uuid", nullable: false),
                    variety_id = table.Column<Guid>(type: "uuid", nullable: true),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    source_profile_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    normalized_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    is_default = table.Column<bool>(type: "boolean", nullable: false),
                    is_system_defined = table.Column<bool>(type: "boolean", nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_growth_profiles", x => x.id);
                    table.CheckConstraint("ck_growth_profiles_scope", "(is_system_defined = true AND tenant_id IS NULL) OR (is_system_defined = false AND tenant_id IS NOT NULL)");
                    table.ForeignKey(
                        name: "FK_growth_profiles_app_users_created_by_user_id",
                        column: x => x.created_by_user_id,
                        principalTable: "app_users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_growth_profiles_crop_varieties_variety_id",
                        column: x => x.variety_id,
                        principalTable: "crop_varieties",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_growth_profiles_crops_crop_id",
                        column: x => x.crop_id,
                        principalTable: "crops",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_growth_profiles_growth_profiles_source_profile_id",
                        column: x => x.source_profile_id,
                        principalTable: "growth_profiles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_growth_profiles_tenants_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "growth_stages",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    growth_profile_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    stage_order = table.Column<int>(type: "integer", nullable: false),
                    duration_days = table.Column<int>(type: "integer", nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_growth_stages", x => x.id);
                    table.CheckConstraint("ck_growth_stages_duration", "duration_days > 0");
                    table.CheckConstraint("ck_growth_stages_order", "stage_order > 0");
                    table.ForeignKey(
                        name: "FK_growth_stages_growth_profiles_growth_profile_id",
                        column: x => x.growth_profile_id,
                        principalTable: "growth_profiles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "environmental_requirements",
                columns: table => new
                {
                    growth_stage_id = table.Column<Guid>(type: "uuid", nullable: false),
                    parameter_code = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    min_value = table.Column<decimal>(type: "numeric(12,3)", precision: 12, scale: 3, nullable: false),
                    max_value = table.Column<decimal>(type: "numeric(12,3)", precision: 12, scale: 3, nullable: false),
                    target_value = table.Column<decimal>(type: "numeric(12,3)", precision: 12, scale: 3, nullable: false),
                    unit = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_environmental_requirements", x => new { x.growth_stage_id, x.parameter_code });
                    table.CheckConstraint("ck_environmental_requirement_range", "min_value <= target_value AND target_value <= max_value");
                    table.ForeignKey(
                        name: "FK_environmental_requirements_growth_stages_growth_stage_id",
                        column: x => x.growth_stage_id,
                        principalTable: "growth_stages",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "planting_seasons",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    zone_id = table.Column<Guid>(type: "uuid", nullable: false),
                    crop_id = table.Column<Guid>(type: "uuid", nullable: false),
                    variety_id = table.Column<Guid>(type: "uuid", nullable: true),
                    growth_profile_id = table.Column<Guid>(type: "uuid", nullable: false),
                    current_growth_stage_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    start_date = table.Column<DateOnly>(type: "date", nullable: false),
                    expected_end_date = table.Column<DateOnly>(type: "date", nullable: false),
                    actual_end_date = table.Column<DateOnly>(type: "date", nullable: true),
                    actual_yield_kg = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    close_notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_planting_seasons", x => x.id);
                    table.CheckConstraint("ck_planting_seasons_dates", "expected_end_date >= start_date + 20");
                    table.CheckConstraint("ck_planting_seasons_yield", "actual_yield_kg IS NULL OR actual_yield_kg >= 0");
                    table.ForeignKey(
                        name: "FK_planting_seasons_crop_varieties_variety_id",
                        column: x => x.variety_id,
                        principalTable: "crop_varieties",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_planting_seasons_crops_crop_id",
                        column: x => x.crop_id,
                        principalTable: "crops",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_planting_seasons_growth_profiles_growth_profile_id",
                        column: x => x.growth_profile_id,
                        principalTable: "growth_profiles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_planting_seasons_growth_stages_current_growth_stage_id",
                        column: x => x.current_growth_stage_id,
                        principalTable: "growth_stages",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_planting_seasons_zones_zone_id",
                        column: x => x.zone_id,
                        principalTable: "zones",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "season_applied_requirements",
                columns: table => new
                {
                    planting_season_id = table.Column<Guid>(type: "uuid", nullable: false),
                    parameter_code = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    min_value = table.Column<decimal>(type: "numeric(12,3)", precision: 12, scale: 3, nullable: false),
                    max_value = table.Column<decimal>(type: "numeric(12,3)", precision: 12, scale: 3, nullable: false),
                    target_value = table.Column<decimal>(type: "numeric(12,3)", precision: 12, scale: 3, nullable: false),
                    unit = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_season_applied_requirements", x => new { x.planting_season_id, x.parameter_code });
                    table.CheckConstraint("ck_season_applied_requirement_range", "min_value <= target_value AND target_value <= max_value");
                    table.ForeignKey(
                        name: "FK_season_applied_requirements_planting_seasons_planting_seaso~",
                        column: x => x.planting_season_id,
                        principalTable: "planting_seasons",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "season_stage_transitions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    planting_season_id = table.Column<Guid>(type: "uuid", nullable: false),
                    previous_growth_stage_id = table.Column<Guid>(type: "uuid", nullable: false),
                    current_growth_stage_id = table.Column<Guid>(type: "uuid", nullable: false),
                    changed_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_season_stage_transitions", x => x.id);
                    table.ForeignKey(
                        name: "FK_season_stage_transitions_app_users_changed_by_user_id",
                        column: x => x.changed_by_user_id,
                        principalTable: "app_users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_season_stage_transitions_growth_stages_current_growth_stage~",
                        column: x => x.current_growth_stage_id,
                        principalTable: "growth_stages",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_season_stage_transitions_growth_stages_previous_growth_stag~",
                        column: x => x.previous_growth_stage_id,
                        principalTable: "growth_stages",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_season_stage_transitions_planting_seasons_planting_season_id",
                        column: x => x.planting_season_id,
                        principalTable: "planting_seasons",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "crops",
                columns: new[] { "id", "created_at_utc", "created_by_user_id", "description", "is_system_defined", "name", "normalized_name", "scientific_name", "tenant_id", "updated_at_utc" },
                values: new object[] { new Guid("10000000-0000-0000-0000-000000000001"), new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), null, "System tomato crop", true, "Tomato", "TOMATO", "Solanum lycopersicum", null, null });

            migrationBuilder.InsertData(
                table: "crop_varieties",
                columns: new[] { "id", "created_at_utc", "created_by_user_id", "crop_id", "description", "is_system_defined", "name", "normalized_name", "tenant_id", "updated_at_utc" },
                values: new object[] { new Guid("10000000-0000-0000-0000-000000000002"), new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), null, new Guid("10000000-0000-0000-0000-000000000001"), "System tomato variety", true, "Beef F1", "BEEF F1", null, null });

            migrationBuilder.InsertData(
                table: "growth_profiles",
                columns: new[] { "id", "created_at_utc", "created_by_user_id", "crop_id", "description", "is_default", "is_system_defined", "name", "normalized_name", "source_profile_id", "tenant_id", "updated_at_utc", "variety_id" },
                values: new object[] { new Guid("10000000-0000-0000-0000-000000000003"), new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), null, new Guid("10000000-0000-0000-0000-000000000001"), "System default profile", true, true, "Default Tomato Beef Profile", "DEFAULT TOMATO BEEF PROFILE", null, null, null, new Guid("10000000-0000-0000-0000-000000000002") });

            migrationBuilder.InsertData(
                table: "growth_stages",
                columns: new[] { "id", "created_at_utc", "duration_days", "growth_profile_id", "name", "stage_order", "updated_at_utc" },
                values: new object[,]
                {
                    { new Guid("10000000-0000-0000-0000-000000000004"), new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), 20, new Guid("10000000-0000-0000-0000-000000000003"), "Seedling", 1, null },
                    { new Guid("10000000-0000-0000-0000-000000000005"), new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), 30, new Guid("10000000-0000-0000-0000-000000000003"), "Vegetative", 2, null }
                });

            migrationBuilder.InsertData(
                table: "environmental_requirements",
                columns: new[] { "growth_stage_id", "parameter_code", "max_value", "min_value", "target_value", "unit" },
                values: new object[,]
                {
                    { new Guid("10000000-0000-0000-0000-000000000004"), "AirHumidity", 75m, 60m, 70m, "%" },
                    { new Guid("10000000-0000-0000-0000-000000000004"), "Ph", 6.5m, 5.5m, 6m, "pH" },
                    { new Guid("10000000-0000-0000-0000-000000000004"), "SoilMoisture", 80m, 65m, 72m, "%" },
                    { new Guid("10000000-0000-0000-0000-000000000004"), "Temperature", 28m, 20m, 24m, "C" },
                    { new Guid("10000000-0000-0000-0000-000000000005"), "AirHumidity", 75m, 55m, 65m, "%" },
                    { new Guid("10000000-0000-0000-0000-000000000005"), "Ph", 6.8m, 5.5m, 6.2m, "pH" },
                    { new Guid("10000000-0000-0000-0000-000000000005"), "SoilMoisture", 78m, 60m, 70m, "%" },
                    { new Guid("10000000-0000-0000-0000-000000000005"), "Temperature", 30m, 21m, 25m, "C" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_crop_varieties_created_by_user_id",
                table: "crop_varieties",
                column: "created_by_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_crop_varieties_crop_id_normalized_name",
                table: "crop_varieties",
                columns: new[] { "crop_id", "normalized_name" },
                unique: true,
                filter: "tenant_id IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_crop_varieties_crop_id_tenant_id_normalized_name",
                table: "crop_varieties",
                columns: new[] { "crop_id", "tenant_id", "normalized_name" },
                unique: true,
                filter: "tenant_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_crop_varieties_tenant_id",
                table: "crop_varieties",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_crops_created_by_user_id",
                table: "crops",
                column: "created_by_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_crops_normalized_name",
                table: "crops",
                column: "normalized_name",
                unique: true,
                filter: "tenant_id IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_crops_tenant_id_normalized_name",
                table: "crops",
                columns: new[] { "tenant_id", "normalized_name" },
                unique: true,
                filter: "tenant_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_growth_profiles_created_by_user_id",
                table: "growth_profiles",
                column: "created_by_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_growth_profiles_crop_id_variety_id_tenant_id_normalized_name",
                table: "growth_profiles",
                columns: new[] { "crop_id", "variety_id", "tenant_id", "normalized_name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_growth_profiles_source_profile_id",
                table: "growth_profiles",
                column: "source_profile_id");

            migrationBuilder.CreateIndex(
                name: "IX_growth_profiles_tenant_id",
                table: "growth_profiles",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_growth_profiles_variety_id",
                table: "growth_profiles",
                column: "variety_id");

            migrationBuilder.CreateIndex(
                name: "IX_growth_stages_growth_profile_id_name",
                table: "growth_stages",
                columns: new[] { "growth_profile_id", "name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_growth_stages_growth_profile_id_stage_order",
                table: "growth_stages",
                columns: new[] { "growth_profile_id", "stage_order" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_planting_seasons_crop_id",
                table: "planting_seasons",
                column: "crop_id");

            migrationBuilder.CreateIndex(
                name: "IX_planting_seasons_current_growth_stage_id",
                table: "planting_seasons",
                column: "current_growth_stage_id");

            migrationBuilder.CreateIndex(
                name: "IX_planting_seasons_growth_profile_id",
                table: "planting_seasons",
                column: "growth_profile_id");

            migrationBuilder.CreateIndex(
                name: "IX_planting_seasons_variety_id",
                table: "planting_seasons",
                column: "variety_id");

            migrationBuilder.CreateIndex(
                name: "IX_planting_seasons_zone_id",
                table: "planting_seasons",
                column: "zone_id",
                unique: true,
                filter: "status = 'InProgress'");

            migrationBuilder.CreateIndex(
                name: "IX_season_stage_transitions_changed_by_user_id",
                table: "season_stage_transitions",
                column: "changed_by_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_season_stage_transitions_current_growth_stage_id",
                table: "season_stage_transitions",
                column: "current_growth_stage_id");

            migrationBuilder.CreateIndex(
                name: "IX_season_stage_transitions_planting_season_id",
                table: "season_stage_transitions",
                column: "planting_season_id");

            migrationBuilder.CreateIndex(
                name: "IX_season_stage_transitions_previous_growth_stage_id",
                table: "season_stage_transitions",
                column: "previous_growth_stage_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "environmental_requirements");

            migrationBuilder.DropTable(
                name: "season_applied_requirements");

            migrationBuilder.DropTable(
                name: "season_stage_transitions");

            migrationBuilder.DropTable(
                name: "planting_seasons");

            migrationBuilder.DropTable(
                name: "growth_stages");

            migrationBuilder.DropTable(
                name: "growth_profiles");

            migrationBuilder.DropTable(
                name: "crop_varieties");

            migrationBuilder.DropTable(
                name: "crops");
        }
    }
}
