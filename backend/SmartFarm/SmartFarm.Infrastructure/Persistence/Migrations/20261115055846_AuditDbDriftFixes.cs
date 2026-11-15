using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AuditDbDriftFixes : Migration
    {
        private static string Ix(string name, string table, string cols, bool unique = false) =>
            $@"CREATE {(unique ? "UNIQUE " : "")}INDEX IF NOT EXISTS ""{name}"" ON ""{table}"" ({cols});";

        private static string Fk(string name, string table, string col, string principal, string pcol, string onDelete) =>
            $@"DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '{name}') THEN
        ALTER TABLE ""{table}"" ADD CONSTRAINT ""{name}"" FOREIGN KEY (""{col}"") REFERENCES ""{principal}"" (""{pcol}"") ON DELETE {onDelete};
    END IF;
END $$;";

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ── Cột lệch so với model (migration ExpandCropAndProfileDescriptions bỏ qua vì cột đã có với độ dài 1000)
            migrationBuilder.Sql(@"ALTER TABLE growth_stages ALTER COLUMN fertilizer_action TYPE character varying(2000);
ALTER TABLE growth_stages ALTER COLUMN ipm_action TYPE character varying(2000);");

            // ── 3 gói hợp đồng mẫu được seed với người tạo = GUID rỗng (không tồn tại): gán cho Admin nền tảng nếu có
            migrationBuilder.Sql(@"UPDATE ""ContractPackages"" SET ""CreatedByUserId"" = (SELECT id FROM app_users WHERE role = 'PlatformAdmin' ORDER BY created_at_utc NULLS LAST LIMIT 1)
WHERE ""CreatedByUserId"" = '00000000-0000-0000-0000-000000000000' AND EXISTS (SELECT 1 FROM app_users WHERE role = 'PlatformAdmin');");

            // ── Index + khóa ngoại còn thiếu so với model (đã kiểm tra không có dòng mồ côi)
            migrationBuilder.Sql(Ix("IX_DeviceDepreciations_CreatedByOwnerId", "DeviceDepreciations", @"""CreatedByOwnerId"""));
            migrationBuilder.Sql(Ix("IX_DeviceDepreciations_DeviceId", "DeviceDepreciations", @"""DeviceId"""));
            migrationBuilder.Sql(Ix("IX_DeviceDepreciations_TenantId", "DeviceDepreciations", @"""TenantId"""));
            migrationBuilder.Sql(Ix("IX_DeviceDepreciations_ZoneId", "DeviceDepreciations", @"""ZoneId"""));
            migrationBuilder.Sql(Ix("IX_ZoneContractRenewals_ContractId", "ZoneContractRenewals", @"""ContractId"""));
            migrationBuilder.Sql(Ix("IX_ZoneContractRenewals_CreatedByOwnerId", "ZoneContractRenewals", @"""CreatedByOwnerId"""));
            migrationBuilder.Sql(Ix("IX_ZoneContracts_CreatedByOwnerId", "ZoneContracts", @"""CreatedByOwnerId"""));
            migrationBuilder.Sql(Ix("IX_ZoneContracts_FarmId", "ZoneContracts", @"""FarmId"""));
            migrationBuilder.Sql(Ix("IX_ZoneContracts_ParentContractId", "ZoneContracts", @"""ParentContractId"""));
            migrationBuilder.Sql(Ix("IX_ZoneContracts_TenantId", "ZoneContracts", @"""TenantId"""));
            migrationBuilder.Sql(Ix("IX_ZoneContracts_ZoneId", "ZoneContracts", @"""ZoneId"""));
            migrationBuilder.Sql(Ix("IX_FarmingSeasons_TenantId", "FarmingSeasons", @"""TenantId"""));
            migrationBuilder.Sql(Ix("IX_planting_seasons_FarmingSeasonId", "planting_seasons", @"""FarmingSeasonId"""));

            migrationBuilder.Sql(Fk("FK_DeviceDepreciations_app_users_CreatedByOwnerId", "DeviceDepreciations", "CreatedByOwnerId", "app_users", "id", "CASCADE"));
            migrationBuilder.Sql(Fk("FK_DeviceDepreciations_devices_DeviceId", "DeviceDepreciations", "DeviceId", "devices", "id", "CASCADE"));
            migrationBuilder.Sql(Fk("FK_DeviceDepreciations_tenants_TenantId", "DeviceDepreciations", "TenantId", "tenants", "id", "CASCADE"));
            migrationBuilder.Sql(Fk("FK_DeviceDepreciations_zones_ZoneId", "DeviceDepreciations", "ZoneId", "zones", "id", "CASCADE"));
            migrationBuilder.Sql(Fk("FK_ZoneContractRenewals_ZoneContracts_ContractId", "ZoneContractRenewals", "ContractId", "ZoneContracts", "Id", "CASCADE"));
            migrationBuilder.Sql(Fk("FK_ZoneContractRenewals_app_users_CreatedByOwnerId", "ZoneContractRenewals", "CreatedByOwnerId", "app_users", "id", "CASCADE"));
            migrationBuilder.Sql(Fk("FK_ZoneContracts_app_users_CreatedByOwnerId", "ZoneContracts", "CreatedByOwnerId", "app_users", "id", "CASCADE"));
            migrationBuilder.Sql(Fk("FK_ZoneContracts_tenants_TenantId", "ZoneContracts", "TenantId", "tenants", "id", "CASCADE"));
            migrationBuilder.Sql(Fk("FK_FarmingSeasons_tenants_TenantId", "FarmingSeasons", "TenantId", "tenants", "id", "NO ACTION"));
            migrationBuilder.Sql(Fk("FK_planting_seasons_FarmingSeasons_FarmingSeasonId", "planting_seasons", "FarmingSeasonId", "FarmingSeasons", "Id", "NO ACTION"));

            // ── Xác thực các khóa ngoại NOT VALID của migration trước khi không còn dòng mồ côi (nếu còn thì giữ NOT VALID)
            migrationBuilder.Sql(@"DO $$
DECLARE c record;
BEGIN
    FOR c IN SELECT conrelid::regclass AS tbl, conname FROM pg_constraint WHERE contype = 'f' AND NOT convalidated AND connamespace = 'public'::regnamespace LOOP
        BEGIN
            EXECUTE format('ALTER TABLE %s VALIDATE CONSTRAINT %I', c.tbl, c.conname);
        EXCEPTION WHEN foreign_key_violation THEN
            RAISE NOTICE 'Giữ NOT VALID: % (còn dòng mồ côi)', c.conname;
        END;
    END LOOP;
END $$;");

            migrationBuilder.AlterColumn<string>(
                name: "Status",
                table: "FarmingSeasons",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "Name",
                table: "FarmingSeasons",
                type: "character varying(250)",
                maxLength: 250,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "Code",
                table: "FarmingSeasons",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            foreach (var (table, fk) in new[]
            {
                ("DeviceDepreciations", "FK_DeviceDepreciations_app_users_CreatedByOwnerId"), ("DeviceDepreciations", "FK_DeviceDepreciations_devices_DeviceId"),
                ("DeviceDepreciations", "FK_DeviceDepreciations_tenants_TenantId"), ("DeviceDepreciations", "FK_DeviceDepreciations_zones_ZoneId"),
                ("ZoneContractRenewals", "FK_ZoneContractRenewals_ZoneContracts_ContractId"), ("ZoneContractRenewals", "FK_ZoneContractRenewals_app_users_CreatedByOwnerId"),
                ("ZoneContracts", "FK_ZoneContracts_app_users_CreatedByOwnerId"), ("ZoneContracts", "FK_ZoneContracts_tenants_TenantId"),
                ("FarmingSeasons", "FK_FarmingSeasons_tenants_TenantId"), ("planting_seasons", "FK_planting_seasons_FarmingSeasons_FarmingSeasonId"),
            })
                migrationBuilder.Sql($@"ALTER TABLE ""{table}"" DROP CONSTRAINT IF EXISTS ""{fk}"";");

            foreach (var ix in new[]
            {
                "IX_DeviceDepreciations_CreatedByOwnerId", "IX_DeviceDepreciations_DeviceId", "IX_DeviceDepreciations_TenantId", "IX_DeviceDepreciations_ZoneId",
                "IX_ZoneContractRenewals_ContractId", "IX_ZoneContractRenewals_CreatedByOwnerId", "IX_ZoneContracts_CreatedByOwnerId", "IX_ZoneContracts_FarmId",
                "IX_ZoneContracts_ParentContractId", "IX_ZoneContracts_TenantId", "IX_ZoneContracts_ZoneId", "IX_FarmingSeasons_TenantId", "IX_planting_seasons_FarmingSeasonId",
            })
                migrationBuilder.Sql($@"DROP INDEX IF EXISTS ""{ix}"";");
            // Không thu hẹp lại growth_stages (có thể mất dữ liệu) và không hoàn tác việc gán người tạo gói hợp đồng.

            migrationBuilder.AlterColumn<string>(
                name: "Status",
                table: "FarmingSeasons",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(50)",
                oldMaxLength: 50);

            migrationBuilder.AlterColumn<string>(
                name: "Name",
                table: "FarmingSeasons",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(250)",
                oldMaxLength: 250);

            migrationBuilder.AlterColumn<string>(
                name: "Code",
                table: "FarmingSeasons",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(100)",
                oldMaxLength: 100);
        }
    }
}
