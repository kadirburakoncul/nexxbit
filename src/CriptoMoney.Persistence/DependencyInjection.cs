using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Persistence.Context;
using CriptoMoney.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace CriptoMoney.Persistence;

public static class DependencyInjection
{
    public static IServiceCollection AddPersistence(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection")!;
        var serverVersion = new MySqlServerVersion(new Version(8, 0, 0));

        services.AddDbContext<AppDbContext>(options =>
            options.UseMySql(connectionString, serverVersion,
                mysql =>
                {
                    mysql.MigrationsAssembly(typeof(AppDbContext).Assembly.FullName);
                    mysql.EnableRetryOnFailure(3, TimeSpan.FromSeconds(5), null);
                }));

        services.AddScoped<IApplicationDbContext>(sp => sp.GetRequiredService<AppDbContext>());
        services.AddScoped<IUnitOfWork, UnitOfWork>();

        return services;
    }
}
