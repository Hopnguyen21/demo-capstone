using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartFarm.Domain.Entities;

namespace SmartFarm.Infrastructure.Persistence.Configurations;

internal sealed class DeviceActuatorReportingConfiguration : IEntityTypeConfiguration<DeviceActuator>
{
    public void Configure(EntityTypeBuilder<DeviceActuator> b)
    {
        b.Property(x => x.FlowRateLitersPerMinute).HasColumnName("flow_rate_liters_per_minute").HasPrecision(12, 3);
    }
}
