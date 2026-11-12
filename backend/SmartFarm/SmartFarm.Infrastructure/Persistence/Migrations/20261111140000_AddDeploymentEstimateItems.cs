using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using SmartFarm.Infrastructure.Persistence;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    /// <summary>Lưu dự toán thiết bị của Owner kèm yêu cầu triển khai. Chỉ thêm bảng mới, không đổi dữ liệu hiện có.</summary>
    [DbContext(typeof(SmartFarmDbContext))]
    [Migration("20261111140000_AddDeploymentEstimateItems")]
    public partial class AddDeploymentEstimateItems : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "deployment_estimate_items",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    deployment_request_id = table.Column<Guid>(type: "uuid", nullable: false),
                    hardware_item_id = table.Column<Guid>(type: "uuid", nullable: true),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    code = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    name = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    model = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    role = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    quantity = table.Column<int>(type: "integer", nullable: false),
                    unit_price = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_deployment_estimate_items", x => x.id);
                    table.CheckConstraint("ck_deployment_estimate_price", "unit_price >= 0");
                    table.CheckConstraint("ck_deployment_estimate_quantity", "quantity > 0");
                    table.ForeignKey(
                        name: "FK_deployment_estimate_items_deployment_requests_deployment_request_id",
                        column: x => x.deployment_request_id,
                        principalTable: "deployment_requests",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_deployment_estimate_items_deployment_request_id",
                table: "deployment_estimate_items",
                column: "deployment_request_id");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "deployment_estimate_items");
        }
    }
}
