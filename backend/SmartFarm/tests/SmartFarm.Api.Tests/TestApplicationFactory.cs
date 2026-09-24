using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using SmartFarm.Infrastructure.Persistence;
using SmartFarm.Application.Common.Interfaces;
using SmartFarm.Application.Features.Control;

namespace SmartFarm.Api.Tests;

internal sealed class TestApplicationFactory : WebApplicationFactory<Program>
{
    internal const string SigningKey = "integration-test-signing-key-with-at-least-32-characters";
    private readonly string _databaseName = $"smartfarm-tests-{Guid.NewGuid():N}";
    internal FakeControlTransport ControlTransport { get; } = new();
    internal FakeRainProvider RainProvider { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration((_, configuration) =>
        {
            configuration.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:SmartFarmDb"] = "Host=localhost;Database=unused;Username=unused",
                ["Jwt:Issuer"] = "SmartFarm.Api.Tests",
                ["Jwt:Audience"] = "SmartFarm.TestClients",
                ["Jwt:SigningKey"] = SigningKey,
                ["Jwt:AccessTokenMinutes"] = "60",
                ["Jwt:RefreshTokenDays"] = "30"
            });
        });
        builder.ConfigureServices(services =>
        {
            services.AddDataProtection().UseEphemeralDataProtectionProvider();
            services.RemoveAll<DbContextOptions<SmartFarmDbContext>>();
            services.RemoveAll<SmartFarmDbContext>();
            services.AddDbContext<SmartFarmDbContext>(options =>
                options.UseInMemoryDatabase(_databaseName)
                    .ConfigureWarnings(warnings => warnings.Ignore(InMemoryEventId.TransactionIgnoredWarning)));
            services.RemoveAll<IActuatorCommandTransport>();
            services.RemoveAll<IRainForecastProvider>();
            services.AddSingleton<IActuatorCommandTransport>(ControlTransport);
            services.AddSingleton<IRainForecastProvider>(RainProvider);
        });
    }

    internal async Task<SeedData> SeedAsync()
    {
        using var scope = Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<SmartFarmDbContext>();
        await dbContext.Database.EnsureDeletedAsync();
        await dbContext.Database.EnsureCreatedAsync();

        var tenantA = new Tenant { CompanyName = "Tenant A", Subdomain = "tenant-a" };
        var tenantB = new Tenant { CompanyName = "Tenant B", Subdomain = "tenant-b" };
        var farmA = new Farm { Tenant = tenantA, Name = "Farm A", TotalAreaM2 = 1000 };
        var farmB = new Farm { Tenant = tenantB, Name = "Farm B", TotalAreaM2 = 1000 };
        var fieldA = new Field { Farm = farmA, Name = "Field A", AreaM2 = 500, AvailableAreaM2 = 400 };
        var fieldB = new Field { Farm = farmB, Name = "Field B", AreaM2 = 500, AvailableAreaM2 = 400 };
        var zoneA = new Zone { Field = fieldA, Name = "Zone A", AreaM2 = 100, ZoneType = "Greenhouse" };
        var zoneB = new Zone { Field = fieldB, Name = "Zone B", AreaM2 = 100, ZoneType = "Greenhouse" };

        var ownerA = CreateUser("owner-a@example.com", "Owner A", UserRole.FarmOwner, tenantA, null);
        var ownerB = CreateUser("owner-b@example.com", "Owner B", UserRole.FarmOwner, tenantB, null);
        var farmer = CreateUser("farmer@example.com", "Unassigned Farmer", UserRole.Farmer, null, null);
        var tenantBUser = CreateUser("farmer-b@example.com", "Tenant B Farmer", UserRole.Farmer, tenantB, farmB);
        var admin = CreateUser("admin@example.com", "Platform Admin", UserRole.PlatformAdmin, null, null);
        var technician = CreateUser("technician@example.com", "Platform Technician", UserRole.PlatformTechnician, null, null);

        dbContext.AddRange(tenantA, tenantB, farmA, farmB, fieldA, fieldB, zoneA, zoneB, ownerA, ownerB, farmer, tenantBUser, admin, technician);
        await dbContext.SaveChangesAsync();
        return new SeedData(ownerA.Id, ownerB.Id, farmer.Id, tenantBUser.Id, farmA.Id, farmB.Id,
            fieldA.Id, fieldB.Id, zoneA.Id, zoneB.Id, technician.Id);
    }

    private static AppUser CreateUser(string email, string name, UserRole role, Tenant? tenant, Farm? farm)
    {
        var user = new AppUser
        {
            Email = email,
            NormalizedEmail = email.ToUpperInvariant(),
            FullName = name,
            Role = role,
            Status = AccountStatus.Active,
            Tenant = tenant,
            Farm = farm
        };
        user.PasswordHash = new PasswordHasher<AppUser>().HashPassword(user, "ValidPassword1!");
        return user;
    }
}

internal sealed class FakeControlTransport : IActuatorCommandTransport
{
    internal bool PublishSucceeds { get; set; } = true;
    internal List<CommandDispatchEnvelope> Published { get; } = [];
    internal List<CommandDispatchEnvelope> EmergencyStops { get; } = [];
    public Task<CommandTransportResult> PublishAsync(CommandDispatchEnvelope command, CancellationToken cancellationToken) { Published.Add(command); return Task.FromResult(PublishSucceeds ? new CommandTransportResult(true) : new CommandTransportResult(false, "BROKER_OFFLINE", "MQTT broker is unavailable.")); }
    public Task<CommandTransportResult> PublishEmergencyStopAsync(CommandDispatchEnvelope command, CancellationToken cancellationToken) { EmergencyStops.Add(command); return Task.FromResult(PublishSucceeds ? new CommandTransportResult(true) : new CommandTransportResult(false, "BROKER_OFFLINE", "MQTT broker is unavailable.")); }
}

internal sealed class FakeRainProvider : IRainForecastProvider
{
    internal bool Available { get; set; } = true;
    internal decimal Probability { get; set; } = 10;
    public Task<RainForecastResult> GetAsync(Guid farmId, CancellationToken cancellationToken) => Task.FromResult(new RainForecastResult(Available, Available ? Probability : null));
}

internal sealed record SeedData(
    Guid OwnerAId,
    Guid OwnerBId,
    Guid UnassignedFarmerId,
    Guid TenantBFarmerId,
    Guid FarmAId,
    Guid FarmBId,
    Guid FieldAId,
    Guid FieldBId,
    Guid ZoneAId,
    Guid ZoneBId,
    Guid TechnicianId);
