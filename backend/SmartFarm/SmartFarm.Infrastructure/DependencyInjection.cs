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
using SmartFarm.Infrastructure.Ai;
using SmartFarm.Application.Features.Ai;
using SmartFarm.Application.Features.Inventory;
using SmartFarm.Infrastructure.Inventory;
using SmartFarm.Application.Features.Finance;
using SmartFarm.Infrastructure.Finance;
using SmartFarm.Application.Features.Reports;
using SmartFarm.Infrastructure.Reports;

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
            {
                npgsql.UseNetTopologySuite();
                npgsql.MigrationsAssembly(typeof(SmartFarmDbContext).Assembly.FullName);
            }));

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
        services.AddOptions<AiOptions>()
            .Bind(configuration.GetSection(AiOptions.SectionName))
            .Validate(x => x.MinimumConfidence is >= 0 and <= 1, "Ai:MinimumConfidence must be between 0 and 1.")
            .Validate(x => x.MaxRequestsPerWindow > 0, "Ai:MaxRequestsPerWindow must be positive.")
            .Validate(x => x.RateLimitWindowMinutes > 0, "Ai:RateLimitWindowMinutes must be positive.")
            .Validate(x => x.RecommendationValidityMinutes > 0, "Ai:RecommendationValidityMinutes must be positive.")
            .Validate(x => x.TelemetryFreshnessMinutes > 0, "Ai:TelemetryFreshnessMinutes must be positive.")
            .ValidateOnStart();
        services.AddOptions<GeminiOptions>()
            .Bind(configuration.GetSection(GeminiOptions.SectionName))
            .Validate(x => string.IsNullOrWhiteSpace(x.ApiKey) || !string.IsNullOrWhiteSpace(x.Model), "Gemini:Model is required when an API key is configured.")
            .Validate(x => Uri.TryCreate(x.BaseUrl, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps, "Gemini:BaseUrl must be an absolute HTTPS URL.")
            .Validate(x => x.TimeoutSeconds is >= 1 and <= 120, "Gemini:TimeoutSeconds must be between 1 and 120.")
            .ValidateOnStart();
        services.AddOptions<OpenMeteoOptions>()
            .Bind(configuration.GetSection(OpenMeteoOptions.SectionName))
            .Validate(x => Uri.TryCreate(x.BaseUrl, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps, "OpenMeteo:BaseUrl must be an absolute HTTPS URL.")
            .Validate(x => x.TimeoutSeconds is >= 1 and <= 60, "OpenMeteo:TimeoutSeconds must be between 1 and 60.")
            .ValidateOnStart();
        services.AddSingleton<HttpClient>();
        services.AddScoped<IAiAdvisoryService, AiAdvisoryService>();
        services.AddScoped<GeminiAiAdvisoryProvider>();
        services.AddScoped<UnavailableAiAdvisoryProvider>();
        services.AddScoped<IAiAdvisoryProvider>(provider =>
            string.IsNullOrWhiteSpace(provider.GetRequiredService<Microsoft.Extensions.Options.IOptions<GeminiOptions>>().Value.ApiKey)
                ? provider.GetRequiredService<UnavailableAiAdvisoryProvider>()
                : provider.GetRequiredService<GeminiAiAdvisoryProvider>());
        services.AddScoped<IAiWeatherProvider, OpenMeteoWeatherProvider>();
        services.AddScoped<IInventoryTaskService, InventoryTaskService>();
        services.AddScoped<IFinanceService, FinanceService>();
        services.AddScoped<IServiceRequestService, ServiceRequestService>();
        services.AddScoped<IReportService, ReportService>();

        return services;
    }
}
