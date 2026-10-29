using System.Text.Json;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.OpenApi.Models;
using SmartFarm.Api.Middleware;
using SmartFarm.Api.Extensions;
using SmartFarm.Application;
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
    try
    {
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        await db.Database.MigrateAsync();
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Auto-migration failed on startup");
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
        var db = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
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
