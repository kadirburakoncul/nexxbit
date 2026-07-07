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

        // Backend'in SignalEngine'de kullandığı T3 ayarlarını yükle (period, vFactor)
        // Böylece frontend aynı T3 eğrisini çizer — görsel tutarsızlık ortadan kalkar
        var t3Setting = await db.UserIndicatorSettings
            .Include(s => s.Indicator)
            .Include(s => s.ParameterValues)
                .ThenInclude(v => v.ParameterDefinition)
            .Where(s => s.UserId == request.UserId && s.IsEnabled && s.CoinId == null
                && (s.Indicator.Name == "Tillson" || s.Indicator.Name == "TillsonT3"
                    || s.Indicator.Name == "Level1"))
            .FirstOrDefaultAsync(cancellationToken);

        var isLevel1 = t3Setting?.Indicator.Name.Equals("Level1", StringComparison.OrdinalIgnoreCase) == true;
        var t3Params = t3Setting?.ParameterValues
            .ToDictionary(v => v.ParameterDefinition.ParameterKey, v => v.Value, StringComparer.OrdinalIgnoreCase)
            ?? new Dictionary<string, string>();

        var t3Period = t3Params.TryGetValue("Period", out var pStr) && int.TryParse(pStr, out var pInt)
            ? pInt : (isLevel1 ? 5 : 3);
        var t3VFactor = t3Params.TryGetValue("Factor", out var fStr)
            && decimal.TryParse(fStr, System.Globalization.NumberStyles.Any,
                System.Globalization.CultureInfo.InvariantCulture, out var fDec)
            ? fDec : 0.7m;

        var strategyIds = strategies.Select(s => s.Id).ToList();
        var coinIds = strategies.SelectMany(s => s.StrategyCoins.Select(sc => sc.CoinId)).Distinct().ToList();

        // Son sinyaller — son 30 günü sorgula (daha eskisi monitörde anlamsız eski tarih gösterir)
        var signalCutoff = DateTime.UtcNow.AddDays(-30);
        var allLastSignals = await db.TradeSignals
            .Where(ts => strategyIds.Contains(ts.StrategyId) && coinIds.Contains(ts.CoinId)
                && ts.CandleTime >= signalCutoff)
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

            return new StrategyMonitorDto(
                strategy.Id, strategy.Name, strategy.Timeframe, coins,
                strategy.IsRsiFilterEnabled,
                strategy.IsVolumeSurgeFilterEnabled,
                strategy.VolumeSurgeMultiplier,
                strategy.MinVolumeUsdt,
                strategy.UseMarketRegimeFilter,
                t3Period,
                t3VFactor,
                strategy.ActivatedAt
            );
        }).ToList();

        return Result<List<StrategyMonitorDto>>.Success(result);
    }
}
