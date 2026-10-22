using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddRecommendationSourcesAndChunkStatus : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "sources_json",
                table: "ai_recommendations",
                type: "text",
                nullable: false,
                defaultValue: "[]");

            migrationBuilder.AddColumn<string>(
                name: "status",
                table: "agriculture_knowledge_chunks",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "Pending");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "sources_json",
                table: "ai_recommendations");

            migrationBuilder.DropColumn(
                name: "status",
                table: "agriculture_knowledge_chunks");
        }
    }
}
