using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pgvector;
using SmartFarm.Domain.Entities;

namespace SmartFarm.Infrastructure.Persistence.Configurations;

internal sealed class AgricultureDocumentConfiguration : IEntityTypeConfiguration<AgricultureDocument>
{
    public void Configure(EntityTypeBuilder<AgricultureDocument> b)
    {
        b.ToTable("agriculture_documents");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasColumnName("id");
        b.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc");
        b.Property(x => x.UpdatedAtUtc).HasColumnName("updated_at_utc");

        b.Property(x => x.Title).HasColumnName("title").HasMaxLength(300).IsRequired();
        b.Property(x => x.FileName).HasColumnName("file_name").HasMaxLength(500);
        b.Property(x => x.OriginalFileBytes).HasColumnName("original_file_bytes").HasColumnType("bytea");
        b.Property(x => x.OriginalFileContentType).HasColumnName("original_file_content_type").HasMaxLength(100);
        b.Property(x => x.FileType).HasColumnName("file_type").HasMaxLength(20).HasDefaultValue("seed");
        b.Property(x => x.ContentText).HasColumnName("content_text").HasColumnType("text").IsRequired();
        b.Property(x => x.AuthorOrganization).HasColumnName("author_organization").HasMaxLength(200);
        b.Property(x => x.Category).HasColumnName("category").HasMaxLength(50).HasDefaultValue("general");
        b.Property(x => x.CropScope).HasColumnName("crop_scope").HasMaxLength(500).HasDefaultValue(string.Empty);
        b.Property(x => x.Version).HasColumnName("version").HasMaxLength(50);
        b.Property(x => x.IsPublic).HasColumnName("is_public").HasDefaultValue(true);
        b.Property(x => x.ReviewStatus).HasColumnName("review_status")
            .HasConversion<string>().HasMaxLength(30).HasDefaultValue(AgricultureDocumentReviewStatus.Approved);
        b.Property(x => x.ReviewNotes).HasColumnName("review_notes").HasMaxLength(2000);
        b.Property(x => x.DocumentType).HasColumnName("document_type")
            .HasConversion<string>().HasMaxLength(30).HasDefaultValue(AgricultureDocumentType.OfficialStandard);
        b.Property(x => x.ReviewedAtUtc).HasColumnName("reviewed_at_utc");
        b.Property(x => x.MetadataDetectionJson).HasColumnName("metadata_detection").HasColumnType("text");
        b.Property(x => x.VerificationStatus).HasColumnName("verification_status").HasMaxLength(30);
        b.Property(x => x.VerificationJson).HasColumnName("verification_result").HasColumnType("text");
        b.Property(x => x.VerificationAttemptedAtUtc).HasColumnName("verification_attempted_at_utc");
        b.Property(x => x.StructuredExtractionJson).HasColumnName("structured_extraction").HasColumnType("text");
        b.Property(x => x.ExtractionAttemptedAtUtc).HasColumnName("extraction_attempted_at_utc");
        b.Property(x => x.ExtractionRulesVersion).HasColumnName("extraction_rules_version").HasDefaultValue(0);
        b.Property(x => x.ContentHash).HasColumnName("content_hash").HasMaxLength(64);
        b.Property(x => x.ChunkerVersion).HasColumnName("chunker_version").HasDefaultValue(0);
        b.Property(x => x.Topics).HasColumnName("topics").HasMaxLength(300).HasDefaultValue(string.Empty);
        b.Property(x => x.SupersededByDocumentId).HasColumnName("superseded_by_document_id");
        b.HasIndex(x => x.ContentHash);
        b.Property(x => x.TenantId).HasColumnName("tenant_id");

        b.HasIndex(x => x.Category);
        b.HasIndex(x => new { x.TenantId, x.IsPublic });
    }
}

internal sealed class AgricultureKnowledgeChunkConfiguration : IEntityTypeConfiguration<AgricultureKnowledgeChunk>
{
    public void Configure(EntityTypeBuilder<AgricultureKnowledgeChunk> b)
    {
        b.ToTable("agriculture_knowledge_chunks");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasColumnName("id");
        b.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc");
        b.Property(x => x.UpdatedAtUtc).HasColumnName("updated_at_utc");

        b.Property(x => x.DocumentId).HasColumnName("document_id");
        b.Property(x => x.ChunkIndex).HasColumnName("chunk_index");
        b.Property(x => x.Content).HasColumnName("content").HasColumnType("text").IsRequired();
        b.Property(x => x.PageNumber).HasColumnName("page_number");
        b.Property(x => x.SectionTitle).HasColumnName("section_title").HasMaxLength(300);
        b.Property(x => x.Topic).HasColumnName("topic").HasMaxLength(30).HasDefaultValue("general");
        // pgvector: kiểu VECTOR(768) — 768 chiều tương ứng với Gemini gemini-embedding-001.
        // Không dùng value converter sang string: EF sẽ gửi tham số kiểu text và PostgreSQL từ chối ghi vào cột vector.
        b.Property(x => x.Embedding).HasColumnName("embedding").HasColumnType("vector(768)");
        b.Property(x => x.CropTags).HasColumnName("crop_tags").HasMaxLength(500).HasDefaultValue(string.Empty);
        b.Property(x => x.Keywords).HasColumnName("keywords").HasMaxLength(1000).HasDefaultValue(string.Empty);
        b.Property(x => x.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(30).HasDefaultValue(KnowledgeChunkStatus.Pending);

        b.HasIndex(x => x.DocumentId);
        b.HasIndex(x => new { x.DocumentId, x.ChunkIndex }).IsUnique();

        b.HasOne(x => x.Document)
            .WithMany(x => x.Chunks)
            .HasForeignKey(x => x.DocumentId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
