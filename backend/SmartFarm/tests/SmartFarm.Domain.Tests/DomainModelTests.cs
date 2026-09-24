using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;
using Xunit;

namespace SmartFarm.Domain.Tests;

public sealed class DomainModelTests
{
    [Fact]
    public void UserRole_contains_only_the_four_canonical_roles()
    {
        var roles = Enum.GetNames<UserRole>();

        Assert.Equal(["PlatformAdmin", "PlatformTechnician", "FarmOwner", "Farmer"], roles);
    }

    [Fact]
    public void New_entities_receive_non_empty_ids_and_utc_timestamps()
    {
        var tenant = new Tenant();

        Assert.NotEqual(Guid.Empty, tenant.Id);
        Assert.Equal(DateTimeKind.Utc, tenant.CreatedAtUtc.Kind);
    }
}
