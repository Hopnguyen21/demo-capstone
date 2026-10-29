using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using SmartFarm.Infrastructure.Persistence;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// AddAgricultureDocumentReview đặt mặc định Approved cho mọi tài liệu có sẵn, kể cả file người dùng tải lên
    /// chưa từng được ai duyệt. Đưa các tài liệu đó (không phải dữ liệu seed) về PendingReview để bị loại khỏi RAG
    /// cho đến khi có người duyệt thật. Chỉ thay đổi dữ liệu, không đổi schema.
    /// </summary>
    [DbContext(typeof(SmartFarmDbContext))]
    [Migration("20261029160000_ResetUnreviewedDocumentApprovals")]
    public partial class ResetUnreviewedDocumentApprovals : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE agriculture_documents
                SET review_status = 'PendingReview',
                    review_notes = '[Hệ thống] Tài liệu được tự động coi là đã duyệt khi nâng cấp nhưng chưa từng có người duyệt; cần đối chiếu và duyệt lại.'
                WHERE review_status = 'Approved'
                  AND reviewed_at_utc IS NULL
                  AND file_type <> 'seed';
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Không khôi phục: trạng thái "Approved" cũ không do người duyệt xác nhận.
        }
    }
}
