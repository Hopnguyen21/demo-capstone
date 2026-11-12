using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace SmartFarm.Infrastructure.Persistence.Migrations;

[DbContext(typeof(SmartFarmDbContext))]
[Migration("20261112010000_LinkWarehouseDeviceModels")]
public sealed class LinkWarehouseDeviceModels : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) =>
        migrationBuilder.AddColumn<Guid>(name: "DeviceModelDefinitionId", table: "PlatformHardwareItems", type: "uuid", nullable: true);
    protected override void Down(MigrationBuilder migrationBuilder) =>
        migrationBuilder.DropColumn(name: "DeviceModelDefinitionId", table: "PlatformHardwareItems");
}
