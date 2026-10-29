using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using SmartFarm.Infrastructure.Persistence;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Trang/mục của từng chunk để trích nguồn tới mục (SRS 3.4), và index HNSW cho tìm kiếm cosine.
    /// Index chỉ tạo khi cột embedding thật sự là kiểu vector (máy chưa cài pgvector dùng cột text — xem AddAgricultureKnowledgeBase).
    /// </summary>
    [DbContext(typeof(SmartFarmDbContext))]
    [Migration("20261029190000_AddChunkMetadataAndVectorIndex")]
    public partial class AddChunkMetadataAndVectorIndex : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "page_number", table: "agriculture_knowledge_chunks", type: "integer", nullable: true);
            migrationBuilder.AddColumn<string>(
                name: "section_title", table: "agriculture_knowledge_chunks", type: "character varying(300)", maxLength: 300, nullable: true);

            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'agriculture_knowledge_chunks' AND column_name = 'embedding' AND udt_name = 'vector')
                    THEN
                        EXECUTE 'CREATE INDEX IF NOT EXISTS ix_agriculture_knowledge_chunks_embedding_hnsw
                                 ON agriculture_knowledge_chunks USING hnsw (embedding vector_cosine_ops)';
                    END IF;
                EXCEPTION WHEN others THEN
                    -- pgvector cũ (< 0.5) không có HNSW: tìm kiếm vẫn đúng, chỉ chậm hơn khi dữ liệu lớn.
                    RAISE NOTICE 'Skipping HNSW index: %', SQLERRM;
                END $$;
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_agriculture_knowledge_chunks_embedding_hnsw;");
            migrationBuilder.DropColumn(name: "section_title", table: "agriculture_knowledge_chunks");
            migrationBuilder.DropColumn(name: "page_number", table: "agriculture_knowledge_chunks");
        }
    }
}
