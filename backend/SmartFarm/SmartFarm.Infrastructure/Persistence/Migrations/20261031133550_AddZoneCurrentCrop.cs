using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddZoneCurrentCrop : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "crop_id",
                table: "zones",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "crop_variety_id",
                table: "zones",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_zones_crop_id",
                table: "zones",
                column: "crop_id");

            migrationBuilder.CreateIndex(
                name: "IX_zones_crop_variety_id",
                table: "zones",
                column: "crop_variety_id");

            migrationBuilder.AddForeignKey(
                name: "FK_zones_crop_varieties_crop_variety_id",
                table: "zones",
                column: "crop_variety_id",
                principalTable: "crop_varieties",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_zones_crops_crop_id",
                table: "zones",
                column: "crop_id",
                principalTable: "crops",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            // Backfill an toàn: chỉ Zone có đúng một vụ InProgress mới lấy cây/giống từ vụ đó. Vụ Completed/Cancelled/Planned, tên Zone,
            // ghi chú và hợp đồng không phải căn cứ; các Zone còn lại giữ NULL để Owner tự chọn.
            migrationBuilder.Sql("""
                UPDATE zones z SET crop_id = s.crop_id, crop_variety_id = s.variety_id
                FROM planting_seasons s
                WHERE s.zone_id = z.id AND s.status = 'InProgress'
                  AND (SELECT COUNT(*) FROM planting_seasons x WHERE x.zone_id = z.id AND x.status = 'InProgress') = 1
                  AND z.crop_id IS NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_zones_crop_varieties_crop_variety_id",
                table: "zones");

            migrationBuilder.DropForeignKey(
                name: "FK_zones_crops_crop_id",
                table: "zones");

            migrationBuilder.DropIndex(
                name: "IX_zones_crop_id",
                table: "zones");

            migrationBuilder.DropIndex(
                name: "IX_zones_crop_variety_id",
                table: "zones");

            migrationBuilder.DropColumn(
                name: "crop_id",
                table: "zones");

            migrationBuilder.DropColumn(
                name: "crop_variety_id",
                table: "zones");
        }
    }
}
