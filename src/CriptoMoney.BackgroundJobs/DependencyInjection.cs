using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.BackgroundJobs.Jobs;
using CriptoMoney.BackgroundJobs.Services;
using Hangfire;
using Hangfire.SqlServer;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace CriptoMoney.BackgroundJobs;

public static class DependencyInjection
{
    public static IServiceCollection AddBackgroundJobs(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("Hangfire için bağlantı dizesi bulunamadı.");

        services.AddHangfire(config => config
            .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
            .UseSimpleAssemblyNameTypeSerializer()
            .UseRecommendedSerializerSettings()
            .UseSqlServerStorage(connectionString, new SqlServerStorageOptions
            {
                CommandBatchMaxTimeout = TimeSpan.FromMinutes(5),
                SlidingInvisibilityTimeout = TimeSpan.FromMinutes(5),
                QueuePollInterval = TimeSpan.Zero,
                UseRecommendedIsolationLevel = true,
                DisableGlobalLocks = true,
            }));

        services.AddHangfireServer(options =>
        {
            options.WorkerCount = 2;
            options.Queues = ["default", "signals"];
        });

        services.AddScoped<SignalGenerationJob>();
        services.AddScoped<BacktestJob>();
        services.AddScoped<BalanceSnapshotJob>();
        services.AddScoped<DailyReportJob>();
        services.AddScoped<IBacktestJobScheduler, HangfireBacktestJobScheduler>();

        return services;
    }

    /// <summary>
    /// Yinelenen Hangfire job'larını kaydeder. App.UseHangfireDashboard'dan sonra çağrılmalı.
    /// </summary>
    public static void RegisterRecurringJobs(IRecurringJobManager manager)
    {
        // Her dakika çalış, timeframe'e göre içeride filtrelenir
        manager.AddOrUpdate<SignalGenerationJob>(
            "signal-generation",
            job => job.ExecuteAsync(CancellationToken.None),
            "* * * * *",
            new RecurringJobOptions { TimeZone = TimeZoneInfo.Utc });

        // Her gün 00:05 UTC'de bakiye snapshot al
        manager.AddOrUpdate<BalanceSnapshotJob>(
            "balance-snapshot",
            job => job.ExecuteAsync(CancellationToken.None),
            "5 0 * * *",
            new RecurringJobOptions { TimeZone = TimeZoneInfo.Utc });

        // Her gün 08:00 UTC'de günlük rapor gönder
        manager.AddOrUpdate<DailyReportJob>(
            "daily-report",
            job => job.ExecuteAsync(CancellationToken.None),
            "0 8 * * *",
            new RecurringJobOptions { TimeZone = TimeZoneInfo.Utc });
    }
}
