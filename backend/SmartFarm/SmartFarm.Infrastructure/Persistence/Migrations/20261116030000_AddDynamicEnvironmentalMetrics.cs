using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using SmartFarm.Infrastructure.Persistence;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    [DbContext(typeof(SmartFarmDbContext))]
    [Migration("20261116030000_AddDynamicEnvironmentalMetrics")]
    public partial class AddDynamicEnvironmentalMetrics : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
-- 1. Bổ sung các cột mở rộng cho environmental_requirements
ALTER TABLE ""environmental_requirements"" ADD COLUMN IF NOT EXISTS ""metric_name"" character varying(150) NULL;
ALTER TABLE ""environmental_requirements"" ADD COLUMN IF NOT EXISTS ""description"" character varying(500) NULL;
ALTER TABLE ""environmental_requirements"" ADD COLUMN IF NOT EXISTS ""is_enabled"" boolean NOT NULL DEFAULT true;

-- 2. Bổ sung các cột mở rộng cho season_applied_requirements
ALTER TABLE ""season_applied_requirements"" ADD COLUMN IF NOT EXISTS ""metric_name"" character varying(150) NULL;
ALTER TABLE ""season_applied_requirements"" ADD COLUMN IF NOT EXISTS ""description"" character varying(500) NULL;
ALTER TABLE ""season_applied_requirements"" ADD COLUMN IF NOT EXISTS ""is_enabled"" boolean NOT NULL DEFAULT true;

-- 3. Tạo bảng environmental_metric_definitions
CREATE TABLE IF NOT EXISTS ""environmental_metric_definitions"" (
    ""id"" uuid NOT NULL PRIMARY KEY,
    ""metric_code"" character varying(50) NOT NULL,
    ""metric_name"" character varying(150) NOT NULL,
    ""unit"" character varying(30) NOT NULL,
    ""description"" character varying(500) NULL,
    ""default_min"" numeric(12,3) NOT NULL DEFAULT 0,
    ""default_target"" numeric(12,3) NOT NULL DEFAULT 0,
    ""default_max"" numeric(12,3) NOT NULL DEFAULT 0,
    ""has_sensor_support"" boolean NOT NULL DEFAULT false,
    ""is_system_defined"" boolean NOT NULL DEFAULT true,
    ""tenant_id"" uuid NULL,
    ""is_active"" boolean NOT NULL DEFAULT true,
    ""created_at_utc"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ""updated_at_utc"" timestamp with time zone NULL,
    CONSTRAINT ""FK_environmental_metric_definitions_tenants"" FOREIGN KEY (""tenant_id"") REFERENCES ""tenants"" (""id"") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS ""IX_env_metric_def_tenant_code"" 
ON ""environmental_metric_definitions"" (COALESCE(""tenant_id"", '00000000-0000-0000-0000-000000000000'::uuid), ""metric_code"");

-- 4. Seed 10 danh mục chỉ số mẫu
INSERT INTO ""environmental_metric_definitions"" 
(""id"", ""metric_code"", ""metric_name"", ""unit"", ""description"", ""default_min"", ""default_target"", ""default_max"", ""has_sensor_support"", ""is_system_defined"", ""tenant_id"", ""is_active"", ""created_at_utc"")
VALUES
    ('11111111-1111-1111-1111-111111111001', 'SoilMoisture', 'Độ ẩm đất', '%', 'Độ ẩm đất đo bằng cảm biến điện dung', 60.000, 70.000, 75.000, true, true, NULL, true, CURRENT_TIMESTAMP),
    ('11111111-1111-1111-1111-111111111002', 'Temperature', 'Nhiệt độ không khí', '°C', 'Nhiệt độ môi trường không khí nhà màng', 20.000, 24.000, 28.000, true, true, NULL, true, CURRENT_TIMESTAMP),
    ('11111111-1111-1111-1111-111111111003', 'AirHumidity', 'Độ ẩm không khí', '%', 'Độ ẩm tương đối của không khí', 60.000, 70.000, 80.000, true, true, NULL, true, CURRENT_TIMESTAMP),
    ('11111111-1111-1111-1111-111111111004', 'LightIntensity', 'Cường độ ánh sáng', 'Lux', 'Cường độ ánh sáng quang hợp', 1000.000, 3000.000, 5000.000, true, true, NULL, true, CURRENT_TIMESTAMP),
    ('11111111-1111-1111-1111-111111111005', 'Ph', 'Độ pH đất / dung dịch', 'pH', 'Độ chua pH của đất hoặc dung dịch tưới', 5.500, 6.000, 6.500, true, true, NULL, true, CURRENT_TIMESTAMP),
    ('11111111-1111-1111-1111-111111111006', 'Ec', 'Độ dẫn điện EC', 'mS/cm', 'Nồng độ dinh dưỡng và muối khoáng hòa tan', 1.200, 1.800, 2.500, true, true, NULL, true, CURRENT_TIMESTAMP),
    ('11111111-1111-1111-1111-111111111007', 'SoilTemperature', 'Nhiệt độ đất', '°C', 'Nhiệt độ vùng rễ cây', 18.000, 22.000, 26.000, true, true, NULL, true, CURRENT_TIMESTAMP),
    ('11111111-1111-1111-1111-111111111008', 'CO2', 'Nồng độ CO2', 'ppm', 'Nồng độ khí Carbon Dioxide trong nhà màng', 400.000, 800.000, 1200.000, false, true, NULL, true, CURRENT_TIMESTAMP),
    ('11111111-1111-1111-1111-111111111009', 'WIND_SPEED', 'Tốc độ gió', 'm/s', 'Tốc độ gió lưu thông trong nhà màng', 0.000, 2.000, 5.000, false, true, NULL, true, CURRENT_TIMESTAMP),
    ('11111111-1111-1111-1111-111111111010', 'WATER_FLOW', 'Lưu lượng nước tưới', 'L/h', 'Lưu lượng dòng chảy hệ thống tưới nhỏ giọt', 10.000, 50.000, 100.000, false, true, NULL, true, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

-- 5. Cập nhật metric_name cho các bản ghi seed cũ trong environmental_requirements
UPDATE ""environmental_requirements"" SET ""metric_name"" = 'Nhiệt độ không khí' WHERE ""parameter_code"" = 'Temperature' AND ""metric_name"" IS NULL;
UPDATE ""environmental_requirements"" SET ""metric_name"" = 'Độ ẩm đất' WHERE ""parameter_code"" = 'SoilMoisture' AND ""metric_name"" IS NULL;
UPDATE ""environmental_requirements"" SET ""metric_name"" = 'Độ ẩm không khí' WHERE ""parameter_code"" = 'AirHumidity' AND ""metric_name"" IS NULL;
UPDATE ""environmental_requirements"" SET ""metric_name"" = 'Độ pH đất' WHERE ""parameter_code"" = 'Ph' AND ""metric_name"" IS NULL;
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DROP TABLE IF EXISTS ""environmental_metric_definitions"";
ALTER TABLE ""environmental_requirements"" DROP COLUMN IF EXISTS ""metric_name"";
ALTER TABLE ""environmental_requirements"" DROP COLUMN IF EXISTS ""description"";
ALTER TABLE ""environmental_requirements"" DROP COLUMN IF EXISTS ""is_enabled"";
ALTER TABLE ""season_applied_requirements"" DROP COLUMN IF EXISTS ""metric_name"";
ALTER TABLE ""season_applied_requirements"" DROP COLUMN IF EXISTS ""description"";
ALTER TABLE ""season_applied_requirements"" DROP COLUMN IF EXISTS ""is_enabled"";
");
        }
    }
}
