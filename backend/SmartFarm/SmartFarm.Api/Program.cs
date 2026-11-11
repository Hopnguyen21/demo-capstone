using System.Text.Json;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.OpenApi.Models;
using SmartFarm.Api.Middleware;
using SmartFarm.Api.Extensions;
using SmartFarm.Application;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Infrastructure;
using System.Text.Json.Serialization;
using SmartFarm.Api.HostedServices;
using Microsoft.EntityFrameworkCore;
using SmartFarm.Infrastructure.Persistence;
using SmartFarm.Infrastructure.Ai.Knowledge;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

builder.Logging.ClearProviders();
builder.Logging.AddJsonConsole();

builder.Services.AddProblemDetails(options =>
{
    options.CustomizeProblemDetails = context =>
    {
        context.ProblemDetails.Extensions["traceId"] = context.HttpContext.TraceIdentifier;
        context.ProblemDetails.Instance = context.HttpContext.Request.Path;
    };
});
builder.Services.AddExceptionHandler<ApiExceptionHandler>();
builder.Services.AddControllers().AddJsonOptions(options =>
    options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter(allowIntegerValues: false)));
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddSingleton<MqttBrokerHost>();
builder.Services.AddSingleton<IActuatorCommandTransport>(sp => sp.GetRequiredService<MqttBrokerHost>());
builder.Services.AddSmartFarmAuthentication(builder.Configuration, builder.Environment);
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    // Mỗi địa chỉ IP có hạn mức riêng để một client không thể chặn đăng nhập của mọi người khác.
    options.AddPolicy("LoginPolicy", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 15,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0
            }));
});
builder.Services.AddHealthChecks();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Nhập JWT access token. Không cần thêm tiền tố 'Bearer '."
    });
    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        [new OpenApiSecurityScheme
        {
            Reference = new OpenApiReference
            {
                Type = ReferenceType.SecurityScheme,
                Id = "Bearer"
            }
        }] = Array.Empty<string>()
    });
});
builder.Services.AddHostedService<ControlAutomationWorker>();
builder.Services.AddHostedService<MqttBrokerHost>(sp => sp.GetRequiredService<MqttBrokerHost>());
builder.Services.AddHostedService<GatewayLivenessWorker>();
builder.Services.AddHostedService<DeviceLivenessWorker>();
builder.Services.AddHostedService<SimulatedIotTelemetryWorker>();
builder.Services.AddHostedService<KnowledgeEmbeddingWorker>();

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        if (allowedOrigins.Length > 0)
        {
            policy.WithOrigins(allowedOrigins);
        }
        else
        {
            policy.SetIsOriginAllowed(_ => false);
        }

        policy.AllowAnyHeader().AllowAnyMethod();
    });
});

var app = builder.Build();

// Auto-migration: apply pending EF Core migrations on startup & seed default knowledge base (skipped in Testing)
if (!app.Environment.IsEnvironment("Testing"))
{
    using var scope = app.Services.CreateScope();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();

    const int maxRetries = 5;
    for (var attempt = 1; attempt <= maxRetries; attempt++)
    {
        try
        {
            logger.LogInformation("⏳ [AutoMigration] Đang kiểm tra trạng thái Database migration (lần thử {Attempt}/{MaxRetries})...", attempt, maxRetries);
            var pendingMigrations = (await db.Database.GetPendingMigrationsAsync()).ToList();
            if (pendingMigrations.Count > 0)
            {
                logger.LogInformation("🚀 [AutoMigration] Phát hiện {Count} migration đang chờ cập nhật: {Migrations}",
                    pendingMigrations.Count, string.Join(", ", pendingMigrations));
                await db.Database.MigrateAsync();
                logger.LogInformation("✅ [AutoMigration] Đã tự động cập nhật Database thành công!");
            }
            else
            {
                logger.LogInformation("✅ [AutoMigration] Database đã ở phiên bản mới nhất (0 migration pending).");
            }
            break;
        }
        catch (Exception ex)
        {
            if (attempt == maxRetries)
            {
                logger.LogError(ex, "❌ [AutoMigration] Lỗi: Không thể tự động migration database sau {MaxRetries} lần thử.", maxRetries);
            }
            else
            {
                logger.LogWarning(ex, "⚠️ [AutoMigration] Chưa kết nối được Database (lần thử {Attempt}/{MaxRetries}). Đợi 3 giây thử lại...", attempt, maxRetries);
                await Task.Delay(3000);
            }
        }
    }

    try
    {
        var docService = scope.ServiceProvider.GetRequiredService<AgricultureDocumentService>();
        await docService.SeedVietGapKnowledgeAsync();
    }
    catch (Exception ex)
    {
        logger.LogWarning(ex, "Knowledge base seeding encountered an issue during startup");
    }

    try
    {
        await SmartFarm.Infrastructure.Persistence.DataIntegrityHealer.HealAsync(db, logger, app.Configuration, app.Environment.IsDevelopment());
    }
    catch (Exception ex)
    {
        logger.LogWarning(ex, "Data integrity auto-healing encountered an issue during startup");
    }
}

app.UseMiddleware<CorrelationIdMiddleware>();
app.UseExceptionHandler();
app.UseStatusCodePages();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
else
{
    app.UseHttpsRedirection();
}
app.UseCors("Frontend");
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapHealthChecks("/health", new HealthCheckOptions
{
    ResponseWriter = async (context, report) =>
    {
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsync(JsonSerializer.Serialize(new
        {
            status = report.Status.ToString(),
            checks = report.Entries.Select(entry => new
            {
                name = entry.Key,
                status = entry.Value.Status.ToString()
            })
        }));
    }
});
app.MapControllers();

app.Run();

public partial class Program;
