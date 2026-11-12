using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using SmartFarm.Infrastructure.Persistence;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Lịch tưới tùy chỉnh theo NGÀY của vụ trồng (Zone + mùa vụ): kế hoạch (season_irrigation_plans, 1 dòng/vụ),
    /// các ngày có override (season_irrigation_days) và ca tưới của từng ngày (season_irrigation_sessions).
    /// Chỉ thêm bảng mới, không đụng dữ liệu cũ; lịch profile theo giai đoạn giữ nguyên làm lịch mẫu.
    /// Viết tay (cùng lý do như migration trước: snapshot cũ đã lệch với model nên scaffold kéo theo thay đổi không liên quan).
    /// </summary>
    [DbContext(typeof(SmartFarmDbContext))]
    [Migration("20261111090000_AddSeasonIrrigationCalendar")]
    public partial class AddSeasonIrrigationCalendar : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "season_irrigation_plans",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    planting_season_id = table.Column<Guid>(type: "uuid", nullable: false),
                    start_date_snapshot = table.Column<DateOnly>(type: "date", nullable: false),
                    total_days_snapshot = table.Column<int>(type: "integer", nullable: false),
                    growth_profile_id_snapshot = table.Column<Guid>(type: "uuid", nullable: false),
                    updated_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_season_irrigation_plans", x => x.id);
                    table.ForeignKey(
                        name: "FK_season_irrigation_plans_planting_seasons_planting_season_id",
                        column: x => x.planting_season_id,
                        principalTable: "planting_seasons",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "season_irrigation_days",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    season_irrigation_plan_id = table.Column<Guid>(type: "uuid", nullable: false),
                    day_number = table.Column<int>(type: "integer", nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_season_irrigation_days", x => x.id);
                    table.CheckConstraint("ck_season_irrigation_day_number", "day_number >= 1");
                    table.ForeignKey(
                        name: "FK_season_irrigation_days_season_irrigation_plans_season_irrig~",
                        column: x => x.season_irrigation_plan_id,
                        principalTable: "season_irrigation_plans",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "season_irrigation_sessions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    season_irrigation_day_id = table.Column<Guid>(type: "uuid", nullable: false),
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
                    table.PrimaryKey("PK_season_irrigation_sessions", x => x.id);
                    table.CheckConstraint("ck_season_irrigation_duration", "duration_seconds BETWEEN 1 AND 1800");
                    table.CheckConstraint("ck_season_irrigation_water", "water_per_plant_ml IS NULL OR water_per_plant_ml >= 0");
                    table.ForeignKey(
                        name: "FK_season_irrigation_sessions_season_irrigation_days_season_ir~",
                        column: x => x.season_irrigation_day_id,
                        principalTable: "season_irrigation_days",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_season_irrigation_plans_planting_season_id",
                table: "season_irrigation_plans",
                column: "planting_season_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_season_irrigation_days_season_irrigation_plan_id_day_number",
                table: "season_irrigation_days",
                columns: new[] { "season_irrigation_plan_id", "day_number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_season_irrigation_sessions_season_irrigation_day_id_sort_order",
                table: "season_irrigation_sessions",
                columns: new[] { "season_irrigation_day_id", "sort_order" },
                unique: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "season_irrigation_sessions");
            migrationBuilder.DropTable(name: "season_irrigation_days");
            migrationBuilder.DropTable(name: "season_irrigation_plans");
        }
    }
}
