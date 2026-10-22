using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Pgvector;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddAgricultureKnowledgeBase : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') THEN
        CREATE EXTENSION IF NOT EXISTS vector;
    END IF;
END $$;");

            migrationBuilder.CreateTable(
                name: "agriculture_documents",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    title = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    file_name = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    file_type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "seed"),
                    content_text = table.Column<string>(type: "text", nullable: false),
                    author_organization = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    category = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false, defaultValue: "general"),
                    crop_scope = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false, defaultValue: ""),
                    version = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    is_public = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_agriculture_documents", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "agriculture_knowledge_chunks",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    document_id = table.Column<Guid>(type: "uuid", nullable: false),
                    chunk_index = table.Column<int>(type: "integer", nullable: false),
                    content = table.Column<string>(type: "text", nullable: false),
                    crop_tags = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false, defaultValue: ""),
                    keywords = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false, defaultValue: ""),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_agriculture_knowledge_chunks", x => x.id);
                    table.ForeignKey(
                        name: "FK_agriculture_knowledge_chunks_agriculture_documents_document~",
                        column: x => x.document_id,
                        principalTable: "agriculture_documents",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.Sql(@"
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vector') THEN
        EXECUTE 'ALTER TABLE agriculture_knowledge_chunks ADD COLUMN IF NOT EXISTS embedding vector(768);';
    ELSE
        EXECUTE 'ALTER TABLE agriculture_knowledge_chunks ADD COLUMN IF NOT EXISTS embedding text;';
    END IF;
END $$;");

            migrationBuilder.CreateIndex(
                name: "IX_agriculture_documents_category",
                table: "agriculture_documents",
                column: "category");

            migrationBuilder.CreateIndex(
                name: "IX_agriculture_documents_tenant_id_is_public",
                table: "agriculture_documents",
                columns: new[] { "tenant_id", "is_public" });

            migrationBuilder.CreateIndex(
                name: "IX_agriculture_knowledge_chunks_document_id",
                table: "agriculture_knowledge_chunks",
                column: "document_id");

            migrationBuilder.CreateIndex(
                name: "IX_agriculture_knowledge_chunks_document_id_chunk_index",
                table: "agriculture_knowledge_chunks",
                columns: new[] { "document_id", "chunk_index" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_planting_seasons_FarmingSeasons_FarmingSeasonId",
                table: "planting_seasons");

            migrationBuilder.DropTable(
                name: "agriculture_knowledge_chunks");

            migrationBuilder.DropTable(
                name: "FarmingSeasons");

            migrationBuilder.DropTable(
                name: "agriculture_documents");

            migrationBuilder.DropIndex(
                name: "IX_planting_seasons_FarmingSeasonId",
                table: "planting_seasons");

            migrationBuilder.DropColumn(
                name: "FarmingSeasonId",
                table: "planting_seasons");

            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:PostgresExtension:postgis", ",,")
                .OldAnnotation("Npgsql:PostgresExtension:postgis", ",,")
                .OldAnnotation("Npgsql:PostgresExtension:vector", ",,");
        }
    }
}
