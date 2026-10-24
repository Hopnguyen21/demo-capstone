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
        b.Property(x => x.FileType).HasColumnName("file_type").HasMaxLength(20).HasDefaultValue("seed");
        b.Property(x => x.ContentText).HasColumnName("content_text").HasColumnType("text").IsRequired();
        b.Property(x => x.AuthorOrganization).HasColumnName("author_organization").HasMaxLength(200);
        b.Property(x => x.Category).HasColumnName("category").HasMaxLength(50).HasDefaultValue("general");
        b.Property(x => x.CropScope).HasColumnName("crop_scope").HasMaxLength(500).HasDefaultValue(string.Empty);
        b.Property(x => x.Version).HasColumnName("version").HasMaxLength(50);
        b.Property(x => x.IsPublic).HasColumnName("is_public").HasDefaultValue(true);
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
        // pgvector: kiểu VECTOR(768) — 768 chiều tương ứng với Gemini gemini-embedding-001
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
