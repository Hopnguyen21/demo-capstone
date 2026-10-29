using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using SmartFarm.Infrastructure.Persistence;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    [DbContext(typeof(SmartFarmDbContext))]
    [Migration("20261028163000_ExpandCropAndProfileDescriptions")]
    public partial class ExpandCropAndProfileDescriptions : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                -- 1. Nâng độ dài Description lên varchar(4000)
                ALTER TABLE crops ALTER COLUMN description TYPE character varying(4000);
                ALTER TABLE crop_varieties ALTER COLUMN description TYPE character varying(4000);
                ALTER TABLE growth_profiles ALTER COLUMN description TYPE character varying(4000);

                -- 2. Thêm cột description, fertilizer_action, ipm_action cho growth_stages
                ALTER TABLE growth_stages ADD COLUMN IF NOT EXISTS description character varying(4000);
                ALTER TABLE growth_stages ALTER COLUMN description TYPE character varying(4000);
                ALTER TABLE growth_stages ADD COLUMN IF NOT EXISTS fertilizer_action character varying(2000);
                ALTER TABLE growth_stages ADD COLUMN IF NOT EXISTS ipm_action character varying(2000);

                -- 3. Mở rộng bảng crops với các ngưỡng vi khí hậu & lịch tưới
                ALTER TABLE crops ADD COLUMN IF NOT EXISTS category character varying(100);
                ALTER TABLE crops ADD COLUMN IF NOT EXISTS growth_cycle_days integer;
                ALTER TABLE crops ADD COLUMN IF NOT EXISTS optimal_temperature_min numeric(5,2);
                ALTER TABLE crops ADD COLUMN IF NOT EXISTS optimal_temperature_max numeric(5,2);
                ALTER TABLE crops ADD COLUMN IF NOT EXISTS optimal_soil_moisture_min numeric(5,2);
                ALTER TABLE crops ADD COLUMN IF NOT EXISTS optimal_soil_moisture_max numeric(5,2);
                ALTER TABLE crops ADD COLUMN IF NOT EXISTS optimal_ph_min numeric(5,2);
                ALTER TABLE crops ADD COLUMN IF NOT EXISTS optimal_ph_max numeric(5,2);
                ALTER TABLE crops ADD COLUMN IF NOT EXISTS optimal_ec_min numeric(5,2);
                ALTER TABLE crops ADD COLUMN IF NOT EXISTS optimal_ec_max numeric(5,2);
                ALTER TABLE crops ADD COLUMN IF NOT EXISTS optimal_lux numeric(10,2);
                ALTER TABLE crops ADD COLUMN IF NOT EXISTS calendar_irrigation_plan text;
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                ALTER TABLE crops DROP COLUMN IF EXISTS category;
                ALTER TABLE crops DROP COLUMN IF EXISTS growth_cycle_days;
                ALTER TABLE crops DROP COLUMN IF EXISTS optimal_temperature_min;
                ALTER TABLE crops DROP COLUMN IF EXISTS optimal_temperature_max;
                ALTER TABLE crops DROP COLUMN IF EXISTS optimal_soil_moisture_min;
                ALTER TABLE crops DROP COLUMN IF EXISTS optimal_soil_moisture_max;
                ALTER TABLE crops DROP COLUMN IF EXISTS optimal_ph_min;
                ALTER TABLE crops DROP COLUMN IF EXISTS optimal_ph_max;
                ALTER TABLE crops DROP COLUMN IF EXISTS optimal_ec_min;
                ALTER TABLE crops DROP COLUMN IF EXISTS optimal_ec_max;
                ALTER TABLE crops DROP COLUMN IF EXISTS optimal_lux;
                ALTER TABLE crops DROP COLUMN IF EXISTS calendar_irrigation_plan;
            ");
        }
    }
}
