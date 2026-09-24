using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class IoTServiceHandoffConstraints : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_service_requests_device_id",
                table: "service_requests",
                column: "device_id");

            migrationBuilder.CreateIndex(
                name: "IX_service_requests_farm_id",
                table: "service_requests",
                column: "farm_id");

            migrationBuilder.CreateIndex(
                name: "IX_service_requests_tenant_id",
                table: "service_requests",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_service_requests_zone_id",
                table: "service_requests",
                column: "zone_id");

            migrationBuilder.AddForeignKey(
                name: "FK_service_requests_deployment_requests_deployment_request_id",
                table: "service_requests",
                column: "deployment_request_id",
                principalTable: "deployment_requests",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_service_requests_devices_device_id",
                table: "service_requests",
                column: "device_id",
                principalTable: "devices",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_service_requests_farms_farm_id",
                table: "service_requests",
                column: "farm_id",
                principalTable: "farms",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_service_requests_tenants_tenant_id",
                table: "service_requests",
                column: "tenant_id",
                principalTable: "tenants",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_service_requests_zones_zone_id",
                table: "service_requests",
                column: "zone_id",
                principalTable: "zones",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_service_requests_deployment_requests_deployment_request_id",
                table: "service_requests");

            migrationBuilder.DropForeignKey(
                name: "FK_service_requests_devices_device_id",
                table: "service_requests");

            migrationBuilder.DropForeignKey(
                name: "FK_service_requests_farms_farm_id",
                table: "service_requests");

            migrationBuilder.DropForeignKey(
                name: "FK_service_requests_tenants_tenant_id",
                table: "service_requests");

            migrationBuilder.DropForeignKey(
                name: "FK_service_requests_zones_zone_id",
                table: "service_requests");

            migrationBuilder.DropIndex(
                name: "IX_service_requests_device_id",
                table: "service_requests");

            migrationBuilder.DropIndex(
                name: "IX_service_requests_farm_id",
                table: "service_requests");

            migrationBuilder.DropIndex(
                name: "IX_service_requests_tenant_id",
                table: "service_requests");

            migrationBuilder.DropIndex(
                name: "IX_service_requests_zone_id",
                table: "service_requests");
        }
    }
}
