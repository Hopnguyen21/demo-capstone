using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class SyncDynamicEnvironmentalMetricsSnapshot : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
-- Đảm bảo độ rộng của cột parameter_code đạt 50 ký tự
ALTER TABLE ""environmental_requirements"" ALTER COLUMN ""parameter_code"" TYPE character varying(50);
ALTER TABLE ""season_applied_requirements"" ALTER COLUMN ""parameter_code"" TYPE character varying(50);

-- Đảm bảo các cột mở rộng tồn tại
ALTER TABLE ""environmental_requirements"" ADD COLUMN IF NOT EXISTS ""metric_name"" character varying(150) NULL;
ALTER TABLE ""environmental_requirements"" ADD COLUMN IF NOT EXISTS ""description"" character varying(500) NULL;
ALTER TABLE ""environmental_requirements"" ADD COLUMN IF NOT EXISTS ""is_enabled"" boolean NOT NULL DEFAULT true;

ALTER TABLE ""season_applied_requirements"" ADD COLUMN IF NOT EXISTS ""metric_name"" character varying(150) NULL;
ALTER TABLE ""season_applied_requirements"" ADD COLUMN IF NOT EXISTS ""description"" character varying(500) NULL;
ALTER TABLE ""season_applied_requirements"" ADD COLUMN IF NOT EXISTS ""is_enabled"" boolean NOT NULL DEFAULT true;
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("SELECT 1;");
        }
    }
}
