using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.BackgroundJobs.Jobs;
using CriptoMoney.BackgroundJobs.Services;
using Hangfire;
using Hangfire.MemoryStorage;
using Hangfire.MySql;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace CriptoMoney.BackgroundJobs;

public static class DependencyInjection
{
    public static IServiceCollection AddBackgroundJobs(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connStr = configuration.GetConnectionString("DefaultConnection");

        services.AddHangfire(config =>
        {
            config
                .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
                .UseSimpleAssemblyNameTypeSerializer()
                .UseRecommendedSerializerSettings();

            if (!string.IsNullOrEmpty(connStr))
            {
                try
                {
                    config.UseStorage(new MySqlStorage(connStr, new MySqlStorageOptions
                    {
                        TablesPrefix = "Hangfire_",
                        PrepareSchemaIfNecessary = true,
                        QueuePollInterval = TimeSpan.FromSeconds(15),
                    }));
                }
                catch
                {
                    config.UseMemoryStorage();
                }
            }
            else
            {
                config.UseMemoryStorage();
            }
        });

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

    public static void RegisterRecurringJobs(IRecurringJobManager manager)
    {
        manager.AddOrUpdate<SignalGenerationJob>(
            "signal-generation",
            job => job.ExecuteAsync(CancellationToken.None),
            "* * * * *",
            new RecurringJobOptions { TimeZone = TimeZoneInfo.Utc });


        manager.AddOrUpdate<BalanceSnapshotJob>(
            "balance-snapshot",
            job => job.ExecuteAsync(CancellationToken.None),
            "5 0 * * *",
            new RecurringJobOptions { TimeZone = TimeZoneInfo.Utc });

        manager.AddOrUpdate<DailyReportJob>(
            "daily-report",
            job => job.ExecuteAsync(CancellationToken.None),
            "0 8 * * *",
            new RecurringJobOptions { TimeZone = TimeZoneInfo.Utc });
    }
}
