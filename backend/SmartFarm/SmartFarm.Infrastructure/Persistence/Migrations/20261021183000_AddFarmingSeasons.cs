using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using SmartFarm.Infrastructure.Persistence;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    [DbContext(typeof(SmartFarmDbContext))]
    [Migration("20261021183000_AddFarmingSeasons")]
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
                        WHERE lower(table_name) = 'planting_seasons' AND lower(column_name) = 'farmingseasonid'
                    ) THEN
                        ALTER TABLE ""planting_seasons"" ADD COLUMN IF NOT EXISTS ""FarmingSeasonId"" uuid NULL;
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
