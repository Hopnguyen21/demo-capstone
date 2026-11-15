using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class DropStockOutContractLink : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_StockOuts_ZoneContracts_ContractId",
                table: "StockOuts");

            migrationBuilder.DropIndex(
                name: "IX_StockOuts_ContractId",
                table: "StockOuts");

            migrationBuilder.DropColumn(
                name: "ContractId",
                table: "StockOuts");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ContractId",
                table: "StockOuts",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_StockOuts_ContractId",
                table: "StockOuts",
                column: "ContractId");

            migrationBuilder.AddForeignKey(
                name: "FK_StockOuts_ZoneContracts_ContractId",
                table: "StockOuts",
                column: "ContractId",
                principalTable: "ZoneContracts",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }
    }
}
