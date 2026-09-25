using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using SmartFarm.Domain.Entities;
using SmartFarm.Infrastructure.Persistence;
using Xunit;

namespace SmartFarm.Infrastructure.Tests;

public sealed class PersistenceModelTests
{
    private static SmartFarmDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<SmartFarmDbContext>()
            .UseNpgsql("Host=localhost;Database=smartfarm_model_tests;Username=smartfarm", options => options.UseNetTopologySuite())
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
    public void Field_and_zone_boundaries_use_postgis_polygon_with_gist_indexes()
    {
        using var context = CreateContext();

        var designModel = context.GetService<IDesignTimeModel>().Model;
        var field = designModel.FindEntityType(typeof(Field))!;
        var zone = designModel.FindEntityType(typeof(Zone))!;

        Assert.Equal("geometry(Polygon,4326)", field.FindProperty(nameof(Field.BoundaryGeoJson))!.GetColumnType());
        Assert.Equal("geometry(Polygon,4326)", zone.FindProperty(nameof(Zone.BoundaryGeoJson))!.GetColumnType());
        var fieldBoundaryIndex = field.GetIndexes().Single(index => index.Properties.Count == 1 && index.Properties[0].Name == nameof(Field.BoundaryGeoJson));
        var zoneBoundaryIndex = zone.GetIndexes().Single(index => index.Properties.Count == 1 && index.Properties[0].Name == nameof(Zone.BoundaryGeoJson));
        Assert.Equal("ix_fields_boundary_gist", fieldBoundaryIndex.GetDatabaseName());
        Assert.Equal("gist", fieldBoundaryIndex.GetMethod());
        Assert.Equal("ix_zones_boundary_gist", zoneBoundaryIndex.GetDatabaseName());
        Assert.Equal("gist", zoneBoundaryIndex.GetMethod());
    }
}
