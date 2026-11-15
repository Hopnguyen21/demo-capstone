using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddStockOutContractLink : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ContractId",
                table: "StockOuts",
                type: "uuid",
                nullable: true);

            // Điền liên kết cho phiếu cũ: hợp đồng cùng Farm có MÃ nằm trong ghi chú phiếu (phiếu tự tạo lúc cọc ghi 'HĐ #<mã>').
            migrationBuilder.Sql(@"UPDATE ""StockOuts"" s SET ""ContractId"" = c.""Id""
FROM ""ZoneContracts"" c
WHERE s.""ContractId"" IS NULL AND c.""FarmId"" = s.""FarmId"" AND s.""Notes"" IS NOT NULL
  AND c.""ContractNumber"" <> '' AND position(c.""ContractNumber"" in s.""Notes"") > 0;");

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

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
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
    }
}
