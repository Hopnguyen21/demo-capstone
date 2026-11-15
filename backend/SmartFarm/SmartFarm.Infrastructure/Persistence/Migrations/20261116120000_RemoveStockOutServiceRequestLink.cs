using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations;

/// <inheritdoc />
public partial class RemoveStockOutServiceRequestLink : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropForeignKey(
            name: "FK_StockOuts_service_requests_ServiceRequestId",
            table: "StockOuts");

        migrationBuilder.DropIndex(
            name: "IX_StockOuts_ServiceRequestId",
            table: "StockOuts");

        migrationBuilder.DropColumn(
            name: "ServiceRequestId",
            table: "StockOuts");
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<Guid>(
            name: "ServiceRequestId",
            table: "StockOuts",
            type: "uuid",
            nullable: true);

        migrationBuilder.CreateIndex(
            name: "IX_StockOuts_ServiceRequestId",
            table: "StockOuts",
            column: "ServiceRequestId");

        migrationBuilder.AddForeignKey(
            name: "FK_StockOuts_service_requests_ServiceRequestId",
            table: "StockOuts",
            column: "ServiceRequestId",
            principalTable: "service_requests",
            principalColumn: "id",
            onDelete: ReferentialAction.SetNull);
    }
}
