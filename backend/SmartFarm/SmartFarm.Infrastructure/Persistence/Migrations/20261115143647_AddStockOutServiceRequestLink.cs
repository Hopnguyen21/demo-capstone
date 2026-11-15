using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddStockOutServiceRequestLink : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ServiceRequestId",
                table: "StockOuts",
                type: "uuid",
                nullable: true);

            // Điền liên kết cho phiếu cũ: phiếu → hợp đồng (HD-SR-<8 ký tự đầu id báo giá>) → báo giá → yêu cầu dịch vụ.
            migrationBuilder.Sql(@"UPDATE ""StockOuts"" s SET ""ServiceRequestId"" = q.""ServiceRequestId""
FROM ""ZoneContracts"" c, ""ServiceRequestQuotations"" q
WHERE s.""ServiceRequestId"" IS NULL AND s.""ContractId"" = c.""Id""
  AND c.""ContractNumber"" = 'HD-SR-' || upper(left(q.""Id""::text, 8))
  AND EXISTS (SELECT 1 FROM service_requests sr WHERE sr.id = q.""ServiceRequestId"");");

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

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
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
    }
}
