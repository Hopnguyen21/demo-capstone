using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using SmartFarm.Infrastructure.Persistence;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Mỗi tài liệu là một nguồn RAG riêng có metadata: chủ đề (tài liệu và từng đoạn), hash nội dung chống trùng,
    /// trạng thái trích xuất nền và liên kết phiên bản thay thế (DECISIONS #27).
    /// </summary>
    [DbContext(typeof(SmartFarmDbContext))]
    [Migration("20261029200000_AddDocumentTopicsHashAndVersioning")]
    public partial class AddDocumentTopicsHashAndVersioning : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "extraction_attempted_at_utc", table: "agriculture_documents", type: "timestamp with time zone", nullable: true);
            migrationBuilder.AddColumn<string>(
                name: "content_hash", table: "agriculture_documents", type: "character varying(64)", maxLength: 64, nullable: true);
            migrationBuilder.AddColumn<string>(
                name: "topics", table: "agriculture_documents", type: "character varying(300)", maxLength: 300, nullable: false, defaultValue: "");
            migrationBuilder.AddColumn<Guid>(
                name: "superseded_by_document_id", table: "agriculture_documents", type: "uuid", nullable: true);
            migrationBuilder.AddColumn<string>(
                name: "topic", table: "agriculture_knowledge_chunks", type: "character varying(30)", maxLength: 30, nullable: false, defaultValue: "general");

            migrationBuilder.CreateIndex(
                name: "IX_agriculture_documents_content_hash", table: "agriculture_documents", column: "content_hash");

            // Tài liệu đã trích xuất trước đây không cần worker chạy lại.
            migrationBuilder.Sql("UPDATE agriculture_documents SET extraction_attempted_at_utc = updated_at_utc WHERE structured_extraction IS NOT NULL;");
            // Chủ đề tài liệu cũ lấy từ Category (trừ 'general').
            migrationBuilder.Sql("UPDATE agriculture_documents SET topics = category WHERE category <> 'general';");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(name: "IX_agriculture_documents_content_hash", table: "agriculture_documents");
            migrationBuilder.DropColumn(name: "topic", table: "agriculture_knowledge_chunks");
            migrationBuilder.DropColumn(name: "superseded_by_document_id", table: "agriculture_documents");
            migrationBuilder.DropColumn(name: "topics", table: "agriculture_documents");
            migrationBuilder.DropColumn(name: "content_hash", table: "agriculture_documents");
            migrationBuilder.DropColumn(name: "extraction_attempted_at_utc", table: "agriculture_documents");
        }
    }
}
