using CriptoMoney.Domain.Entities;

namespace CriptoMoney.Application.Common.Interfaces;

public interface IUnitOfWork : IAsyncDisposable
{
    IRepository<User> Users { get; }
    IRepository<UserBinanceAccount> UserBinanceAccounts { get; }
    IRepository<UserWatchlist> UserWatchlists { get; }
    IRepository<Coin> Coins { get; }
    IRepository<CandleData> CandleData { get; }
    IRepository<Indicator> Indicators { get; }
    IRepository<UserIndicatorSetting> UserIndicatorSettings { get; }
    IRepository<UserStrategy> UserStrategies { get; }
    IRepository<TradeSignal> TradeSignals { get; }
    IRepository<TradeOrder> TradeOrders { get; }
    IRepository<Position> Positions { get; }
    IRepository<UserRiskSettings> UserRiskSettings { get; }
    IRepository<BacktestRun> BacktestRuns { get; }
    IRepository<Notification> Notifications { get; }
    IRepository<BalanceSnapshot> BalanceSnapshots { get; }

    Task<int> CommitAsync(CancellationToken ct = default);
    Task RollbackAsync(CancellationToken ct = default);
}
