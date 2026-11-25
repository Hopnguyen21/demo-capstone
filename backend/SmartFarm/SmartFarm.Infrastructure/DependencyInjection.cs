using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SmartFarm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Domain.Entities;
using SmartFarm.Infrastructure.Identity;
using SmartFarm.Application.Features.Users;
using SmartFarm.Infrastructure.FarmStructure;
using SmartFarm.Infrastructure.CropGrowth;
using SmartFarm.Infrastructure.IoTDeployment;
using SmartFarm.Infrastructure.TelemetryAlerts;
using SmartFarm.Infrastructure.Control;
using SmartFarm.Infrastructure.Ai;
using SmartFarm.Infrastructure.Ai.Knowledge;
using SmartFarm.Application.Features.Ai;
using SmartFarm.Application.Features.Inventory;
using SmartFarm.Infrastructure.Inventory;
using SmartFarm.Application.Features.Finance;
using SmartFarm.Infrastructure.Finance;
using SmartFarm.Application.Features.Reports;
using SmartFarm.Infrastructure.Reports;
using SmartFarm.Application.Features.Platform;
using SmartFarm.Infrastructure.Platform;

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
                npgsql.UseVector();
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
        services.AddOptions<InvitationOptions>().Bind(configuration.GetSection(InvitationOptions.SectionName));
        services.AddScoped<IFarmInvitationService, FarmInvitationService>();
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
            .PostConfigure(opts =>
            {
                // Khoá Gemini CHỈ lấy từ Cài đặt nền tảng (platform_settings, Admin nhập trên web; nạp bởi GeminiRuntimeSettings):
                // bỏ qua mọi khoá trong appsettings, user-secrets hay biến môi trường để mọi môi trường chạy cùng một cách.
                opts.ApiKey = string.Empty;
                opts.ApiKeys = [];
            })
            .Validate(x => string.IsNullOrWhiteSpace(x.ApiKey) || !string.IsNullOrWhiteSpace(x.Model), "Gemini:Model is required when an API key is configured.")
            .Validate(x => Uri.TryCreate(x.BaseUrl, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps, "Gemini:BaseUrl must be an absolute HTTPS URL.")
            .Validate(x => x.TimeoutSeconds is >= 1 and <= 120, "Gemini:TimeoutSeconds must be between 1 and 120.")
            .ValidateOnStart();
        services.AddOptions<GeminiEmbeddingOptions>()
            .Configure<IOptions<GeminiOptions>>((embOpts, gemOpts) =>
            {
                configuration.GetSection(GeminiEmbeddingOptions.SectionName).Bind(embOpts);
                if (string.IsNullOrWhiteSpace(embOpts.ApiKey)) embOpts.BaseUrl = gemOpts.Value.BaseUrl;
                // Embedding dùng chung khoá của Cài đặt nền tảng, không đọc khoá riêng từ cấu hình.
                embOpts.ApiKey = gemOpts.Value.ApiKey;
            });
        services.AddOptions<OpenMeteoOptions>()
            .Bind(configuration.GetSection(OpenMeteoOptions.SectionName))
            .Validate(x => Uri.TryCreate(x.BaseUrl, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps, "OpenMeteo:BaseUrl must be an absolute HTTPS URL.")
            .Validate(x => x.TimeoutSeconds is >= 1 and <= 60, "OpenMeteo:TimeoutSeconds must be between 1 and 60.")
            .ValidateOnStart();
        services.AddMemoryCache();
        // Gemini có thể mất vài chục giây đến hơn 1 phút cho tài liệu dài; mặc định 100 giây của HttpClient cắt sớm hơn
        // thời gian chờ của từng lần gọi (mỗi lệnh gọi vẫn tự đặt giới hạn riêng bằng CancellationToken).
        // Trên VPS Docker (Linux), kết nối IPv6 ra Google APIs hay bị treo/blackhole trên bridge network, nên ưu tiên IPv4.
        services.AddSingleton(CreateDockerSafeHttpClient());
        services.AddScoped<IAiAdvisoryService, AiAdvisoryService>();
        services.AddScoped<GeminiAiAdvisoryProvider>();
        services.AddScoped<UnavailableAiAdvisoryProvider>();
        services.AddScoped<IAiAdvisoryProvider>(provider =>
        {
            var gemOpts = provider.GetRequiredService<Microsoft.Extensions.Options.IOptions<GeminiOptions>>().Value;
            if (string.IsNullOrWhiteSpace(gemOpts.ApiKey))
            {
                TryReloadGeminiFromDb(provider, gemOpts);
            }
            return string.IsNullOrWhiteSpace(gemOpts.ApiKey)
                ? provider.GetRequiredService<UnavailableAiAdvisoryProvider>()
                : provider.GetRequiredService<GeminiAiAdvisoryProvider>();
        });
        services.AddScoped<GeminiQuestionIntentClassifier>();
        services.AddScoped<UnavailableQuestionIntentClassifier>();
        services.AddScoped<IQuestionIntentClassifier>(provider =>
        {
            var gemOpts = provider.GetRequiredService<Microsoft.Extensions.Options.IOptions<GeminiOptions>>().Value;
            if (string.IsNullOrWhiteSpace(gemOpts.ApiKey))
            {
                TryReloadGeminiFromDb(provider, gemOpts);
            }
            return string.IsNullOrWhiteSpace(gemOpts.ApiKey)
                ? provider.GetRequiredService<UnavailableQuestionIntentClassifier>()
                : provider.GetRequiredService<GeminiQuestionIntentClassifier>();
        });
        services.AddScoped<GeminiEmbeddingProvider>();
        services.AddScoped<IDocumentSufficiencyValidator, VietGapDocumentAiValidator>();
        services.AddScoped<VietGapDocumentVerifier>();
        services.AddScoped<AgricultureDocumentService>();
        services.AddScoped<IAgricultureDocumentService>(sp => sp.GetRequiredService<AgricultureDocumentService>());
        services.AddScoped<IAgricultureKnowledgeRetriever, AgricultureKnowledgeRetriever>();
        services.AddScoped<IAiWeatherProvider, OpenMeteoWeatherProvider>();
        services.AddScoped<IInventoryTaskService, InventoryTaskService>();
        services.AddScoped<IFinanceService, FinanceService>();
        services.AddScoped<IServiceRequestService, ServiceRequestService>();
        services.AddScoped<IReportService, ReportService>();
        services.AddScoped<IPlatformAdminService, PlatformAdminService>();
        services.AddScoped<IBackupService, BackupService>();
        services.AddScoped<IQuotationService, QuotationService>();
        services.AddScoped<IGisService, GisService>();
        services.AddScoped<IGeocodingService, NominatimGeocodingService>();
        services.AddScoped<IFarmWizardService, FarmWizardService>();
        services.AddScoped<IWeatherService, WeatherService>();
        services.AddScoped<IFarmerService, FarmerService>();
        services.AddScoped<IScheduleSyncService, ScheduleSyncService>();
        services.AddScoped<IControlAutomationService, ControlAutomationService>();
        services.AddScoped<INotificationService, SmartFarm.Infrastructure.Notifications.NotificationService>();
        services.AddScoped<IZoneContractService, ZoneContractService>();
        services.AddScoped<IFieldSurveyReportService, FieldSurveyReportService>();
        services.AddScoped<IStockOutService, StockOutService>();
        services.AddScoped<IStockInService, StockInService>();
        services.AddScoped<IBillService, BillService>();
        services.AddScoped<IContractPackageService, ContractPackageService>();
        services.AddScoped<IDiscountCodeService, DiscountCodeService>();
        services.AddScoped<IPayOSService, PayOSService>();
        services.AddScoped<ICloudinaryService, CloudinaryService>();

        return services;
    }

    private static void TryReloadGeminiFromDb(IServiceProvider provider, GeminiOptions gemOpts)
    {
        try
        {
            var db = provider.GetService<SmartFarmDbContext>();
            var jwt = provider.GetService<IOptions<JwtOptions>>()?.Value;
            var emb = provider.GetService<IOptions<GeminiEmbeddingOptions>>()?.Value;
            if (db is not null && jwt is not null)
            {
                GeminiRuntimeSettings.ApplyAsync(db, jwt.SigningKey, gemOpts, emb, null, CancellationToken.None)
                    .GetAwaiter().GetResult();
            }
        }
        catch
        {
            // Ignore transient reload error and fall back gracefully
        }
    }

    private static HttpClient CreateDockerSafeHttpClient()
    {
        var handler = new SocketsHttpHandler
        {
            PooledConnectionLifetime = TimeSpan.FromMinutes(5),
            PooledConnectionIdleTimeout = TimeSpan.FromMinutes(2),
            ConnectTimeout = TimeSpan.FromSeconds(10),
            AutomaticDecompression = System.Net.DecompressionMethods.All,
            ConnectCallback = async (context, cancellationToken) =>
            {
                var addresses = await System.Net.Dns.GetHostAddressesAsync(context.DnsEndPoint.Host, cancellationToken);
                // Ưu tiên IPv4 trước IPv6 để tránh lỗi treo kết nối IPv6 trên mạng bridge của VPS Docker Linux
                var ordered = addresses
                    .OrderBy(a => a.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork ? 0 : 1)
                    .ToArray();

                Exception? lastEx = null;
                foreach (var addr in ordered)
                {
                    var socket = new System.Net.Sockets.Socket(addr.AddressFamily, System.Net.Sockets.SocketType.Stream, System.Net.Sockets.ProtocolType.Tcp)
                    {
                        NoDelay = true
                    };
                    try
                    {
                        await socket.ConnectAsync(new System.Net.IPEndPoint(addr, context.DnsEndPoint.Port), cancellationToken);
                        return new System.Net.Sockets.NetworkStream(socket, ownsSocket: true);
                    }
                    catch (Exception ex)
                    {
                        socket.Dispose();
                        lastEx = ex;
                    }
                }
                throw lastEx ?? new System.Net.Sockets.SocketException((int)System.Net.Sockets.SocketError.HostUnreachable);
            }
        };
        return new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(180) };
    }
}
