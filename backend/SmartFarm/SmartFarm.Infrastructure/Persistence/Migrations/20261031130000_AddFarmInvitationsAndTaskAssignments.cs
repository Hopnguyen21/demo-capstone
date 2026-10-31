using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFarmInvitationsAndTaskAssignments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "subject_farmer_id",
                table: "farm_task_history",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "farm_invitations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    farm_id = table.Column<Guid>(type: "uuid", nullable: false),
                    invited_by_owner_id = table.Column<Guid>(type: "uuid", nullable: false),
                    email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    normalized_email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    invitee_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    expires_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    responded_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    send_count = table.Column<int>(type: "integer", nullable: false),
                    last_sent_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_farm_invitations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_farm_invitations_app_users_invited_by_owner_id",
                        column: x => x.invited_by_owner_id,
                        principalTable: "app_users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_farm_invitations_farms_farm_id",
                        column: x => x.farm_id,
                        principalTable: "farms",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_farm_invitations_tenants_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "farm_task_assignments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    farm_task_id = table.Column<Guid>(type: "uuid", nullable: false),
                    farmer_id = table.Column<Guid>(type: "uuid", nullable: false),
                    assigned_by_owner_id = table.Column<Guid>(type: "uuid", nullable: false),
                    assigned_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    progress_percent = table.Column<int>(type: "integer", nullable: false),
                    progress_note = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
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
                    table.PrimaryKey("PK_farm_task_assignments", x => x.Id);
                    table.CheckConstraint("ck_farm_task_assignment_progress", "progress_percent BETWEEN 0 AND 100");
                    table.ForeignKey(
                        name: "FK_farm_task_assignments_app_users_assigned_by_owner_id",
                        column: x => x.assigned_by_owner_id,
                        principalTable: "app_users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_farm_task_assignments_app_users_farmer_id",
                        column: x => x.farmer_id,
                        principalTable: "app_users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_farm_task_assignments_farm_tasks_farm_task_id",
                        column: x => x.farm_task_id,
                        principalTable: "farm_tasks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_farm_invitations_farm_id_normalized_email",
                table: "farm_invitations",
                columns: new[] { "farm_id", "normalized_email" },
                unique: true,
                filter: "status = 'Pending'");

            migrationBuilder.CreateIndex(
                name: "IX_farm_invitations_farm_id_status",
                table: "farm_invitations",
                columns: new[] { "farm_id", "status" });

            migrationBuilder.CreateIndex(
                name: "IX_farm_invitations_invited_by_owner_id",
                table: "farm_invitations",
                column: "invited_by_owner_id");

            migrationBuilder.CreateIndex(
                name: "IX_farm_invitations_normalized_email_status",
                table: "farm_invitations",
                columns: new[] { "normalized_email", "status" });

            migrationBuilder.CreateIndex(
                name: "IX_farm_invitations_tenant_id",
                table: "farm_invitations",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_farm_task_assignments_assigned_by_owner_id",
                table: "farm_task_assignments",
                column: "assigned_by_owner_id");

            migrationBuilder.CreateIndex(
                name: "IX_farm_task_assignments_farm_task_id_farmer_id",
                table: "farm_task_assignments",
                columns: new[] { "farm_task_id", "farmer_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_farm_task_assignments_farmer_id_status",
                table: "farm_task_assignments",
                columns: new[] { "farmer_id", "status" });

            // ── Chuyển dữ liệu công việc cũ (một Farmer/việc) sang phân công: không mất trạng thái, kết quả, thời điểm hay lịch sử ──
            migrationBuilder.Sql(@"
INSERT INTO farm_task_assignments (""Id"", farm_task_id, farmer_id, assigned_by_owner_id, assigned_at_utc, status, progress_percent, progress_note,
    result, failure_reason, accepted_at_utc, started_at_utc, submitted_at_utc, approved_at_utc, assignment_version, created_at_utc, updated_at_utc)
SELECT gen_random_uuid(), t.""Id"", t.assigned_farmer_id, t.created_by_owner_id, t.created_at_utc, t.status,
    CASE WHEN t.status IN ('CompletedPendingReview', 'Approved') THEN 100 ELSE 0 END, NULL,
    t.result, t.failure_reason, t.accepted_at_utc, t.started_at_utc, t.submitted_at_utc, t.approved_at_utc,
    GREATEST(t.assignment_version, 1), t.created_at_utc, t.updated_at_utc
FROM farm_tasks t;");

            // Mỗi sự kiện lịch sử gắn với Farmer mà nó nói tới: người được giao tại thời điểm đó (trước lần giao lại là người cũ).
            migrationBuilder.Sql(@"
UPDATE farm_task_history h
SET subject_farmer_id = COALESCE(
    h.new_assignee_id,
    (SELECT r.previous_assignee_id FROM farm_task_history r
        WHERE r.farm_task_id = h.farm_task_id AND r.event_type = 'Reassigned' AND r.created_at_utc > h.created_at_utc
        ORDER BY r.created_at_utc LIMIT 1),
    t.assigned_farmer_id)
FROM farm_tasks t
WHERE t.""Id"" = h.farm_task_id;");

            migrationBuilder.DropForeignKey(
                name: "FK_farm_tasks_app_users_assigned_farmer_id",
                table: "farm_tasks");

            migrationBuilder.DropIndex(
                name: "IX_farm_tasks_assigned_farmer_id",
                table: "farm_tasks");

            migrationBuilder.DropColumn(
                name: "accepted_at_utc",
                table: "farm_tasks");

            migrationBuilder.DropColumn(
                name: "approved_at_utc",
                table: "farm_tasks");

            migrationBuilder.DropColumn(
                name: "assigned_farmer_id",
                table: "farm_tasks");

            migrationBuilder.DropColumn(
                name: "assignment_version",
                table: "farm_tasks");

            migrationBuilder.DropColumn(
                name: "failure_reason",
                table: "farm_tasks");

            migrationBuilder.DropColumn(
                name: "result",
                table: "farm_tasks");

            migrationBuilder.DropColumn(
                name: "started_at_utc",
                table: "farm_tasks");

            migrationBuilder.DropColumn(
                name: "submitted_at_utc",
                table: "farm_tasks");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Khôi phục cột công việc đơn: lấy phân công sớm nhất làm Farmer chính (các phân công khác sẽ mất khi quay lui).
            migrationBuilder.AddColumn<Guid>(name: "assigned_farmer_id", table: "farm_tasks", type: "uuid", nullable: true);
            migrationBuilder.AddColumn<DateTime>(name: "accepted_at_utc", table: "farm_tasks", type: "timestamp with time zone", nullable: true);
            migrationBuilder.AddColumn<DateTime>(name: "approved_at_utc", table: "farm_tasks", type: "timestamp with time zone", nullable: true);
            migrationBuilder.AddColumn<int>(name: "assignment_version", table: "farm_tasks", type: "integer", nullable: false, defaultValue: 1);
            migrationBuilder.AddColumn<string>(name: "failure_reason", table: "farm_tasks", type: "character varying(2000)", maxLength: 2000, nullable: true);
            migrationBuilder.AddColumn<string>(name: "result", table: "farm_tasks", type: "character varying(2000)", maxLength: 2000, nullable: true);
            migrationBuilder.AddColumn<DateTime>(name: "started_at_utc", table: "farm_tasks", type: "timestamp with time zone", nullable: true);
            migrationBuilder.AddColumn<DateTime>(name: "submitted_at_utc", table: "farm_tasks", type: "timestamp with time zone", nullable: true);

            migrationBuilder.Sql(@"
UPDATE farm_tasks t
SET assigned_farmer_id = a.farmer_id, accepted_at_utc = a.accepted_at_utc, approved_at_utc = a.approved_at_utc, assignment_version = a.assignment_version,
    failure_reason = a.failure_reason, result = a.result, started_at_utc = a.started_at_utc, submitted_at_utc = a.submitted_at_utc
FROM (SELECT DISTINCT ON (farm_task_id) * FROM farm_task_assignments ORDER BY farm_task_id, assigned_at_utc) a
WHERE a.farm_task_id = t.""Id"";
UPDATE farm_tasks SET assigned_farmer_id = created_by_owner_id WHERE assigned_farmer_id IS NULL;");

            migrationBuilder.AlterColumn<Guid>(name: "assigned_farmer_id", table: "farm_tasks", type: "uuid", nullable: false, oldClrType: typeof(Guid), oldType: "uuid", oldNullable: true);

            migrationBuilder.DropTable(name: "farm_invitations");
            migrationBuilder.DropTable(name: "farm_task_assignments");
            migrationBuilder.DropColumn(name: "subject_farmer_id", table: "farm_task_history");

            migrationBuilder.CreateIndex(name: "IX_farm_tasks_assigned_farmer_id", table: "farm_tasks", column: "assigned_farmer_id");
            migrationBuilder.AddForeignKey(name: "FK_farm_tasks_app_users_assigned_farmer_id", table: "farm_tasks", column: "assigned_farmer_id",
                principalTable: "app_users", principalColumn: "id", onDelete: ReferentialAction.Restrict);
        }
    }
}
