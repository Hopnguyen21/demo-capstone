using Microsoft.EntityFrameworkCore;
using SmartFarm.Domain.Entities;
using SmartFarm.Infrastructure.Persistence;
using Xunit;

namespace SmartFarm.Infrastructure.Tests;

public sealed class PersistenceModelTests
{
    private static SmartFarmDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<SmartFarmDbContext>()
            .UseNpgsql("Host=localhost;Database=smartfarm_model_tests;Username=smartfarm")
            .Options;

        return new SmartFarmDbContext(options);
    }

    [Fact]
    public void Model_contains_the_initial_code_first_slice()
    {
        using var context = CreateContext();
        var entityTypes = context.Model.GetEntityTypes().Select(x => x.ClrType).ToHashSet();

        Assert.Contains(typeof(Tenant), entityTypes);
        Assert.Contains(typeof(AppUser), entityTypes);
        Assert.Contains(typeof(Farm), entityTypes);
        Assert.Contains(typeof(Field), entityTypes);
        Assert.Contains(typeof(Zone), entityTypes);
        Assert.Contains(typeof(UserZoneAccess), entityTypes);
        Assert.Contains(typeof(RefreshToken), entityTypes);
    }

    [Fact]
    public void Tenant_subdomain_and_user_email_are_unique()
    {
        using var context = CreateContext();
        var tenant = context.Model.FindEntityType(typeof(Tenant))!;
        var user = context.Model.FindEntityType(typeof(AppUser))!;

        Assert.Contains(tenant.GetIndexes(), index => index.IsUnique && index.Properties.Single().Name == nameof(Tenant.Subdomain));
        Assert.Contains(user.GetIndexes(), index => index.IsUnique && index.Properties.Single().Name == nameof(AppUser.NormalizedEmail));
    }

    [Fact]
    public void User_zone_access_uses_a_composite_key()
    {
        using var context = CreateContext();
        var access = context.Model.FindEntityType(typeof(UserZoneAccess))!;

        Assert.Equal([nameof(UserZoneAccess.AppUserId), nameof(UserZoneAccess.ZoneId)],
            access.FindPrimaryKey()!.Properties.Select(x => x.Name));
    }

    [Fact]
    public void Field_and_zone_boundaries_use_postgresql_jsonb()
    {
        using var context = CreateContext();

        Assert.Equal("jsonb", context.Model.FindEntityType(typeof(Field))!
            .FindProperty(nameof(Field.BoundaryGeoJson))!.GetColumnType());
        Assert.Equal("jsonb", context.Model.FindEntityType(typeof(Zone))!
            .FindProperty(nameof(Zone.BoundaryGeoJson))!.GetColumnType());
    }
}
