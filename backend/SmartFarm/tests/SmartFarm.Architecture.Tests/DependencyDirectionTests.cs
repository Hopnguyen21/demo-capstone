using SmartFarm.Domain.Entities;
using SmartFarm.Infrastructure.Persistence;
using Xunit;

namespace SmartFarm.Architecture.Tests;

public sealed class DependencyDirectionTests
{
    [Fact]
    public void Domain_has_no_project_or_framework_dependencies()
    {
        var references = typeof(Tenant).Assembly.GetReferencedAssemblies().Select(x => x.Name).ToArray();

        Assert.DoesNotContain("SmartFarm.Application", references);
        Assert.DoesNotContain("SmartFarm.Infrastructure", references);
        Assert.DoesNotContain("SmartFarm.Api", references);
        Assert.DoesNotContain(references, name => name!.StartsWith("Microsoft.EntityFrameworkCore", StringComparison.Ordinal));
    }

    [Fact]
    public void Infrastructure_does_not_depend_on_api()
    {
        var references = typeof(SmartFarmDbContext).Assembly.GetReferencedAssemblies().Select(x => x.Name).ToArray();

        Assert.DoesNotContain("SmartFarm.Api", references);
    }
}
