using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Infrastructure.Indicators;
using CriptoMoney.Infrastructure.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using StackExchange.Redis;

namespace CriptoMoney.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddSingleton<IJwtService, JwtService>();
        services.AddSingleton<IEncryptionService, EncryptionService>();
        services.AddScoped<IBinanceService, BinanceService>();
        services.AddScoped<IEmailService, SmtpEmailService>();
        services.AddSingleton<IBinanceStreamService, BinanceStreamService>();

        // İndikatörler — her biri Singleton (durumsuz hesaplama)
        services.AddSingleton<IIndicator, TillsonIndicator>();
        services.AddSingleton<IIndicatorRegistry, IndicatorRegistry>();
        services.AddScoped<ISignalEngine, SignalEngine>();
        services.AddScoped<IBacktestEngine, BacktestEngine>();
        services.AddScoped<FlashCrashDetector>();
        services.AddHostedService<TrailingStopMonitorService>();

        var redisConn = configuration.GetConnectionString("Redis");
        if (!string.IsNullOrEmpty(redisConn))
        {
            services.AddSingleton<IConnectionMultiplexer>(_ => ConnectionMultiplexer.Connect(redisConn));
            services.AddSingleton<ICacheService, RedisCache>();
        }

        return services;
    }
}
