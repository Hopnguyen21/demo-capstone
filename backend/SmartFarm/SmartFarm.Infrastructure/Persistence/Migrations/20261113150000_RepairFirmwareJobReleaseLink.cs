using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations;

public partial class RepairFirmwareJobReleaseLink : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("ALTER TABLE firmware_jobs ADD COLUMN IF NOT EXISTS firmware_release_id uuid;");
        migrationBuilder.Sql(@"
            UPDATE firmware_jobs f
            SET firmware_release_id = r.id
            FROM firmware_releases r
            WHERE f.firmware_release_id IS NULL
              AND r.version = f.target_version
              AND r.artifact_url = f.firmware_url;");
        // Jobs created before the release registry was introduced cannot be
        // safely retried because their artifact has no provenance/checksum.
        migrationBuilder.Sql("DELETE FROM firmware_jobs WHERE firmware_release_id IS NULL;");
        migrationBuilder.Sql("ALTER TABLE firmware_jobs ALTER COLUMN firmware_release_id SET NOT NULL;");
        migrationBuilder.Sql(@"
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'FK_firmware_jobs_firmware_releases_firmware_release_id'
                ) THEN
                    ALTER TABLE firmware_jobs
                    ADD CONSTRAINT ""FK_firmware_jobs_firmware_releases_firmware_release_id""
                    FOREIGN KEY (firmware_release_id) REFERENCES firmware_releases(id) ON DELETE RESTRICT;
                END IF;
            END $$;");
        migrationBuilder.Sql("CREATE INDEX IF NOT EXISTS \"IX_firmware_jobs_firmware_release_id\" ON firmware_jobs (firmware_release_id);");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("DROP INDEX IF EXISTS \"IX_firmware_jobs_firmware_release_id\";");
        migrationBuilder.Sql("ALTER TABLE firmware_jobs DROP CONSTRAINT IF EXISTS \"FK_firmware_jobs_firmware_releases_firmware_release_id\";");
        migrationBuilder.Sql("ALTER TABLE firmware_jobs DROP COLUMN IF EXISTS firmware_release_id;");
    }
}
