using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AiAdvisoryRecommendations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ai_consultation_requests",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    farm_id = table.Column<Guid>(type: "uuid", nullable: false),
                    zone_id = table.Column<Guid>(type: "uuid", nullable: false),
                    requested_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    parent_recommendation_id = table.Column<Guid>(type: "uuid", nullable: true),
                    question = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    context_snapshot = table.Column<string>(type: "jsonb", nullable: false),
                    missing_data_csv = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    provider_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    completed_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    hidden_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ai_consultation_requests", x => x.id);
                    table.ForeignKey(
                        name: "FK_ai_consultation_requests_app_users_requested_by_user_id",
                        column: x => x.requested_by_user_id,
                        principalTable: "app_users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ai_consultation_requests_farms_farm_id",
                        column: x => x.farm_id,
                        principalTable: "farms",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ai_consultation_requests_tenants_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ai_consultation_requests_zones_zone_id",
                        column: x => x.zone_id,
                        principalTable: "zones",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ai_recommendations",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    consultation_request_id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    farm_id = table.Column<Guid>(type: "uuid", nullable: false),
                    zone_id = table.Column<Guid>(type: "uuid", nullable: false),
                    growth_stage_id = table.Column<Guid>(type: "uuid", nullable: true),
                    summary = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    details = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    limitations = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    confidence = table.Column<decimal>(type: "numeric(5,4)", precision: 5, scale: 4, nullable: false),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    is_actionable = table.Column<bool>(type: "boolean", nullable: false),
                    valid_until_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    proposed_actuator_id = table.Column<Guid>(type: "uuid", nullable: true),
                    proposed_action = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    proposed_duration_seconds = table.Column<int>(type: "integer", nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ai_recommendations", x => x.id);
                    table.CheckConstraint("ck_ai_recommendation_confidence", "confidence BETWEEN 0 AND 1");
                    table.ForeignKey(
                        name: "FK_ai_recommendations_ai_consultation_requests_consultation_re~",
                        column: x => x.consultation_request_id,
                        principalTable: "ai_consultation_requests",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ai_recommendations_device_actuators_proposed_actuator_id",
                        column: x => x.proposed_actuator_id,
                        principalTable: "device_actuators",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ai_recommendations_farms_farm_id",
                        column: x => x.farm_id,
                        principalTable: "farms",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ai_recommendations_growth_stages_growth_stage_id",
                        column: x => x.growth_stage_id,
                        principalTable: "growth_stages",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ai_recommendations_tenants_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ai_recommendations_zones_zone_id",
                        column: x => x.zone_id,
                        principalTable: "zones",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ai_recommendation_decisions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    recommendation_id = table.Column<Guid>(type: "uuid", nullable: false),
                    owner_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    decision_type = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    reason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    actuator_command_id = table.Column<Guid>(type: "uuid", nullable: true),
                    follow_up_consultation_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ai_recommendation_decisions", x => x.id);
                    table.ForeignKey(
                        name: "FK_ai_recommendation_decisions_actuator_commands_actuator_comm~",
                        column: x => x.actuator_command_id,
                        principalTable: "actuator_commands",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ai_recommendation_decisions_ai_consultation_requests_follow~",
                        column: x => x.follow_up_consultation_id,
                        principalTable: "ai_consultation_requests",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ai_recommendation_decisions_ai_recommendations_recommendati~",
                        column: x => x.recommendation_id,
                        principalTable: "ai_recommendations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ai_recommendation_decisions_app_users_owner_user_id",
                        column: x => x.owner_user_id,
                        principalTable: "app_users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_actuator_commands_recommendation_id",
                table: "actuator_commands",
                column: "recommendation_id");

            migrationBuilder.CreateIndex(
                name: "IX_ai_consultation_requests_farm_id",
                table: "ai_consultation_requests",
                column: "farm_id");

            migrationBuilder.CreateIndex(
                name: "IX_ai_consultation_requests_parent_recommendation_id",
                table: "ai_consultation_requests",
                column: "parent_recommendation_id");

            migrationBuilder.CreateIndex(
                name: "IX_ai_consultation_requests_requested_by_user_id_zone_id_creat~",
                table: "ai_consultation_requests",
                columns: new[] { "requested_by_user_id", "zone_id", "created_at_utc" });

            migrationBuilder.CreateIndex(
                name: "IX_ai_consultation_requests_tenant_id",
                table: "ai_consultation_requests",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_ai_consultation_requests_zone_id_hidden_at_utc_created_at_u~",
                table: "ai_consultation_requests",
                columns: new[] { "zone_id", "hidden_at_utc", "created_at_utc" });

            migrationBuilder.CreateIndex(
                name: "IX_ai_recommendation_decisions_actuator_command_id",
                table: "ai_recommendation_decisions",
                column: "actuator_command_id");

            migrationBuilder.CreateIndex(
                name: "IX_ai_recommendation_decisions_follow_up_consultation_id",
                table: "ai_recommendation_decisions",
                column: "follow_up_consultation_id");

            migrationBuilder.CreateIndex(
                name: "IX_ai_recommendation_decisions_owner_user_id",
                table: "ai_recommendation_decisions",
                column: "owner_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_ai_recommendation_decisions_recommendation_id",
                table: "ai_recommendation_decisions",
                column: "recommendation_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ai_recommendations_consultation_request_id",
                table: "ai_recommendations",
                column: "consultation_request_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ai_recommendations_farm_id",
                table: "ai_recommendations",
                column: "farm_id");

            migrationBuilder.CreateIndex(
                name: "IX_ai_recommendations_growth_stage_id",
                table: "ai_recommendations",
                column: "growth_stage_id");

            migrationBuilder.CreateIndex(
                name: "IX_ai_recommendations_proposed_actuator_id",
                table: "ai_recommendations",
                column: "proposed_actuator_id");

            migrationBuilder.CreateIndex(
                name: "IX_ai_recommendations_tenant_id",
                table: "ai_recommendations",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_ai_recommendations_zone_id_created_at_utc",
                table: "ai_recommendations",
                columns: new[] { "zone_id", "created_at_utc" });

            migrationBuilder.AddForeignKey(
                name: "FK_actuator_commands_ai_recommendations_recommendation_id",
                table: "actuator_commands",
                column: "recommendation_id",
                principalTable: "ai_recommendations",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ai_consultation_requests_ai_recommendations_parent_recommen~",
                table: "ai_consultation_requests",
                column: "parent_recommendation_id",
                principalTable: "ai_recommendations",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_actuator_commands_ai_recommendations_recommendation_id",
                table: "actuator_commands");

            migrationBuilder.DropForeignKey(
                name: "FK_ai_consultation_requests_ai_recommendations_parent_recommen~",
                table: "ai_consultation_requests");

            migrationBuilder.DropTable(
                name: "ai_recommendation_decisions");

            migrationBuilder.DropTable(
                name: "ai_recommendations");

            migrationBuilder.DropTable(
                name: "ai_consultation_requests");

            migrationBuilder.DropIndex(
                name: "IX_actuator_commands_recommendation_id",
                table: "actuator_commands");
        }
    }
}
