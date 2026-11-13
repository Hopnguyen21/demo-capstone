using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace SmartFarm.Infrastructure.Persistence.Migrations;

[DbContext(typeof(SmartFarmDbContext))]
[Migration("20261113204000_LinkSignedContractStockOutItems")]
public sealed class LinkSignedContractStockOutItems : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(@"
            UPDATE ""StockOutDetails""
            SET ""InventoryItemId"" = '75000000-0000-0000-0000-000000000003'::uuid
            WHERE ""StockOutId"" = 'a1000000-0000-0000-0000-000000000010'::uuid
              AND ""Notes"" LIKE '%SOIL_SENSOR%';

            UPDATE ""StockOutDetails""
            SET ""InventoryItemId"" = '75000000-0000-0000-0000-000000000004'::uuid
            WHERE ""StockOutId"" = 'a1000000-0000-0000-0000-000000000010'::uuid
              AND ""Notes"" LIKE '%AIR_SENSOR%';
        ");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
    }
}
