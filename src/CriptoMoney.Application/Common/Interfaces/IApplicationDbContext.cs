using CriptoMoney.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace CriptoMoney.Application.Common.Interfaces;

public interface IApplicationDbContext
{
    DbSet<User> Users { get; }
    DbSet<UserBinanceAccount> UserBinanceAccounts { get; }
    DbSet<UserWatchlist> UserWatchlists { get; }
    DbSet<Coin> Coins { get; }
    DbSet<CandleData> CandleData { get; }
    DbSet<Indicator> Indicators { get; }
    DbSet<IndicatorParameterDefinition> IndicatorParameterDefinitions { get; }
    DbSet<UserIndicatorSetting> UserIndicatorSettings { get; }
    DbSet<UserIndicatorParameterValue> UserIndicatorParameterValues { get; }
    DbSet<UserIndicatorSubscription> UserIndicatorSubscriptions { get; }
    DbSet<UserStrategy> UserStrategies { get; }
    DbSet<UserStrategyCoin> UserStrategyCoins { get; }
    DbSet<TradeSignal> TradeSignals { get; }
    DbSet<TradeOrder> TradeOrders { get; }
    DbSet<Position> Positions { get; }
    DbSet<UserRiskSettings> UserRiskSettings { get; }
    DbSet<BacktestRun> BacktestRuns { get; }
    DbSet<BacktestTrade> BacktestTrades { get; }
    DbSet<Notification> Notifications { get; }
    DbSet<BalanceSnapshot> BalanceSnapshots { get; }
    DbSet<SystemLog> SystemLogs { get; }
    DbSet<ApiRequestLog> ApiRequestLogs { get; }
    DbSet<SystemConfig> SystemConfigs { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
