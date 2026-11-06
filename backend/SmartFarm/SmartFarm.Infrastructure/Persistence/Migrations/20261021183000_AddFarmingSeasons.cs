using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFarmingSeasons : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS ""FarmingSeasons"" (
                    ""Id"" uuid NOT NULL PRIMARY KEY,
                    ""TenantId"" uuid NULL,
                    ""Code"" character varying(100) NOT NULL,
                    ""Name"" character varying(250) NOT NULL,
                    ""Year"" integer NOT NULL,
                    ""StartDate"" date NOT NULL,
                    ""EndDate"" date NOT NULL,
                    ""Description"" text NULL,
                    ""Status"" character varying(50) NOT NULL DEFAULT 'Active',
                    ""IsActive"" boolean NOT NULL DEFAULT TRUE,
                    ""CreatedAtUtc"" timestamp with time zone NOT NULL DEFAULT NOW(),
                    ""UpdatedAtUtc"" timestamp with time zone NULL
                );

                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'PlantingSeasons' AND column_name = 'FarmingSeasonId'
                    ) THEN
                        ALTER TABLE ""PlantingSeasons"" ADD COLUMN ""FarmingSeasonId"" uuid NULL;
                    END IF;
                END $$;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                DROP TABLE IF EXISTS ""FarmingSeasons"";
            ");
        }
    }
}
