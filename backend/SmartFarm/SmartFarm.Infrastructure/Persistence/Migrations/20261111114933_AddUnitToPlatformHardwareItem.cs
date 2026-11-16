using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations;

public partial class AddUnitToPlatformHardwareItem : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // This migration previously duplicated FirmwareReleaseRegistry.
        migrationBuilder.Sql("ALTER TABLE \"PlatformHardwareItems\" ADD COLUMN IF NOT EXISTS \"Unit\" text NOT NULL DEFAULT '';");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("ALTER TABLE \"PlatformHardwareItems\" DROP COLUMN IF EXISTS \"Unit\";");
    }
}
