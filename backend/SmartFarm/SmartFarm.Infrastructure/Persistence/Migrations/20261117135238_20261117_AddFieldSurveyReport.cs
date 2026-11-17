using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class _20261117_AddFieldSurveyReport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "FieldSurveyReports",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FarmId = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceRequestId = table.Column<Guid>(type: "uuid", nullable: true),
                    ZoneId = table.Column<Guid>(type: "uuid", nullable: true),
                    Title = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    SurveyDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Location = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    SurveyorName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    RepresentativeName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    FarmOverview = table.Column<string>(type: "text", nullable: false),
                    CropAndSeasonStatus = table.Column<string>(type: "text", nullable: false),
                    CultivationProcess = table.Column<string>(type: "text", nullable: false),
                    EnvironmentalMonitoring = table.Column<string>(type: "text", nullable: false),
                    EnvironmentalThresholdNeeds = table.Column<string>(type: "text", nullable: false),
                    EquipmentAndDataCollection = table.Column<string>(type: "text", nullable: false),
                    ManagementAndPermissions = table.Column<string>(type: "text", nullable: false),
                    DifficultiesAndNeeds = table.Column<string>(type: "text", nullable: false),
                    TeamAssessment = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false, defaultValue: "Submitted"),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FieldSurveyReports", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FieldSurveyReports_app_users_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "app_users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FieldSurveyReports_farms_FarmId",
                        column: x => x.FarmId,
                        principalTable: "farms",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FieldSurveyReports_service_requests_ServiceRequestId",
                        column: x => x.ServiceRequestId,
                        principalTable: "service_requests",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_FieldSurveyReports_tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "tenants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FieldSurveyReports_zones_ZoneId",
                        column: x => x.ZoneId,
                        principalTable: "zones",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FieldSurveyReports_CreatedByUserId",
                table: "FieldSurveyReports",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_FieldSurveyReports_FarmId",
                table: "FieldSurveyReports",
                column: "FarmId");

            migrationBuilder.CreateIndex(
                name: "IX_FieldSurveyReports_ServiceRequestId",
                table: "FieldSurveyReports",
                column: "ServiceRequestId");

            migrationBuilder.CreateIndex(
                name: "IX_FieldSurveyReports_SurveyDate",
                table: "FieldSurveyReports",
                column: "SurveyDate");

            migrationBuilder.CreateIndex(
                name: "IX_FieldSurveyReports_TenantId",
                table: "FieldSurveyReports",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_FieldSurveyReports_ZoneId",
                table: "FieldSurveyReports",
                column: "ZoneId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FieldSurveyReports");
        }
    }
}
