using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using SmartFarm.Infrastructure.Persistence;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// 1) Zone gắn trực tiếp Growth Profile (zones.growth_profile_id, nullable, FK RESTRICT, có chỉ mục), độc lập với PlantingSeason.
    /// 2) Lịch tưới thuộc Growth Profile theo giai đoạn (growth_stage_irrigation_sessions).
    /// Backfill: Zone cũ chỉ lấy hồ sơ từ vụ mùa khi hoàn toàn nhất quán (cùng cây, cùng giống, hồ sơ thuộc đúng Tenant);
    /// vụ mùa và hồ sơ của vụ KHÔNG bị đổi. Zone không khớp giữ growth_profile_id = NULL (chưa gắn hồ sơ) thay vì đoán.
    /// Viết tay có chủ đích (không dùng bản scaffold): snapshot cũ đã lệch với model nên scaffold sẽ kéo theo các thay đổi không liên quan.
    /// </summary>
    [DbContext(typeof(SmartFarmDbContext))]
    [Migration("20261110150053_AddZoneGrowthProfileAndStageIrrigation")]
    public partial class AddZoneGrowthProfileAndStageIrrigation : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "growth_profile_id",
                table: "zones",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "growth_stage_irrigation_sessions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    growth_stage_id = table.Column<Guid>(type: "uuid", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    title = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    start_time = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    duration_seconds = table.Column<int>(type: "integer", nullable: false),
                    enabled = table.Column<bool>(type: "boolean", nullable: false),
                    method = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    water_per_plant_ml = table.Column<int>(type: "integer", nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_growth_stage_irrigation_sessions", x => x.id);
                    table.CheckConstraint("ck_growth_stage_irrigation_duration", "duration_seconds BETWEEN 1 AND 1800");
                    table.CheckConstraint("ck_growth_stage_irrigation_water", "water_per_plant_ml IS NULL OR water_per_plant_ml >= 0");
                    table.ForeignKey(
                        name: "FK_growth_stage_irrigation_sessions_growth_stages_growth_stage~",
                        column: x => x.growth_stage_id,
                        principalTable: "growth_stages",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_zones_growth_profile_id",
                table: "zones",
                column: "growth_profile_id");

            migrationBuilder.CreateIndex(
                name: "IX_growth_stage_irrigation_sessions_growth_stage_id_sort_order",
                table: "growth_stage_irrigation_sessions",
                columns: new[] { "growth_stage_id", "sort_order" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_zones_growth_profiles_growth_profile_id",
                table: "zones",
                column: "growth_profile_id",
                principalTable: "growth_profiles",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            // Backfill: vụ InProgress ưu tiên, sau đó vụ Planned mới nhất. Chỉ khi cây + giống của Zone khớp hồ sơ và hồ sơ là
            // hồ sơ hệ thống hoặc của đúng Tenant sở hữu Zone.
            migrationBuilder.Sql(@"
UPDATE zones z
SET growth_profile_id = s.growth_profile_id
FROM (
    SELECT DISTINCT ON (ps.zone_id) ps.zone_id, ps.growth_profile_id
    FROM planting_seasons ps
    WHERE ps.status IN ('InProgress', 'Planned')
    ORDER BY ps.zone_id, (ps.status = 'InProgress') DESC, ps.start_date DESC, ps.created_at_utc DESC
) s
JOIN growth_profiles gp ON gp.id = s.growth_profile_id
WHERE z.id = s.zone_id
  AND z.growth_profile_id IS NULL
  AND z.crop_id IS NOT NULL
  AND gp.crop_id = z.crop_id
  AND gp.variety_id IS NOT DISTINCT FROM z.crop_variety_id
  AND (gp.tenant_id IS NULL OR gp.tenant_id = (
        SELECT fm.tenant_id FROM fields fl JOIN farms fm ON fm.id = fl.farm_id WHERE fl.id = z.field_id));");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Gỡ cột chỉ làm mất liên kết hồ sơ-Zone suy ra từ vụ mùa; vụ mùa, hồ sơ và lịch điều khiển không bị đụng tới.
            migrationBuilder.DropForeignKey(
                name: "FK_zones_growth_profiles_growth_profile_id",
                table: "zones");

            migrationBuilder.DropTable(
                name: "growth_stage_irrigation_sessions");

            migrationBuilder.DropIndex(
                name: "IX_zones_growth_profile_id",
                table: "zones");

            migrationBuilder.DropColumn(
                name: "growth_profile_id",
                table: "zones");
        }
    }
}
