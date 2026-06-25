using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using CriptoMoney.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CriptoMoney.Application.Features.Strategy.Queries.GetStrategyMonitor;

public class GetStrategyMonitorQueryHandler(IApplicationDbContext db)
    : IRequestHandler<GetStrategyMonitorQuery, Result<List<StrategyMonitorDto>>>
{
    public async Task<Result<List<StrategyMonitorDto>>> Handle(
        GetStrategyMonitorQuery request, CancellationToken cancellationToken)
    {
        var strategies = await db.UserStrategies
            .Include(s => s.StrategyCoins)
                .ThenInclude(sc => sc.Coin)
            .Where(s => s.UserId == request.UserId && s.IsActive)
            .ToListAsync(cancellationToken);

        if (strategies.Count == 0)
            return Result<List<StrategyMonitorDto>>.Success([]);

        var strategyIds = strategies.Select(s => s.Id).ToList();
        var coinIds = strategies.SelectMany(s => s.StrategyCoins.Select(sc => sc.CoinId)).Distinct().ToList();

        // Son sinyaller — her strateji+coin çifti için en son, son AL ve son SAT ayrı ayrı
        var allLastSignals = await db.TradeSignals
            .Where(ts => strategyIds.Contains(ts.StrategyId) && coinIds.Contains(ts.CoinId))
            .OrderByDescending(ts => ts.CandleTime)
            .ToListAsync(cancellationToken);

        // En son genel sinyal
        var signalMap = allLastSignals
            .GroupBy(ts => (ts.StrategyId, ts.CoinId))
            .ToDictionary(g => g.Key, g => g.First());

        // En son AL sinyali
        var lastBuyMap = allLastSignals
            .Where(ts => ts.Direction == SignalDirection.Buy)
            .GroupBy(ts => (ts.StrategyId, ts.CoinId))
            .ToDictionary(g => g.Key, g => g.First());

        // En son SAT sinyali
        var lastSellMap = allLastSignals
            .Where(ts => ts.Direction == SignalDirection.Sell || ts.Direction == SignalDirection.StrongSell)
            .GroupBy(ts => (ts.StrategyId, ts.CoinId))
            .ToDictionary(g => g.Key, g => g.First());

        // Açık pozisyonlar
        var openPositions = await db.Positions
            .Where(p => p.UserId == request.UserId && p.Status == PositionStatus.Open && coinIds.Contains(p.CoinId))
            .Select(p => p.CoinId)
            .ToListAsync(cancellationToken);

        var openCoinSet = openPositions.ToHashSet();

        var result = strategies.Select(strategy =>
        {
            var coins = strategy.StrategyCoins.Select(sc =>
            {
                signalMap.TryGetValue((strategy.Id, sc.CoinId), out var sig);
                lastBuyMap.TryGetValue((strategy.Id, sc.CoinId), out var lastBuy);
                lastSellMap.TryGetValue((strategy.Id, sc.CoinId), out var lastSell);
                return new CoinMonitorDto(
                    sc.CoinId,
                    sc.Coin?.Symbol ?? string.Empty,
                    (int)sc.ReEntryState,
                    openCoinSet.Contains(sc.CoinId),
                    sig?.CandleTime,
                    sig?.Direction.ToString(),
                    sig?.Price,
                    sc.LastCheckedAt,
                    sc.LastCheckedPrice,
                    sc.LastCheckedReason,
                    lastBuy?.Price,
                    lastBuy?.CandleTime,
                    lastSell?.Price,
                    lastSell?.CandleTime
                );
            }).ToList();

            return new StrategyMonitorDto(strategy.Id, strategy.Name, strategy.Timeframe, coins);
        }).ToList();

        return Result<List<StrategyMonitorDto>>.Success(result);
    }
}
