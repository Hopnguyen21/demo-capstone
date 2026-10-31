using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using SmartFarm.Infrastructure.Persistence;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Lưu kết quả nhận diện metadata từ nội dung tài liệu (giá trị, trạng thái, bằng chứng). Cột nullable:
    /// tài liệu cũ giữ nguyên metadata hiện có và không bị suy diễn lại.
    /// </summary>
    [DbContext(typeof(SmartFarmDbContext))]
    [Migration("20261030090000_AddDocumentMetadataDetection")]
    public partial class AddDocumentMetadataDetection : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "metadata_detection", table: "agriculture_documents", type: "text", nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "metadata_detection", table: "agriculture_documents");
        }
    }
}
