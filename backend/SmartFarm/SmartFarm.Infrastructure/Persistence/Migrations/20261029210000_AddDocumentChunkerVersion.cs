using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using SmartFarm.Infrastructure.Persistence;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Phiên bản bộ chia đoạn của từng tài liệu. Tài liệu cũ nhận 0 nên worker nền tự chia lại theo mục/trang/chủ đề
    /// (thay nút "Chia lại đoạn RAG" đã bỏ khỏi giao diện).
    /// </summary>
    [DbContext(typeof(SmartFarmDbContext))]
    [Migration("20261029210000_AddDocumentChunkerVersion")]
    public partial class AddDocumentChunkerVersion : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "chunker_version", table: "agriculture_documents", type: "integer", nullable: false, defaultValue: 0);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "chunker_version", table: "agriculture_documents");
        }
    }
}
