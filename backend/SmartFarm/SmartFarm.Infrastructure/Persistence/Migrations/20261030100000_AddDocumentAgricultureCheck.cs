using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using SmartFarm.Infrastructure.Persistence;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Kết quả AI kiểm tra tài liệu có thuộc lĩnh vực nông nghiệp hay không (nhận định, trích dẫn, model, thời điểm).
    /// Cột nullable: tài liệu cũ không bị suy diễn. Các cột trích xuất kỹ thuật cũ được giữ để đọc dữ liệu cũ, không còn được ghi.
    /// </summary>
    [DbContext(typeof(SmartFarmDbContext))]
    [Migration("20261030100000_AddDocumentAgricultureCheck")]
    public partial class AddDocumentAgricultureCheck : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(name: "verification_status", table: "agriculture_documents", type: "character varying(30)", maxLength: 30, nullable: true);
            migrationBuilder.AddColumn<string>(name: "verification_result", table: "agriculture_documents", type: "text", nullable: true);
            migrationBuilder.AddColumn<DateTime>(name: "verification_attempted_at_utc", table: "agriculture_documents", type: "timestamp with time zone", nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "verification_attempted_at_utc", table: "agriculture_documents");
            migrationBuilder.DropColumn(name: "verification_result", table: "agriculture_documents");
            migrationBuilder.DropColumn(name: "verification_status", table: "agriculture_documents");
        }
    }
}
