using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class PlatformFeatures : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsAcceptanceSigned",
                table: "service_requests",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsContractSigned",
                table: "service_requests",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsDepositPaid",
                table: "service_requests",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsFullyPaid",
                table: "service_requests",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "BatteryLevel",
                table: "devices",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "Rssi",
                table: "devices",
                type: "numeric",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "AuditLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ActorUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    ActorName = table.Column<string>(type: "text", nullable: false),
                    ActorRole = table.Column<string>(type: "text", nullable: false),
                    Action = table.Column<string>(type: "text", nullable: false),
                    EntityName = table.Column<string>(type: "text", nullable: false),
                    EntityId = table.Column<string>(type: "text", nullable: false),
                    IpAddress = table.Column<string>(type: "text", nullable: true),
                    UserAgent = table.Column<string>(type: "text", nullable: true),
                    Details = table.Column<string>(type: "text", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuditLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AuditLogs_app_users_ActorUserId",
                        column: x => x.ActorUserId,
                        principalTable: "app_users",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "PlatformHardwareItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "text", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Category = table.Column<string>(type: "text", nullable: false),
                    Model = table.Column<string>(type: "text", nullable: true),
                    Manufacturer = table.Column<string>(type: "text", nullable: true),
                    SerialNumber = table.Column<string>(type: "text", nullable: true),
                    MacAddress = table.Column<string>(type: "text", nullable: true),
                    QuantityInStock = table.Column<int>(type: "integer", nullable: false),
                    LocationRack = table.Column<string>(type: "text", nullable: true),
                    UnitPrice = table.Column<decimal>(type: "numeric", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    AssignedTechnicianId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlatformHardwareItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PlatformHardwareItems_app_users_AssignedTechnicianId",
                        column: x => x.AssignedTechnicianId,
                        principalTable: "app_users",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "PlatformSettings",
                columns: table => new
                {
                    Key = table.Column<string>(type: "text", nullable: false),
                    Value = table.Column<string>(type: "text", nullable: false),
                    Group = table.Column<string>(type: "text", nullable: false),
                    DataType = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    IsSecret = table.Column<bool>(type: "boolean", nullable: false),
                    UpdatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlatformSettings", x => x.Key);
                    table.ForeignKey(
                        name: "FK_PlatformSettings_app_users_UpdatedByUserId",
                        column: x => x.UpdatedByUserId,
                        principalTable: "app_users",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "ServiceRequestQuotations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceRequestId = table.Column<Guid>(type: "uuid", nullable: false),
                    TechnicianUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Subtotal = table.Column<decimal>(type: "numeric", nullable: false),
                    VatPercent = table.Column<decimal>(type: "numeric", nullable: false),
                    VatAmount = table.Column<decimal>(type: "numeric", nullable: false),
                    TotalAmount = table.Column<decimal>(type: "numeric", nullable: false),
                    Deposit30Percent = table.Column<decimal>(type: "numeric", nullable: false),
                    Remaining70Percent = table.Column<decimal>(type: "numeric", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    ContractTerms = table.Column<string>(type: "text", nullable: true),
                    Status = table.Column<string>(type: "text", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ServiceRequestQuotations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ServiceRequestQuotations_app_users_TechnicianUserId",
                        column: x => x.TechnicianUserId,
                        principalTable: "app_users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ServiceRequestQuotations_service_requests_ServiceRequestId",
                        column: x => x.ServiceRequestId,
                        principalTable: "service_requests",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ServiceRequestPayments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceRequestId = table.Column<Guid>(type: "uuid", nullable: false),
                    QuotationId = table.Column<Guid>(type: "uuid", nullable: true),
                    PaymentStage = table.Column<string>(type: "text", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric", nullable: false),
                    PaymentMethod = table.Column<string>(type: "text", nullable: false),
                    TransactionReference = table.Column<string>(type: "text", nullable: true),
                    SignerFullName = table.Column<string>(type: "text", nullable: false),
                    SignatureHash = table.Column<string>(type: "text", nullable: true),
                    Status = table.Column<string>(type: "text", nullable: false),
                    PaidAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ConfirmedByAdminId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ServiceRequestPayments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ServiceRequestPayments_ServiceRequestQuotations_QuotationId",
                        column: x => x.QuotationId,
                        principalTable: "ServiceRequestQuotations",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_ServiceRequestPayments_app_users_ConfirmedByAdminId",
                        column: x => x.ConfirmedByAdminId,
                        principalTable: "app_users",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "FK_ServiceRequestPayments_service_requests_ServiceRequestId",
                        column: x => x.ServiceRequestId,
                        principalTable: "service_requests",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ServiceRequestQuotationItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    QuotationId = table.Column<Guid>(type: "uuid", nullable: false),
                    HardwareItemCode = table.Column<string>(type: "text", nullable: false),
                    HardwareItemName = table.Column<string>(type: "text", nullable: false),
                    Category = table.Column<string>(type: "text", nullable: false),
                    Unit = table.Column<string>(type: "text", nullable: false),
                    Quantity = table.Column<int>(type: "integer", nullable: false),
                    UnitPrice = table.Column<decimal>(type: "numeric", nullable: false),
                    VatPercent = table.Column<decimal>(type: "numeric", nullable: false),
                    TotalAmount = table.Column<decimal>(type: "numeric", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ServiceRequestQuotationItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ServiceRequestQuotationItems_ServiceRequestQuotations_Quota~",
                        column: x => x.QuotationId,
                        principalTable: "ServiceRequestQuotations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_ActorUserId",
                table: "AuditLogs",
                column: "ActorUserId");

            migrationBuilder.CreateIndex(
                name: "IX_PlatformHardwareItems_AssignedTechnicianId",
                table: "PlatformHardwareItems",
                column: "AssignedTechnicianId");

            migrationBuilder.CreateIndex(
                name: "IX_PlatformSettings_UpdatedByUserId",
                table: "PlatformSettings",
                column: "UpdatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceRequestPayments_ConfirmedByAdminId",
                table: "ServiceRequestPayments",
                column: "ConfirmedByAdminId");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceRequestPayments_QuotationId",
                table: "ServiceRequestPayments",
                column: "QuotationId");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceRequestPayments_ServiceRequestId",
                table: "ServiceRequestPayments",
                column: "ServiceRequestId");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceRequestQuotationItems_QuotationId",
                table: "ServiceRequestQuotationItems",
                column: "QuotationId");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceRequestQuotations_ServiceRequestId",
                table: "ServiceRequestQuotations",
                column: "ServiceRequestId");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceRequestQuotations_TechnicianUserId",
                table: "ServiceRequestQuotations",
                column: "TechnicianUserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AuditLogs");

            migrationBuilder.DropTable(
                name: "PlatformHardwareItems");

            migrationBuilder.DropTable(
                name: "PlatformSettings");

            migrationBuilder.DropTable(
                name: "ServiceRequestPayments");

            migrationBuilder.DropTable(
                name: "ServiceRequestQuotationItems");

            migrationBuilder.DropTable(
                name: "ServiceRequestQuotations");

            migrationBuilder.DropColumn(
                name: "IsAcceptanceSigned",
                table: "service_requests");

            migrationBuilder.DropColumn(
                name: "IsContractSigned",
                table: "service_requests");

            migrationBuilder.DropColumn(
                name: "IsDepositPaid",
                table: "service_requests");

            migrationBuilder.DropColumn(
                name: "IsFullyPaid",
                table: "service_requests");

            migrationBuilder.DropColumn(
                name: "BatteryLevel",
                table: "devices");

            migrationBuilder.DropColumn(
                name: "Rssi",
                table: "devices");
        }
    }
}
