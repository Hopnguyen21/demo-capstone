using Microsoft.Extensions.DependencyInjection;

namespace SmartFarm.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        return services;
    }
}
