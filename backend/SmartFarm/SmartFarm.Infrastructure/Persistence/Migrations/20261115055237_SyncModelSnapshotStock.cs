using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Đồng bộ ModelSnapshot với model hiện tại (các migration viết tay từ 20261106 không có Designer nên snapshot bị cũ)
    /// và bổ sung các ràng buộc còn thiếu trong DB cho StockIns/StockOuts (+ Bills, ContractPackages, ZoneContracts).
    /// Mọi lệnh đều idempotent: bảng/cột đã được các migration viết tay tạo sẵn, nên KHÔNG tạo lại hay xóa cột nào.
    /// Khóa ngoại của Bills/ContractPackages/ZoneContracts thêm dạng NOT VALID (chỉ kiểm tra dòng mới) để không làm hỏng dữ liệu cũ.
    /// StockInDetails/StockOutDetails.InventoryItemId cố ý không có khóa ngoại (trỏ tới inventory_items hoặc PlatformHardwareItems).
    /// </summary>
    public partial class SyncModelSnapshotStock : Migration
    {
        private const string AddIndex = @"CREATE {1}INDEX IF NOT EXISTS ""{0}"" ON ""{2}"" ({3});";

        private static string Index(string name, string table, string columns, bool unique = false) =>
            string.Format(AddIndex, name, unique ? "UNIQUE " : "", table, columns);

        private static string Fk(string name, string table, string column, string principal, string principalColumn, string onDelete, bool notValid) =>
            $@"DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '{name}') THEN
        ALTER TABLE ""{table}"" ADD CONSTRAINT ""{name}"" FOREIGN KEY (""{column}"") REFERENCES ""{principal}"" (""{principalColumn}"") ON DELETE {onDelete}{(notValid ? " NOT VALID" : "")};
    END IF;
END $$;";

        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Model không có giá trị mặc định ở DB; EF luôn gửi Status/UnitPrice tường minh.
            migrationBuilder.Sql(@"ALTER TABLE ""StockIns"" ALTER COLUMN ""Status"" DROP DEFAULT;
ALTER TABLE ""StockInDetails"" ALTER COLUMN ""UnitPrice"" DROP DEFAULT;
ALTER TABLE ""StockOuts"" ALTER COLUMN ""Status"" DROP DEFAULT;");

            // ── StockIns / StockInDetails
            migrationBuilder.Sql(Index("IX_StockIns_TenantId_FarmId_StockInCode", "StockIns", @"""TenantId"", ""FarmId"", ""StockInCode""", unique: true));
            migrationBuilder.Sql(Index("IX_StockIns_FarmId", "StockIns", @"""FarmId"""));
            migrationBuilder.Sql(Index("IX_StockIns_CreatedByUserId", "StockIns", @"""CreatedByUserId"""));
            migrationBuilder.Sql(Index("IX_StockIns_ApprovedByUserId", "StockIns", @"""ApprovedByUserId"""));
            migrationBuilder.Sql(Index("IX_StockInDetails_StockInId", "StockInDetails", @"""StockInId"""));
            migrationBuilder.Sql(Index("IX_StockInDetails_InventoryItemId", "StockInDetails", @"""InventoryItemId"""));
            migrationBuilder.Sql(Fk("FK_StockIns_farms_FarmId", "StockIns", "FarmId", "farms", "id", "RESTRICT", false));
            migrationBuilder.Sql(Fk("FK_StockIns_app_users_CreatedByUserId", "StockIns", "CreatedByUserId", "app_users", "id", "RESTRICT", false));
            migrationBuilder.Sql(Fk("FK_StockIns_app_users_ApprovedByUserId", "StockIns", "ApprovedByUserId", "app_users", "id", "RESTRICT", false));

            // ── StockOuts / StockOutDetails
            migrationBuilder.Sql(Index("IX_StockOuts_TenantId_FarmId_StockOutCode", "StockOuts", @"""TenantId"", ""FarmId"", ""StockOutCode""", unique: true));
            migrationBuilder.Sql(Index("IX_StockOuts_FarmId", "StockOuts", @"""FarmId"""));
            migrationBuilder.Sql(Index("IX_StockOuts_ZoneId", "StockOuts", @"""ZoneId"""));
            migrationBuilder.Sql(Index("IX_StockOuts_CreatedByUserId", "StockOuts", @"""CreatedByUserId"""));
            migrationBuilder.Sql(Index("IX_StockOuts_ApprovedByUserId", "StockOuts", @"""ApprovedByUserId"""));
            migrationBuilder.Sql(Index("IX_StockOutDetails_StockOutId", "StockOutDetails", @"""StockOutId"""));
            migrationBuilder.Sql(Index("IX_StockOutDetails_InventoryItemId", "StockOutDetails", @"""InventoryItemId"""));
            migrationBuilder.Sql(Fk("FK_StockOuts_farms_FarmId", "StockOuts", "FarmId", "farms", "id", "RESTRICT", false));
            migrationBuilder.Sql(Fk("FK_StockOuts_zones_ZoneId", "StockOuts", "ZoneId", "zones", "id", "SET NULL", false));
            migrationBuilder.Sql(Fk("FK_StockOuts_app_users_CreatedByUserId", "StockOuts", "CreatedByUserId", "app_users", "id", "RESTRICT", false));
            migrationBuilder.Sql(Fk("FK_StockOuts_app_users_ApprovedByUserId", "StockOuts", "ApprovedByUserId", "app_users", "id", "RESTRICT", false));

            // ── Bills / ContractPackages / ZoneContracts (cùng đợt migration viết tay, thiếu index + FK)
            migrationBuilder.Sql(Index("IX_Bills_TenantId_BillCode", "Bills", @"""TenantId"", ""BillCode""", unique: true));
            migrationBuilder.Sql(Index("IX_Bills_ContractId", "Bills", @"""ContractId"""));
            migrationBuilder.Sql(Index("IX_Bills_CreatedByUserId", "Bills", @"""CreatedByUserId"""));
            migrationBuilder.Sql(Index("IX_ContractPackages_CreatedByUserId", "ContractPackages", @"""CreatedByUserId"""));
            migrationBuilder.Sql(Index("IX_ZoneContracts_ContractPackageId", "ZoneContracts", @"""ContractPackageId"""));
            migrationBuilder.Sql(Fk("FK_Bills_ZoneContracts_ContractId", "Bills", "ContractId", "ZoneContracts", "Id", "RESTRICT", true));
            migrationBuilder.Sql(Fk("FK_Bills_app_users_CreatedByUserId", "Bills", "CreatedByUserId", "app_users", "id", "RESTRICT", true));
            migrationBuilder.Sql(Fk("FK_ContractPackages_app_users_CreatedByUserId", "ContractPackages", "CreatedByUserId", "app_users", "id", "RESTRICT", true));
            migrationBuilder.Sql(Fk("FK_ZoneContracts_ContractPackages_ContractPackageId", "ZoneContracts", "ContractPackageId", "ContractPackages", "Id", "SET NULL", true));
            migrationBuilder.Sql(Fk("FK_ZoneContracts_ZoneContracts_ParentContractId", "ZoneContracts", "ParentContractId", "ZoneContracts", "Id", "RESTRICT", true));
            migrationBuilder.Sql(Fk("FK_ZoneContracts_farms_FarmId", "ZoneContracts", "FarmId", "farms", "id", "RESTRICT", true));
            migrationBuilder.Sql(Fk("FK_ZoneContracts_zones_ZoneId", "ZoneContracts", "ZoneId", "zones", "id", "RESTRICT", true));
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Chỉ gỡ các ràng buộc/index do migration này thêm; bảng và cột giữ nguyên.
            foreach (var (table, fk) in new[]
            {
                ("StockIns", "FK_StockIns_farms_FarmId"), ("StockIns", "FK_StockIns_app_users_CreatedByUserId"),
                ("StockIns", "FK_StockIns_app_users_ApprovedByUserId"), ("StockOuts", "FK_StockOuts_farms_FarmId"),
                ("StockOuts", "FK_StockOuts_zones_ZoneId"), ("StockOuts", "FK_StockOuts_app_users_CreatedByUserId"),
                ("StockOuts", "FK_StockOuts_app_users_ApprovedByUserId"), ("Bills", "FK_Bills_ZoneContracts_ContractId"),
                ("Bills", "FK_Bills_app_users_CreatedByUserId"), ("ContractPackages", "FK_ContractPackages_app_users_CreatedByUserId"),
                ("ZoneContracts", "FK_ZoneContracts_ContractPackages_ContractPackageId"),
                ("ZoneContracts", "FK_ZoneContracts_ZoneContracts_ParentContractId"),
                ("ZoneContracts", "FK_ZoneContracts_farms_FarmId"), ("ZoneContracts", "FK_ZoneContracts_zones_ZoneId"),
            })
            {
                migrationBuilder.Sql($@"ALTER TABLE ""{table}"" DROP CONSTRAINT IF EXISTS ""{fk}"";");
            }

            foreach (var ix in new[]
            {
                "IX_StockIns_TenantId_FarmId_StockInCode", "IX_StockIns_FarmId", "IX_StockIns_CreatedByUserId", "IX_StockIns_ApprovedByUserId",
                "IX_StockInDetails_StockInId", "IX_StockInDetails_InventoryItemId",
                "IX_StockOuts_TenantId_FarmId_StockOutCode", "IX_StockOuts_FarmId", "IX_StockOuts_ZoneId", "IX_StockOuts_CreatedByUserId",
                "IX_StockOuts_ApprovedByUserId", "IX_StockOutDetails_StockOutId", "IX_StockOutDetails_InventoryItemId",
                "IX_Bills_TenantId_BillCode", "IX_Bills_ContractId", "IX_Bills_CreatedByUserId",
                "IX_ContractPackages_CreatedByUserId", "IX_ZoneContracts_ContractPackageId",
            })
            {
                migrationBuilder.Sql($@"DROP INDEX IF EXISTS ""{ix}"";");
            }
        }
    }
}
