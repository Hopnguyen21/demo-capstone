using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using SmartFarm.Infrastructure.Persistence;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    [DbContext(typeof(SmartFarmDbContext))]
    [Migration("20261116010000_AddDiscountCodeTable")]
    public partial class AddDiscountCodeTable : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
CREATE TABLE IF NOT EXISTS ""DiscountCodes"" (
    ""Id"" uuid NOT NULL PRIMARY KEY,
    ""Code"" character varying(50) NOT NULL,
    ""Description"" character varying(500) NOT NULL,
    ""DiscountType"" integer NOT NULL DEFAULT 1,
    ""DiscountValue"" numeric(18,2) NOT NULL,
    ""MinContractValue"" numeric(18,2) NOT NULL DEFAULT 0,
    ""MaxDiscountAmount"" numeric(18,2) NULL,
    ""StartDateUtc"" timestamp with time zone NULL,
    ""EndDateUtc"" timestamp with time zone NULL,
    ""UsageLimit"" integer NULL,
    ""UsedCount"" integer NOT NULL DEFAULT 0,
    ""IsActive"" boolean NOT NULL DEFAULT true,
    ""CreatedByUserId"" uuid NOT NULL,
    ""CreatedAtUtc"" timestamp with time zone NOT NULL,
    ""UpdatedAtUtc"" timestamp with time zone NULL,
    CONSTRAINT ""FK_DiscountCodes_app_users_CreatedByUserId"" FOREIGN KEY (""CreatedByUserId"") REFERENCES ""app_users"" (""id"") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS ""IX_DiscountCodes_Code"" ON ""DiscountCodes"" (""Code"");

-- Seed initial default discount codes created by Platform Admin
INSERT INTO ""DiscountCodes"" (""Id"", ""Code"", ""Description"", ""DiscountType"", ""DiscountValue"", ""MinContractValue"", ""MaxDiscountAmount"", ""UsageLimit"", ""UsedCount"", ""IsActive"", ""CreatedByUserId"", ""CreatedAtUtc"")
VALUES 
    ('d0000001-0000-0000-0000-000000000001', 'WELCOME10', 'Ưu đãi chào mừng thành viên mới - Giảm 10% cho HĐ từ 5 triệu', 1, 10.00, 5000000.00, 1500000.00, 100, 0, true, '20000000-0000-0000-0000-000000000003', CURRENT_TIMESTAMP),
    ('d0000001-0000-0000-0000-000000000002', 'VIETGAP15', 'Ưu đãi trang trại nông sản chuẩn VietGAP - Giảm 15% cho HĐ từ 15 triệu', 1, 15.00, 15000000.00, 3500000.00, 50, 0, true, '20000000-0000-0000-0000-000000000003', CURRENT_TIMESTAMP),
    ('d0000001-0000-0000-0000-000000000003', 'LORA500K', 'Hỗ trợ thiết bị LoRa diện rộng - Giảm ngay 500,000 đ cho HĐ từ 8 triệu', 2, 500000.00, 8000000.00, NULL, 200, 0, true, '20000000-0000-0000-0000-000000000003', CURRENT_TIMESTAMP),
    ('d0000001-0000-0000-0000-000000000004', 'COMBO20', 'Siêu chiết khấu gói hợp tác xã quy mô lớn - Giảm 20% cho HĐ từ 30 triệu', 1, 20.00, 30000000.00, 8000000.00, 30, 0, true, '20000000-0000-0000-0000-000000000003', CURRENT_TIMESTAMP)
ON CONFLICT (""Code"") DO NOTHING;
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"DROP TABLE IF EXISTS ""DiscountCodes"";");
        }
    }
}
