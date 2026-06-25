using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Domain.Entities;
using CriptoMoney.Persistence.Context;

namespace CriptoMoney.Persistence.Repositories;

public class UnitOfWork(AppDbContext context) : IUnitOfWork
{
    private IRepository<User>? _users;
    private IRepository<UserBinanceAccount>? _userBinanceAccounts;
    private IRepository<UserWatchlist>? _userWatchlists;
    private IRepository<Coin>? _coins;
    private IRepository<CandleData>? _candleData;
    private IRepository<Indicator>? _indicators;
    private IRepository<UserIndicatorSetting>? _userIndicatorSettings;
    private IRepository<UserStrategy>? _userStrategies;
    private IRepository<TradeSignal>? _tradeSignals;
    private IRepository<TradeOrder>? _tradeOrders;
    private IRepository<Position>? _positions;
    private IRepository<UserRiskSettings>? _userRiskSettings;
    private IRepository<BacktestRun>? _backtestRuns;
    private IRepository<Notification>? _notifications;
    private IRepository<BalanceSnapshot>? _balanceSnapshots;

    public IRepository<User> Users => _users ??= new Repository<User>(context);
    public IRepository<UserBinanceAccount> UserBinanceAccounts => _userBinanceAccounts ??= new Repository<UserBinanceAccount>(context);
    public IRepository<UserWatchlist> UserWatchlists => _userWatchlists ??= new Repository<UserWatchlist>(context);
    public IRepository<Coin> Coins => _coins ??= new Repository<Coin>(context);
    public IRepository<CandleData> CandleData => _candleData ??= new Repository<CandleData>(context);
    public IRepository<Indicator> Indicators => _indicators ??= new Repository<Indicator>(context);
    public IRepository<UserIndicatorSetting> UserIndicatorSettings => _userIndicatorSettings ??= new Repository<UserIndicatorSetting>(context);
    public IRepository<UserStrategy> UserStrategies => _userStrategies ??= new Repository<UserStrategy>(context);
    public IRepository<TradeSignal> TradeSignals => _tradeSignals ??= new Repository<TradeSignal>(context);
    public IRepository<TradeOrder> TradeOrders => _tradeOrders ??= new Repository<TradeOrder>(context);
    public IRepository<Position> Positions => _positions ??= new Repository<Position>(context);
    public IRepository<UserRiskSettings> UserRiskSettings => _userRiskSettings ??= new Repository<UserRiskSettings>(context);
    public IRepository<BacktestRun> BacktestRuns => _backtestRuns ??= new Repository<BacktestRun>(context);
    public IRepository<Notification> Notifications => _notifications ??= new Repository<Notification>(context);
    public IRepository<BalanceSnapshot> BalanceSnapshots => _balanceSnapshots ??= new Repository<BalanceSnapshot>(context);

    public Task<int> CommitAsync(CancellationToken ct = default) => context.SaveChangesAsync(ct);

    public Task RollbackAsync(CancellationToken ct = default)
    {
        context.ChangeTracker.Clear();
        return Task.CompletedTask;
    }

    public async ValueTask DisposeAsync() => await context.DisposeAsync();
}
