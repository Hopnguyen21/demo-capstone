using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ActivateGatewayEnrollment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "GatewayId",
                table: "gateway_enrollments",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_gateway_enrollments_GatewayId",
                table: "gateway_enrollments",
                column: "GatewayId");

            migrationBuilder.AddForeignKey(
                name: "FK_gateway_enrollments_gateways_GatewayId",
                table: "gateway_enrollments",
                column: "GatewayId",
                principalTable: "gateways",
                principalColumn: "id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_gateway_enrollments_gateways_GatewayId",
                table: "gateway_enrollments");

            migrationBuilder.DropIndex(
                name: "IX_gateway_enrollments_GatewayId",
                table: "gateway_enrollments");

            migrationBuilder.DropColumn(
                name: "GatewayId",
                table: "gateway_enrollments");
        }
    }
}
