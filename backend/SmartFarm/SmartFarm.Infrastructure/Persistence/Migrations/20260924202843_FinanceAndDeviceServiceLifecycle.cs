using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class FinanceAndDeviceServiceLifecycle : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "accepted_at_utc",
                table: "service_requests",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "assigned_technician_id",
                table: "service_requests",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "closed_at_utc",
                table: "service_requests",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "created_by_owner_id",
                table: "service_requests",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "current_device_id",
                table: "service_requests",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "diagnosis",
                table: "service_requests",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "inspection_notes",
                table: "service_requests",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "resolution_action",
                table: "service_requests",
                type: "character varying(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "work_performed",
                table: "service_requests",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "device_replacements",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    service_request_id = table.Column<Guid>(type: "uuid", nullable: false),
                    old_device_id = table.Column<Guid>(type: "uuid", nullable: false),
                    new_device_id = table.Column<Guid>(type: "uuid", nullable: false),
                    zone_id = table.Column<Guid>(type: "uuid", nullable: false),
                    technician_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_device_replacements", x => x.id);
                    table.ForeignKey(
                        name: "FK_device_replacements_app_users_technician_user_id",
                        column: x => x.technician_user_id,
                        principalTable: "app_users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_device_replacements_devices_new_device_id",
                        column: x => x.new_device_id,
                        principalTable: "devices",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_device_replacements_devices_old_device_id",
                        column: x => x.old_device_id,
                        principalTable: "devices",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_device_replacements_service_requests_service_request_id",
                        column: x => x.service_request_id,
                        principalTable: "service_requests",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_device_replacements_zones_zone_id",
                        column: x => x.zone_id,
                        principalTable: "zones",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "finance_transactions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    farm_id = table.Column<Guid>(type: "uuid", nullable: false),
                    transaction_type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    expense_category = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    occurred_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    reference = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    created_by_owner_id = table.Column<Guid>(type: "uuid", nullable: false),
                    archived_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_finance_transactions", x => x.id);
                    table.CheckConstraint("ck_finance_amount_positive", "amount > 0");
                    table.ForeignKey(
                        name: "FK_finance_transactions_app_users_created_by_owner_id",
                        column: x => x.created_by_owner_id,
                        principalTable: "app_users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_finance_transactions_farms_farm_id",
                        column: x => x.farm_id,
                        principalTable: "farms",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_finance_transactions_tenants_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "service_request_history",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    service_request_id = table.Column<Guid>(type: "uuid", nullable: false),
                    actor_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    event_type = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    from_status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    to_status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_service_request_history", x => x.id);
                    table.ForeignKey(
                        name: "FK_service_request_history_app_users_actor_user_id",
                        column: x => x.actor_user_id,
                        principalTable: "app_users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_service_request_history_service_requests_service_request_id",
                        column: x => x.service_request_id,
                        principalTable: "service_requests",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_service_requests_assigned_technician_id_status",
                table: "service_requests",
                columns: new[] { "assigned_technician_id", "status" });

            migrationBuilder.CreateIndex(
                name: "IX_service_requests_created_by_owner_id",
                table: "service_requests",
                column: "created_by_owner_id");

            migrationBuilder.CreateIndex(
                name: "IX_service_requests_current_device_id",
                table: "service_requests",
                column: "current_device_id");

            migrationBuilder.CreateIndex(
                name: "IX_device_replacements_new_device_id",
                table: "device_replacements",
                column: "new_device_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_device_replacements_old_device_id",
                table: "device_replacements",
                column: "old_device_id");

            migrationBuilder.CreateIndex(
                name: "IX_device_replacements_service_request_id",
                table: "device_replacements",
                column: "service_request_id");

            migrationBuilder.CreateIndex(
                name: "IX_device_replacements_technician_user_id",
                table: "device_replacements",
                column: "technician_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_device_replacements_zone_id",
                table: "device_replacements",
                column: "zone_id");

            migrationBuilder.CreateIndex(
                name: "IX_finance_transactions_created_by_owner_id",
                table: "finance_transactions",
                column: "created_by_owner_id");

            migrationBuilder.CreateIndex(
                name: "IX_finance_transactions_farm_id_occurred_at_utc",
                table: "finance_transactions",
                columns: new[] { "farm_id", "occurred_at_utc" });

            migrationBuilder.CreateIndex(
                name: "IX_finance_transactions_tenant_id",
                table: "finance_transactions",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_service_request_history_actor_user_id",
                table: "service_request_history",
                column: "actor_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_service_request_history_service_request_id_created_at_utc",
                table: "service_request_history",
                columns: new[] { "service_request_id", "created_at_utc" });

            migrationBuilder.AddForeignKey(
                name: "FK_service_requests_app_users_assigned_technician_id",
                table: "service_requests",
                column: "assigned_technician_id",
                principalTable: "app_users",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_service_requests_app_users_created_by_owner_id",
                table: "service_requests",
                column: "created_by_owner_id",
                principalTable: "app_users",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_service_requests_devices_current_device_id",
                table: "service_requests",
                column: "current_device_id",
                principalTable: "devices",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_service_requests_app_users_assigned_technician_id",
                table: "service_requests");

            migrationBuilder.DropForeignKey(
                name: "FK_service_requests_app_users_created_by_owner_id",
                table: "service_requests");

            migrationBuilder.DropForeignKey(
                name: "FK_service_requests_devices_current_device_id",
                table: "service_requests");

            migrationBuilder.DropTable(
                name: "device_replacements");

            migrationBuilder.DropTable(
                name: "finance_transactions");

            migrationBuilder.DropTable(
                name: "service_request_history");

            migrationBuilder.DropIndex(
                name: "IX_service_requests_assigned_technician_id_status",
                table: "service_requests");

            migrationBuilder.DropIndex(
                name: "IX_service_requests_created_by_owner_id",
                table: "service_requests");

            migrationBuilder.DropIndex(
                name: "IX_service_requests_current_device_id",
                table: "service_requests");

            migrationBuilder.DropColumn(
                name: "accepted_at_utc",
                table: "service_requests");

            migrationBuilder.DropColumn(
                name: "assigned_technician_id",
                table: "service_requests");

            migrationBuilder.DropColumn(
                name: "closed_at_utc",
                table: "service_requests");

            migrationBuilder.DropColumn(
                name: "created_by_owner_id",
                table: "service_requests");

            migrationBuilder.DropColumn(
                name: "current_device_id",
                table: "service_requests");

            migrationBuilder.DropColumn(
                name: "diagnosis",
                table: "service_requests");

            migrationBuilder.DropColumn(
                name: "inspection_notes",
                table: "service_requests");

            migrationBuilder.DropColumn(
                name: "resolution_action",
                table: "service_requests");

            migrationBuilder.DropColumn(
                name: "work_performed",
                table: "service_requests");
        }
    }
}
