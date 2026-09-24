using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InventoryAndFarmTasks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "farm_tasks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    farm_id = table.Column<Guid>(type: "uuid", nullable: false),
                    zone_id = table.Column<Guid>(type: "uuid", nullable: false),
                    title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    requirements = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    due_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    assigned_farmer_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_by_owner_id = table.Column<Guid>(type: "uuid", nullable: false),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    result = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    failure_reason = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    accepted_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    started_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    submitted_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    approved_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    assignment_version = table.Column<int>(type: "integer", nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_farm_tasks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_farm_tasks_app_users_assigned_farmer_id",
                        column: x => x.assigned_farmer_id,
                        principalTable: "app_users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_farm_tasks_app_users_created_by_owner_id",
                        column: x => x.created_by_owner_id,
                        principalTable: "app_users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_farm_tasks_zones_zone_id",
                        column: x => x.zone_id,
                        principalTable: "zones",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "inventory_items",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    farm_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    normalized_name = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    material_type = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    unit = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    quantity_on_hand = table.Column<decimal>(type: "numeric(18,3)", precision: 18, scale: 3, nullable: false),
                    low_stock_threshold = table.Column<decimal>(type: "numeric(18,3)", precision: 18, scale: 3, nullable: false),
                    archived_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_inventory_items", x => x.Id);
                    table.CheckConstraint("ck_inventory_low_threshold", "low_stock_threshold >= 0");
                    table.CheckConstraint("ck_inventory_quantity", "quantity_on_hand >= 0");
                    table.ForeignKey(
                        name: "FK_inventory_items_farms_farm_id",
                        column: x => x.farm_id,
                        principalTable: "farms",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_inventory_items_tenants_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "farm_task_history",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    farm_task_id = table.Column<Guid>(type: "uuid", nullable: false),
                    actor_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    event_type = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    from_status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    to_status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    previous_assignee_id = table.Column<Guid>(type: "uuid", nullable: true),
                    new_assignee_id = table.Column<Guid>(type: "uuid", nullable: true),
                    notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_farm_task_history", x => x.Id);
                    table.ForeignKey(
                        name: "FK_farm_task_history_app_users_actor_user_id",
                        column: x => x.actor_user_id,
                        principalTable: "app_users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_farm_task_history_farm_tasks_farm_task_id",
                        column: x => x.farm_task_id,
                        principalTable: "farm_tasks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "inventory_transactions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    farm_id = table.Column<Guid>(type: "uuid", nullable: false),
                    inventory_item_id = table.Column<Guid>(type: "uuid", nullable: false),
                    movement_type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    quantity = table.Column<decimal>(type: "numeric(18,3)", precision: 18, scale: 3, nullable: false),
                    balance_after = table.Column<decimal>(type: "numeric(18,3)", precision: 18, scale: 3, nullable: false),
                    actor_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    zone_id = table.Column<Guid>(type: "uuid", nullable: true),
                    farm_task_id = table.Column<Guid>(type: "uuid", nullable: true),
                    notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_inventory_transactions", x => x.Id);
                    table.CheckConstraint("ck_inventory_transaction_quantity", "quantity > 0");
                    table.ForeignKey(
                        name: "FK_inventory_transactions_app_users_actor_user_id",
                        column: x => x.actor_user_id,
                        principalTable: "app_users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_inventory_transactions_farm_tasks_farm_task_id",
                        column: x => x.farm_task_id,
                        principalTable: "farm_tasks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_inventory_transactions_farms_farm_id",
                        column: x => x.farm_id,
                        principalTable: "farms",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_inventory_transactions_inventory_items_inventory_item_id",
                        column: x => x.inventory_item_id,
                        principalTable: "inventory_items",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_inventory_transactions_tenants_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_inventory_transactions_zones_zone_id",
                        column: x => x.zone_id,
                        principalTable: "zones",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "low_stock_alerts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    farm_id = table.Column<Guid>(type: "uuid", nullable: false),
                    inventory_item_id = table.Column<Guid>(type: "uuid", nullable: false),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    quantity_at_open = table.Column<decimal>(type: "numeric(18,3)", precision: 18, scale: 3, nullable: false),
                    opened_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    resolved_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_low_stock_alerts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_low_stock_alerts_farms_farm_id",
                        column: x => x.farm_id,
                        principalTable: "farms",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_low_stock_alerts_inventory_items_inventory_item_id",
                        column: x => x.inventory_item_id,
                        principalTable: "inventory_items",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_low_stock_alerts_tenants_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "material_requirement_links",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    inventory_item_id = table.Column<Guid>(type: "uuid", nullable: false),
                    crop_id = table.Column<Guid>(type: "uuid", nullable: true),
                    variety_id = table.Column<Guid>(type: "uuid", nullable: true),
                    growth_stage_id = table.Column<Guid>(type: "uuid", nullable: true),
                    recommended_quantity = table.Column<decimal>(type: "numeric(18,3)", precision: 18, scale: 3, nullable: true),
                    notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_material_requirement_links", x => x.Id);
                    table.CheckConstraint("ck_material_requirement_one_target", "(CASE WHEN crop_id IS NULL THEN 0 ELSE 1 END + CASE WHEN variety_id IS NULL THEN 0 ELSE 1 END + CASE WHEN growth_stage_id IS NULL THEN 0 ELSE 1 END) = 1");
                    table.ForeignKey(
                        name: "FK_material_requirement_links_crop_varieties_variety_id",
                        column: x => x.variety_id,
                        principalTable: "crop_varieties",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_material_requirement_links_crops_crop_id",
                        column: x => x.crop_id,
                        principalTable: "crops",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_material_requirement_links_growth_stages_growth_stage_id",
                        column: x => x.growth_stage_id,
                        principalTable: "growth_stages",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_material_requirement_links_inventory_items_inventory_item_id",
                        column: x => x.inventory_item_id,
                        principalTable: "inventory_items",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_farm_task_history_actor_user_id",
                table: "farm_task_history",
                column: "actor_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_farm_task_history_farm_task_id_created_at_utc",
                table: "farm_task_history",
                columns: new[] { "farm_task_id", "created_at_utc" });

            migrationBuilder.CreateIndex(
                name: "IX_farm_tasks_assigned_farmer_id",
                table: "farm_tasks",
                column: "assigned_farmer_id");

            migrationBuilder.CreateIndex(
                name: "IX_farm_tasks_created_by_owner_id",
                table: "farm_tasks",
                column: "created_by_owner_id");

            migrationBuilder.CreateIndex(
                name: "IX_farm_tasks_farm_id_status_due_at_utc",
                table: "farm_tasks",
                columns: new[] { "farm_id", "status", "due_at_utc" });

            migrationBuilder.CreateIndex(
                name: "IX_farm_tasks_zone_id",
                table: "farm_tasks",
                column: "zone_id");

            migrationBuilder.CreateIndex(
                name: "IX_inventory_items_farm_id_normalized_name",
                table: "inventory_items",
                columns: new[] { "farm_id", "normalized_name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_inventory_items_tenant_id",
                table: "inventory_items",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_inventory_transactions_actor_user_id",
                table: "inventory_transactions",
                column: "actor_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_inventory_transactions_farm_id",
                table: "inventory_transactions",
                column: "farm_id");

            migrationBuilder.CreateIndex(
                name: "IX_inventory_transactions_farm_task_id",
                table: "inventory_transactions",
                column: "farm_task_id");

            migrationBuilder.CreateIndex(
                name: "IX_inventory_transactions_inventory_item_id_created_at_utc",
                table: "inventory_transactions",
                columns: new[] { "inventory_item_id", "created_at_utc" });

            migrationBuilder.CreateIndex(
                name: "IX_inventory_transactions_tenant_id",
                table: "inventory_transactions",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_inventory_transactions_zone_id",
                table: "inventory_transactions",
                column: "zone_id");

            migrationBuilder.CreateIndex(
                name: "IX_low_stock_alerts_farm_id",
                table: "low_stock_alerts",
                column: "farm_id");

            migrationBuilder.CreateIndex(
                name: "IX_low_stock_alerts_inventory_item_id",
                table: "low_stock_alerts",
                column: "inventory_item_id",
                unique: true,
                filter: "status = 'Open'");

            migrationBuilder.CreateIndex(
                name: "IX_low_stock_alerts_tenant_id",
                table: "low_stock_alerts",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_material_requirement_links_crop_id",
                table: "material_requirement_links",
                column: "crop_id");

            migrationBuilder.CreateIndex(
                name: "IX_material_requirement_links_growth_stage_id",
                table: "material_requirement_links",
                column: "growth_stage_id");

            migrationBuilder.CreateIndex(
                name: "IX_material_requirement_links_inventory_item_id_crop_id_variet~",
                table: "material_requirement_links",
                columns: new[] { "inventory_item_id", "crop_id", "variety_id", "growth_stage_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_material_requirement_links_variety_id",
                table: "material_requirement_links",
                column: "variety_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "farm_task_history");

            migrationBuilder.DropTable(
                name: "inventory_transactions");

            migrationBuilder.DropTable(
                name: "low_stock_alerts");

            migrationBuilder.DropTable(
                name: "material_requirement_links");

            migrationBuilder.DropTable(
                name: "farm_tasks");

            migrationBuilder.DropTable(
                name: "inventory_items");
        }
    }
}
