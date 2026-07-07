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
        services.AddSingleton<ITelegramService, TelegramService>();
        services.AddHttpClient("telegram").ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler());
        services.AddSingleton<IPasswordHasher, BcryptPasswordHasher>();
        services.AddSingleton<IEncryptionService, EncryptionService>();
        services.AddScoped<IBinanceService, BinanceService>();
        services.AddScoped<IEmailService, SmtpEmailService>();
        services.AddSingleton<IBinanceStreamService, BinanceStreamService>();

        // BIST — kripto trading motoruyla bağlantısı yok, sadece ücretsiz veri + sinyal
        services.AddScoped<IBistDataService, BistDataService>();
        services.AddHttpClient("yahoo-finance", c =>
        {
            c.Timeout = TimeSpan.FromSeconds(10);
            c.DefaultRequestHeaders.UserAgent.ParseAdd(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36");
        });

        // İndikatörler — sadece Level1 (T3 tabanlı) aktif
        services.AddSingleton<IIndicator, Level1Indicator>();
        services.AddSingleton<IIndicator, RsiIndicator>();
        services.AddSingleton<IIndicatorRegistry, IndicatorRegistry>();
        services.AddScoped<ISignalEngine, SignalEngine>();
        services.AddScoped<IBacktestEngine, BacktestEngine>();
        services.AddScoped<FlashCrashDetector>();
        services.AddSingleton<MomentumTracker>();
        services.AddSingleton<MarketRegimeService>();
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
