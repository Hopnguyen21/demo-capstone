using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace SmartFarm.Infrastructure.Persistence.Migrations;

/// <summary>
/// Thêm các cột của gói hợp đồng tùy chỉnh (IsCustom, TenantId, CustomerName, ContractId) mà entity ContractPackage đã có
/// nhưng chưa migration nào tạo. Thiếu các cột này, mọi truy vấn hợp đồng Zone có Include(ContractPackage) trả HTTP 500.
/// Idempotent để chạy được cả trên DB đã được vá tay.
/// </summary>
[DbContext(typeof(SmartFarmDbContext))]
[Migration("20261112183000_AddContractPackageCustomFields")]
public sealed class AddContractPackageCustomFields : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) =>
        migrationBuilder.Sql("""
            ALTER TABLE "ContractPackages" ADD COLUMN IF NOT EXISTS "IsCustom" boolean NOT NULL DEFAULT FALSE;
            ALTER TABLE "ContractPackages" ADD COLUMN IF NOT EXISTS "TenantId" uuid NULL;
            ALTER TABLE "ContractPackages" ADD COLUMN IF NOT EXISTS "CustomerName" character varying(200) NULL;
            ALTER TABLE "ContractPackages" ADD COLUMN IF NOT EXISTS "ContractId" uuid NULL;
            CREATE INDEX IF NOT EXISTS "IX_ContractPackages_TenantId" ON "ContractPackages" ("TenantId");
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_ContractPackages_tenants_TenantId') THEN
                    ALTER TABLE "ContractPackages"
                        ADD CONSTRAINT "FK_ContractPackages_tenants_TenantId"
                        FOREIGN KEY ("TenantId") REFERENCES tenants (id) ON DELETE SET NULL;
                END IF;
            END $$;
            """);

    protected override void Down(MigrationBuilder migrationBuilder) =>
        migrationBuilder.Sql("""
            ALTER TABLE "ContractPackages" DROP CONSTRAINT IF EXISTS "FK_ContractPackages_tenants_TenantId";
            DROP INDEX IF EXISTS "IX_ContractPackages_TenantId";
            ALTER TABLE "ContractPackages" DROP COLUMN IF EXISTS "ContractId";
            ALTER TABLE "ContractPackages" DROP COLUMN IF EXISTS "CustomerName";
            ALTER TABLE "ContractPackages" DROP COLUMN IF EXISTS "TenantId";
            ALTER TABLE "ContractPackages" DROP COLUMN IF EXISTS "IsCustom";
            """);
}
