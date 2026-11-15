using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartFarm.Domain.Entities;

namespace SmartFarm.Infrastructure.Persistence.Configurations;

internal sealed class FarmingSeasonConfiguration : IEntityTypeConfiguration<FarmingSeason>
{
    public void Configure(EntityTypeBuilder<FarmingSeason> b)
    {
        // Khớp độ dài cột đã tạo trong DB (migration AddFarmingSeasons); trước đây model để text không giới hạn.
        b.Property(x => x.Code).HasMaxLength(100);
        b.Property(x => x.Name).HasMaxLength(250);
        b.Property(x => x.Status).HasMaxLength(50);
    }
}
