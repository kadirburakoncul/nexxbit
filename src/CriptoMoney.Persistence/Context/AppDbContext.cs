using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace CriptoMoney.Persistence.Context;

public class AppDbContext(DbContextOptions<AppDbContext> options)
    : DbContext(options), IApplicationDbContext
{
    public DbSet<User> Users => Set<User>();
    public DbSet<UserBinanceAccount> UserBinanceAccounts => Set<UserBinanceAccount>();
    public DbSet<UserWatchlist> UserWatchlists => Set<UserWatchlist>();
    public DbSet<Coin> Coins => Set<Coin>();
    public DbSet<CandleData> CandleData => Set<CandleData>();
    public DbSet<Indicator> Indicators => Set<Indicator>();
    public DbSet<IndicatorParameterDefinition> IndicatorParameterDefinitions => Set<IndicatorParameterDefinition>();
    public DbSet<UserIndicatorSetting> UserIndicatorSettings => Set<UserIndicatorSetting>();
    public DbSet<UserIndicatorParameterValue> UserIndicatorParameterValues => Set<UserIndicatorParameterValue>();
    public DbSet<UserIndicatorSubscription> UserIndicatorSubscriptions => Set<UserIndicatorSubscription>();
    public DbSet<UserStrategy> UserStrategies => Set<UserStrategy>();
    public DbSet<UserStrategyCoin> UserStrategyCoins => Set<UserStrategyCoin>();
    public DbSet<TradeSignal> TradeSignals => Set<TradeSignal>();
    public DbSet<TradeOrder> TradeOrders => Set<TradeOrder>();
    public DbSet<Position> Positions => Set<Position>();
    public DbSet<UserRiskSettings> UserRiskSettings => Set<UserRiskSettings>();
    public DbSet<BacktestRun> BacktestRuns => Set<BacktestRun>();
    public DbSet<BacktestTrade> BacktestTrades => Set<BacktestTrade>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<BalanceSnapshot> BalanceSnapshots => Set<BalanceSnapshot>();
    public DbSet<SystemLog> SystemLogs => Set<SystemLog>();
    public DbSet<ApiRequestLog> ApiRequestLogs => Set<ApiRequestLog>();
    public DbSet<SystemConfig> SystemConfigs => Set<SystemConfig>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        foreach (var entry in ChangeTracker.Entries<Domain.Entities.BaseEntity>())
        {
            if (entry.State == EntityState.Modified)
                entry.Entity.UpdatedAt = DateTime.UtcNow;
        }

        return base.SaveChangesAsync(cancellationToken);
    }
}
