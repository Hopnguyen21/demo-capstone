using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartFarm.Domain.Entities;

namespace SmartFarm.Infrastructure.Persistence.Configurations;

internal sealed class DeviceDepreciationConfiguration : IEntityTypeConfiguration<DeviceDepreciation>
{
    public void Configure(EntityTypeBuilder<DeviceDepreciation> b)
    {
        // Một thiết bị chỉ có một hồ sơ khấu hao.
        b.HasIndex(x => x.DeviceId).IsUnique();
    }
}
