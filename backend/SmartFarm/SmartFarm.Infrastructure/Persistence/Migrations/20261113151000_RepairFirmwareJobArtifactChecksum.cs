using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations;

public partial class RepairFirmwareJobArtifactChecksum : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("ALTER TABLE firmware_jobs ADD COLUMN IF NOT EXISTS artifact_sha256 character varying(128);");
        migrationBuilder.Sql(@"
            UPDATE firmware_jobs f
            SET artifact_sha256 = r.artifact_sha256
            FROM firmware_releases r
            WHERE f.firmware_release_id = r.id
              AND f.artifact_sha256 IS NULL;");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("ALTER TABLE firmware_jobs DROP COLUMN IF EXISTS artifact_sha256;");
    }
}
