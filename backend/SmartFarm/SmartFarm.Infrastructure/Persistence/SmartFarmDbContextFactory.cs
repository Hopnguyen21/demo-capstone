using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace SmartFarm.Infrastructure.Persistence;

public sealed class SmartFarmDbContextFactory : IDesignTimeDbContextFactory<SmartFarmDbContext>
{
    public SmartFarmDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__SmartFarmDb")
            ?? Environment.GetEnvironmentVariable("SMARTFARM_CONNECTION_STRING");

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            // Tự động tìm chuỗi kết nối từ appsettings.Development.json trong môi trường phát triển cục bộ
            var currentDir = Directory.GetCurrentDirectory();
            var candidateDirs = new[]
            {
                Path.Combine(currentDir, "backend", "SmartFarm", "SmartFarm.Api"),
                Path.Combine(currentDir, "..", "SmartFarm.Api"),
                Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "SmartFarm.Api")
            };

            foreach (var dir in candidateDirs)
            {
                var settingsPath = Path.Combine(dir, "appsettings.Development.json");
                if (File.Exists(settingsPath))
                {
                    try
                    {
                        var json = File.ReadAllText(settingsPath);
                        using var doc = System.Text.Json.JsonDocument.Parse(json);
                        if (doc.RootElement.TryGetProperty("ConnectionStrings", out var csElement) &&
                            csElement.TryGetProperty("SmartFarmDb", out var dbElement))
                        {
                            connectionString = dbElement.GetString();
                            if (!string.IsNullOrWhiteSpace(connectionString)) break;
                        }
                    }
                    catch { }
                }
            }
        }

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                "Không tìm thấy chuỗi kết nối cơ sở dữ liệu lúc design-time (EF Core Migrations). " +
                "Vui lòng thiết lập biến môi trường 'ConnectionStrings__SmartFarmDb' hoặc 'SMARTFARM_CONNECTION_STRING' " +
                "hoặc tệp 'appsettings.Development.json' trong SmartFarm.Api.");
        }

        var options = new DbContextOptionsBuilder<SmartFarmDbContext>()
            .UseNpgsql(connectionString, npgsql =>
            {
                npgsql.UseNetTopologySuite();
                npgsql.UseVector();
                npgsql.MigrationsAssembly(typeof(SmartFarmDbContext).Assembly.FullName);
            })
            .Options;

        return new SmartFarmDbContext(options);
    }
}
