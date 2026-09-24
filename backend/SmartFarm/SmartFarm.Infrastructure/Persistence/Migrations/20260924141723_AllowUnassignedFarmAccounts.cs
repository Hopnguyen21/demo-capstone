using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AllowUnassignedFarmAccounts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_app_users_role_scope",
                table: "app_users");

            migrationBuilder.AddCheckConstraint(
                name: "ck_app_users_role_scope",
                table: "app_users",
                sql: "(role IN ('PlatformAdmin', 'PlatformTechnician') AND tenant_id IS NULL AND farm_id IS NULL) OR (role = 'FarmOwner' AND farm_id IS NULL) OR (role = 'Farmer' AND ((tenant_id IS NULL AND farm_id IS NULL) OR (tenant_id IS NOT NULL AND farm_id IS NOT NULL)))");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_app_users_role_scope",
                table: "app_users");

            migrationBuilder.AddCheckConstraint(
                name: "ck_app_users_role_scope",
                table: "app_users",
                sql: "(role IN ('PlatformAdmin', 'PlatformTechnician') AND tenant_id IS NULL AND farm_id IS NULL) OR (role = 'FarmOwner' AND tenant_id IS NOT NULL AND farm_id IS NULL) OR (role = 'Farmer' AND tenant_id IS NOT NULL AND farm_id IS NOT NULL)");
        }
    }
}
