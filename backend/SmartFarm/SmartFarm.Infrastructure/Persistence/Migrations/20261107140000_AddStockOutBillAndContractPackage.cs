using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using SmartFarm.Infrastructure.Persistence;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    [DbContext(typeof(SmartFarmDbContext))]
    [Migration("20261107140000_AddStockOutBillAndContractPackage")]
    public partial class AddStockOutBillAndContractPackage : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
CREATE TABLE IF NOT EXISTS ""ContractPackages"" (
    ""Id"" uuid NOT NULL PRIMARY KEY,
    ""PackageName"" character varying(200) NOT NULL,
    ""Description"" character varying(2000) NULL,
    ""DurationMonths"" integer NOT NULL,
    ""MaxZones"" integer NOT NULL,
    ""Price"" numeric(18,2) NOT NULL,
    ""Currency"" character varying(10) NOT NULL DEFAULT 'VND',
    ""Status"" integer NOT NULL DEFAULT 0,
    ""CreatedByUserId"" uuid NOT NULL,
    ""CreatedAtUtc"" timestamp with time zone NOT NULL,
    ""UpdatedAtUtc"" timestamp with time zone NULL
);

ALTER TABLE ""ZoneContracts"" 
ADD COLUMN IF NOT EXISTS ""ContractPackageId"" uuid NULL;

CREATE TABLE IF NOT EXISTS ""StockOuts"" (
    ""Id"" uuid NOT NULL PRIMARY KEY,
    ""TenantId"" uuid NOT NULL,
    ""FarmId"" uuid NOT NULL,
    ""ZoneId"" uuid NULL,
    ""StockOutCode"" character varying(100) NOT NULL,
    ""Status"" integer NOT NULL DEFAULT 0,
    ""CreatedByUserId"" uuid NOT NULL,
    ""ApprovedByUserId"" uuid NULL,
    ""CompletedAtUtc"" timestamp with time zone NULL,
    ""Notes"" character varying(2000) NULL,
    ""CreatedAtUtc"" timestamp with time zone NOT NULL,
    ""UpdatedAtUtc"" timestamp with time zone NULL
);

CREATE TABLE IF NOT EXISTS ""StockOutDetails"" (
    ""Id"" uuid NOT NULL PRIMARY KEY,
    ""StockOutId"" uuid NOT NULL,
    ""InventoryItemId"" uuid NOT NULL,
    ""Quantity"" numeric(18,4) NOT NULL,
    ""Notes"" character varying(1000) NULL,
    ""CreatedAtUtc"" timestamp with time zone NOT NULL,
    ""UpdatedAtUtc"" timestamp with time zone NULL,
    CONSTRAINT ""FK_StockOutDetails_StockOuts_StockOutId"" FOREIGN KEY (""StockOutId"") REFERENCES ""StockOuts"" (""Id"") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ""Bills"" (
    ""Id"" uuid NOT NULL PRIMARY KEY,
    ""TenantId"" uuid NOT NULL,
    ""BillCode"" character varying(100) NOT NULL,
    ""ContractId"" uuid NOT NULL,
    ""CustomerTenantId"" uuid NULL,
    ""LesseeName"" character varying(200) NOT NULL,
    ""Amount"" numeric(18,2) NOT NULL,
    ""PaidAmount"" numeric(18,2) NOT NULL DEFAULT 0,
    ""RemainingAmount"" numeric(18,2) NOT NULL,
    ""Status"" integer NOT NULL DEFAULT 1,
    ""IssueDate"" date NOT NULL,
    ""DueDate"" date NOT NULL,
    ""PaidDate"" timestamp with time zone NULL,
    ""PaymentMethod"" character varying(100) NULL,
    ""Notes"" character varying(2000) NULL,
    ""CreatedByUserId"" uuid NOT NULL,
    ""CreatedAtUtc"" timestamp with time zone NOT NULL,
    ""UpdatedAtUtc"" timestamp with time zone NULL
);

-- (Không seed gói hợp đồng mẫu: gói do Admin tự tạo.)
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DROP TABLE IF EXISTS ""Bills"";
DROP TABLE IF EXISTS ""StockOutDetails"";
DROP TABLE IF EXISTS ""StockOuts"";
ALTER TABLE ""ZoneContracts"" DROP COLUMN IF EXISTS ""ContractPackageId"";
DROP TABLE IF EXISTS ""ContractPackages"";
");
        }
    }
}

