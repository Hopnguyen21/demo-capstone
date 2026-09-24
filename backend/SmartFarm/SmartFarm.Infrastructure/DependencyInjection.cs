using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SmartFarm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Domain.Entities;
using SmartFarm.Infrastructure.Identity;
using SmartFarm.Infrastructure.FarmStructure;
using SmartFarm.Infrastructure.CropGrowth;
using SmartFarm.Infrastructure.IoTDeployment;
using SmartFarm.Infrastructure.TelemetryAlerts;
using SmartFarm.Infrastructure.Control;

namespace SmartFarm.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("SmartFarmDb");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                "Connection string 'SmartFarmDb' is required. Set ConnectionStrings__SmartFarmDb in the environment.");
        }

        services.AddDbContext<SmartFarmDbContext>(options =>
            options.UseNpgsql(connectionString, npgsql =>
                npgsql.MigrationsAssembly(typeof(SmartFarmDbContext).Assembly.FullName)));

        services.AddOptions<JwtOptions>()
            .Bind(configuration.GetSection(JwtOptions.SectionName))
            .Validate(options => !string.IsNullOrWhiteSpace(options.Issuer), "Jwt:Issuer is required.")
            .Validate(options => !string.IsNullOrWhiteSpace(options.Audience), "Jwt:Audience is required.")
            .Validate(options => options.SigningKey.Length >= 32, "Jwt:SigningKey must contain at least 32 characters.")
            .Validate(options => options.AccessTokenMinutes > 0, "Jwt:AccessTokenMinutes must be positive.")
            .Validate(options => options.RefreshTokenDays > 0, "Jwt:RefreshTokenDays must be positive.")
            .ValidateOnStart();

        services.AddSingleton(TimeProvider.System);
        services.AddScoped<IPasswordHasher<AppUser>, PasswordHasher<AppUser>>();
        services.AddScoped<IJwtTokenGenerator, JwtTokenGenerator>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IUserService, UserService>();
        services.AddScoped<ITenantService, TenantService>();
        services.AddScoped<ITechnicianService, TechnicianService>();
        services.AddScoped<FarmStructureService>();
        services.AddScoped<IFarmService>(provider => provider.GetRequiredService<FarmStructureService>());
        services.AddScoped<IFieldService>(provider => provider.GetRequiredService<FarmStructureService>());
        services.AddScoped<IZoneService>(provider => provider.GetRequiredService<FarmStructureService>());
        services.AddScoped<ICropGrowthService, CropGrowthService>();
        services.AddScoped<IIoTDeploymentService, IoTDeploymentService>();
        services.AddScoped<TelemetryAlertService>();
        services.AddScoped<ITelemetryIngestionService>(provider => provider.GetRequiredService<TelemetryAlertService>());
        services.AddScoped<ITelemetryAlertService>(provider => provider.GetRequiredService<TelemetryAlertService>());
        services.AddScoped<IMqttTelemetryAdapter, MqttTelemetryAdapter>();
        services.AddScoped<ControlService>();
        services.AddScoped<IControlService>(provider => provider.GetRequiredService<ControlService>());
        services.AddScoped<IActuatorFeedbackAdapter, MqttActuatorFeedbackAdapter>();
        services.AddScoped<IActuatorCommandTransport, MqttActuatorCommandTransport>();
        services.AddScoped<IRainForecastProvider, UnavailableRainForecastProvider>();

        return services;
    }
}
