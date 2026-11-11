using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace SmartFarm.Infrastructure.Persistence;

public sealed class SmartFarmDbContextFactory : IDesignTimeDbContextFactory<SmartFarmDbContext>
{
    public SmartFarmDbContext CreateDbContext(string[] args)
    {
        // Read strictly from environment variable during design-time migrations.
        // Hardcoded passwords or connection strings are strictly forbidden.
        var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__SmartFarmDb")
            ?? Environment.GetEnvironmentVariable("SMARTFARM_CONNECTION_STRING");

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                "Không tìm thấy chuỗi kết nối cơ sở dữ liệu lúc design-time (EF Core Migrations). " +
                "Vui lòng thiết lập biến môi trường 'ConnectionStrings__SmartFarmDb' hoặc 'SMARTFARM_CONNECTION_STRING' " +
                "để thực thi các lệnh EF Core Tools an toàn mà không lưu mật khẩu cứng trong mã nguồn.");
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
