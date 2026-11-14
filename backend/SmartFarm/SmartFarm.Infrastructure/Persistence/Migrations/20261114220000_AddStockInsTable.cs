using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using SmartFarm.Infrastructure.Persistence;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    [DbContext(typeof(SmartFarmDbContext))]
    [Migration("20261114220000_AddStockInsTable")]
    public partial class AddStockInsTable : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
CREATE TABLE IF NOT EXISTS ""StockIns"" (
    ""Id"" uuid NOT NULL PRIMARY KEY,
    ""TenantId"" uuid NOT NULL,
    ""FarmId"" uuid NOT NULL,
    ""StockInCode"" character varying(100) NOT NULL,
    ""SupplierName"" character varying(200) NULL,
    ""Status"" integer NOT NULL DEFAULT 3,
    ""CreatedByUserId"" uuid NOT NULL,
    ""ApprovedByUserId"" uuid NULL,
    ""CompletedAtUtc"" timestamp with time zone NULL,
    ""Notes"" character varying(2000) NULL,
    ""CreatedAtUtc"" timestamp with time zone NOT NULL,
    ""UpdatedAtUtc"" timestamp with time zone NULL
);

CREATE TABLE IF NOT EXISTS ""StockInDetails"" (
    ""Id"" uuid NOT NULL PRIMARY KEY,
    ""StockInId"" uuid NOT NULL,
    ""InventoryItemId"" uuid NOT NULL,
    ""Quantity"" numeric(18,4) NOT NULL,
    ""UnitPrice"" numeric(18,2) NOT NULL DEFAULT 0,
    ""Notes"" character varying(1000) NULL,
    ""CreatedAtUtc"" timestamp with time zone NOT NULL,
    ""UpdatedAtUtc"" timestamp with time zone NULL,
    CONSTRAINT ""FK_StockInDetails_StockIns_StockInId"" FOREIGN KEY (""StockInId"") REFERENCES ""StockIns"" (""Id"") ON DELETE CASCADE
);
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DROP TABLE IF EXISTS ""StockInDetails"";
DROP TABLE IF EXISTS ""StockIns"";
");
        }
    }
}
