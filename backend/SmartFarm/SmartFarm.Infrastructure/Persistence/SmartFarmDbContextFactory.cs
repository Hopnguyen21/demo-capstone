using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace SmartFarm.Infrastructure.Persistence;

public sealed class SmartFarmDbContextFactory : IDesignTimeDbContextFactory<SmartFarmDbContext>
{
    public SmartFarmDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__SmartFarmDb")
            ?? "Host=localhost;Port=5432;Database=SmartFarmDB01;Username=postgres;Password=12345";

        var options = new DbContextOptionsBuilder<SmartFarmDbContext>()
            .UseNpgsql(connectionString, npgsql =>
            {
                npgsql.UseNetTopologySuite();
                npgsql.MigrationsAssembly(typeof(SmartFarmDbContext).Assembly.FullName);
            })
            .Options;

        return new SmartFarmDbContext(options);
    }
}
