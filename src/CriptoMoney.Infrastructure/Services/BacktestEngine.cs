using System.Text.Json;
using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Domain.Entities;
using CriptoMoney.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CriptoMoney.Infrastructure.Services;

public class BacktestEngine(
    IApplicationDbContext db,
    IBinanceService binance,
    IIndicatorRegistry registry,
    ILogger<BacktestEngine> logger) : IBacktestEngine
{
    private const decimal TakerFee = 0.001m; // %0.1 varsayılan komisyon

    public async Task RunAsync(BacktestRun run, CancellationToken ct = default)
    {
        run.Status = BacktestStatus.Running;
        await db.SaveChangesAsync(ct);

        try
        {
            // Strateji konfigürasyonunu oku
            var config = JsonSerializer.Deserialize<BacktestConfig>(run.StrategyConfig)
                ?? new BacktestConfig();

            var coinIds = JsonSerializer.Deserialize<List<int>>(run.CoinIds) ?? [];
            var trades = new List<BacktestTrade>();

            foreach (var coinId in coinIds)
            {
                if (ct.IsCancellationRequested) break;

                var coin = await db.Coins.FindAsync([coinId], ct);
                if (coin is null) continue;

                var coinTrades = await SimulateCoinAsync(run, coin, config, ct);
                trades.AddRange(coinTrades);
            }

            // İstatistikleri hesapla
            ComputeStats(run, trades, config);

            db.BacktestTrades.AddRange(trades);
            run.Status = BacktestStatus.Completed;
            run.CompletedAt = DateTime.UtcNow;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Backtest hatası: RunId={RunId}", run.Id);
            run.Status = BacktestStatus.Failed;
            run.ErrorMessage = $"{ex.GetType().Name}: {ex.Message} | {ex.StackTrace?.Split('\n').FirstOrDefault()?.Trim()}";
        }

        await db.SaveChangesAsync(ct);
    }

    private async Task<List<BacktestTrade>> SimulateCoinAsync(
        BacktestRun run, Coin coin, BacktestConfig config, CancellationToken ct)
    {
        var candleResult = await binance.GetHistoricalCandlesAsync(
            coin.Symbol, run.Timeframe, run.StartDate, run.EndDate, ct);

        if (!candleResult.Succeeded || candleResult.Data is null || candleResult.Data.Count < 50)
        {
            logger.LogWarning("Yetersiz candle verisi: {Symbol}", coin.Symbol);
            return [];
        }

        var allCandles = candleResult.Data
            .Select(c => new CandleInput(c.OpenTime, c.Open, c.High, c.Low, c.Close, c.Volume))
            .ToList();

        var indicators = GetActiveIndicators(config);
        if (indicators.Count == 0) return [];

        // T3 + EMA200 ikisi aktifse PineScript modu
        var useT3Ema200Mode = indicators.Any(x => x.ind.Name.Equals("Tillson", StringComparison.OrdinalIgnoreCase)) &&
                              indicators.Any(x => x.ind.Name.Equals("EMA200",  StringComparison.OrdinalIgnoreCase));

        var trades = new List<BacktestTrade>();
        BacktestTrade? openTrade = null;
        var warmupBars = Math.Max(indicators.Max(i => i.ind.MinCandlesRequired), 203);

        for (var i = warmupBars; i < allCandles.Count; i++)
        {
            if (ct.IsCancellationRequested) break;

            var currentCandle = allCandles[i];
            var currentPrice  = currentCandle.Close;

            if (useT3Ema200Mode)
            {
                var window = allCandles.Take(i + 1).ToList();

                // T3 parametrelerini config'den al
                var t3Cfg    = config.Indicators.FirstOrDefault(x => x.Name.Equals("Tillson", StringComparison.OrdinalIgnoreCase));
                var t3Period = t3Cfg?.Parameters.TryGetValue("Period", out var pp) == true ? int.Parse(pp) : 3;
                var t3Factor = t3Cfg?.Parameters.TryGetValue("Factor", out var ff) == true
                    ? decimal.Parse(ff, System.Globalization.CultureInfo.InvariantCulture) : 0.7m;

                var src    = window.Select(c => (c.High + c.Low + 2m * c.Close) / 4m).ToArray();
                var cls    = window.Select(c => c.Close).ToArray();
                var t3vals = CriptoMoney.Infrastructure.Indicators.TillsonIndicator.ComputeT3(src, t3Period, t3Factor);
                var ema200 = ComputeEma200(cls, 200);

                var t3UpCurr   = t3vals[^1] > t3vals[^2];
                var t3UpPrev   = t3vals[^2] > t3vals[^3];
                var t3TurnUp   = t3UpCurr && !t3UpPrev;
                var t3TurnDown = !t3UpCurr && t3UpPrev;
                var aboveEma   = currentPrice > ema200[^1];

                var buySignal  = t3TurnUp   && aboveEma;
                var sellSignal = t3TurnDown || !aboveEma;

                if (openTrade is not null)
                {
                    var exitReason = CheckExitConditions(openTrade, currentCandle, run, config);
                    if (exitReason.HasValue)
                    {
                        ClosePosition(openTrade, currentPrice, currentCandle.OpenTime, exitReason.Value, run.CommissionRate);
                        openTrade = null;
                        continue;
                    }
                    if (sellSignal)
                    {
                        ClosePosition(openTrade, currentPrice, currentCandle.OpenTime, BacktestExitReason.Signal, run.CommissionRate);
                        openTrade = null;
                    }
                    continue;
                }

                if (buySignal)
                {
                    var quoteQty = CalculatePositionSize(run, trades);
                    if (quoteQty <= 0) continue;
                    openTrade = new BacktestTrade
                    {
                        BacktestRunId = run.Id,
                        CoinId = coin.Id,
                        Side = OrderSide.Buy,
                        EntryTime = currentCandle.OpenTime,
                        EntryPrice = currentPrice,
                        Quantity = quoteQty / currentPrice,
                        Commission = quoteQty * run.CommissionRate,
                        EntryScore = 1m,
                        IndicatorScores = $"{{\"T3\":{t3vals[^1]:F8},\"EMA200\":{ema200[^1]:F8}}}",
                    };
                    trades.Add(openTrade);
                }
                continue;
            }

            // Skor tabanlı mod
            var windowScoring = allCandles.Take(i + 1).ToList();

            if (openTrade is not null)
            {
                var exitReason = CheckExitConditions(openTrade, currentCandle, run, config);
                if (exitReason.HasValue)
                {
                    ClosePosition(openTrade, currentPrice, currentCandle.OpenTime, exitReason.Value, run.CommissionRate);
                    openTrade = null;
                    continue;
                }

                var exitScore = CalculateScore(windowScoring, indicators);
                if (exitScore <= config.SellThreshold)
                {
                    ClosePosition(openTrade, currentPrice, currentCandle.OpenTime, BacktestExitReason.Signal, run.CommissionRate);
                    openTrade = null;
                }
                continue;
            }

            var score = CalculateScore(windowScoring, indicators);

            if (score >= config.BuyThreshold)
            {
                var quoteQty = CalculatePositionSize(run, trades);
                if (quoteQty <= 0) continue;

                var qty = quoteQty / currentPrice;
                var commission = quoteQty * run.CommissionRate;

                openTrade = new BacktestTrade
                {
                    BacktestRunId = run.Id,
                    CoinId = coin.Id,
                    Side = OrderSide.Buy,
                    EntryTime = currentCandle.OpenTime,
                    EntryPrice = currentPrice,
                    Quantity = qty,
                    Commission = commission,
                    EntryScore = Math.Round(score, 4),
                    IndicatorScores = SerializeScores(windowScoring, indicators),
                };
                trades.Add(openTrade);
            }
        }

        // Dönem sonu açık pozisyonu kapat
        if (openTrade is not null && openTrade.ExitTime is null && allCandles.Count > 0)
        {
            var last = allCandles[^1];
            ClosePosition(openTrade, last.Close, last.OpenTime, BacktestExitReason.EndOfData, run.CommissionRate);
        }

        logger.LogInformation("Backtest {Symbol}: {Count} işlem", coin.Symbol, trades.Count);
        return trades;
    }

    private static BacktestExitReason? CheckExitConditions(
        BacktestTrade trade, CandleInput candle, BacktestRun run, BacktestConfig config)
    {
        var stopLossPct = run.StopLossPct ?? config.StopLossPct;
        var takeProfitPct = run.TakeProfitPct ?? config.TakeProfitPct;

        if (stopLossPct.HasValue)
        {
            var stopPrice = trade.EntryPrice * (1 - stopLossPct.Value / 100);
            if (candle.Low <= stopPrice)
                return BacktestExitReason.StopLoss;
        }

        if (takeProfitPct.HasValue)
        {
            var tpPrice = trade.EntryPrice * (1 + takeProfitPct.Value / 100);
            if (candle.High >= tpPrice)
                return BacktestExitReason.TakeProfit;
        }

        return null;
    }

    private static void ClosePosition(
        BacktestTrade trade, decimal exitPrice, DateTime exitTime,
        BacktestExitReason reason, decimal commissionRate)
    {
        trade.ExitTime = exitTime;
        trade.ExitPrice = exitPrice;
        trade.ExitReason = reason;

        var exitValue = trade.Quantity * exitPrice;
        var exitCommission = exitValue * commissionRate;
        trade.Commission += exitCommission;

        var entryValue = trade.Quantity * trade.EntryPrice;
        trade.PnlUsdt = exitValue - entryValue - trade.Commission;
        trade.PnlPct = trade.PnlUsdt / entryValue * 100;
    }

    private static void ComputeStats(BacktestRun run, List<BacktestTrade> trades, BacktestConfig config)
    {
        var closed = trades.Where(t => t.ExitTime.HasValue).ToList();

        run.TotalTrades = closed.Count;
        if (closed.Count == 0)
        {
            run.FinalCapital = run.InitialCapital;
            run.NetPnl = 0;
            run.NetPnlPct = 0;
            run.WinRate = 0;
            return;
        }

        var winCount = closed.Count(t => t.PnlUsdt > 0);
        run.WinningTrades = winCount;
        run.WinRate = closed.Count > 0 ? (decimal)winCount / closed.Count * 100 : 0;

        var totalPnl = closed.Sum(t => t.PnlUsdt ?? 0);
        run.NetPnl = Math.Round(totalPnl, 2);
        run.NetPnlPct = Math.Round(totalPnl / run.InitialCapital * 100, 2);
        run.FinalCapital = run.InitialCapital + totalPnl;

        // Max drawdown (equity curve bazlı)
        run.MaxDrawdown = ComputeMaxDrawdown(run.InitialCapital, closed);

        // Sharpe Ratio (basit: aylık bazlı)
        run.SharpeRatio = ComputeSharpeRatio(closed);
    }

    private static decimal[] ComputeEma200(decimal[] closes, int period)
    {
        var ema = new decimal[closes.Length];
        var k = 2m / (period + 1);
        var sum = 0m;
        for (var i = 0; i < period; i++) sum += closes[i];
        ema[period - 1] = sum / period;
        for (var i = period; i < closes.Length; i++)
            ema[i] = closes[i] * k + ema[i - 1] * (1 - k);
        return ema;
    }

    private static decimal ComputeMaxDrawdown(decimal initialCapital, List<BacktestTrade> trades)
    {
        var peak = initialCapital;
        var maxDd = 0m;
        var equity = initialCapital;

        foreach (var t in trades.OrderBy(t => t.ExitTime))
        {
            equity += t.PnlUsdt ?? 0;
            if (equity > peak) peak = equity;
            var dd = (peak - equity) / peak * 100;
            if (dd > maxDd) maxDd = dd;
        }

        return Math.Round(maxDd, 2);
    }

    private static decimal ComputeSharpeRatio(List<BacktestTrade> trades)
    {
        if (trades.Count < 2) return 0;

        var returns = trades
            .Where(t => t.PnlPct.HasValue)
            .Select(t => t.PnlPct!.Value)
            .ToList();

        if (returns.Count < 2) return 0;

        var avg = returns.Average();
        var variance = returns.Select(r => (r - avg) * (r - avg)).Average();
        var stdDev = (decimal)Math.Sqrt((double)variance);

        return stdDev == 0 ? 0 : Math.Round(avg / stdDev, 2);
    }

    private static decimal CalculatePositionSize(BacktestRun run, List<BacktestTrade> openTrades)
    {
        // Her işlem için initialCapital / maxConcurrent oranında sermaye kullan
        return Math.Round(run.InitialCapital / 10m, 2); // %10 per position
    }

    private static decimal CalculateScore(
        List<CandleInput> window,
        List<(IIndicator ind, decimal weight, Dictionary<string, string> parameters)> indicators)
    {
        var totalScore = 0m;
        var totalWeight = 0m;

        foreach (var (ind, weight, parameters) in indicators)
        {
            if (window.Count < ind.MinCandlesRequired) continue;
            try
            {
                var result = ind.Calculate(window, parameters);
                totalScore += result.Score * weight;
                totalWeight += weight;
            }
            catch { /* devam et */ }
        }

        return totalWeight > 0 ? totalScore / totalWeight : 0;
    }

    private static string SerializeScores(
        List<CandleInput> window,
        List<(IIndicator ind, decimal weight, Dictionary<string, string> parameters)> indicators)
    {
        var scores = new Dictionary<string, decimal>();
        foreach (var (ind, _, parameters) in indicators)
        {
            if (window.Count < ind.MinCandlesRequired) continue;
            try { scores[ind.Name] = ind.Calculate(window, parameters).Score; }
            catch { }
        }
        return JsonSerializer.Serialize(scores);
    }

    private List<(IIndicator ind, decimal weight, Dictionary<string, string> parameters)> GetActiveIndicators(
        BacktestConfig config)
    {
        var result = new List<(IIndicator, decimal, Dictionary<string, string>)>();

        foreach (var ic in config.Indicators)
        {
            var ind = registry.Resolve(ic.Name);
            if (ind is null) continue;
            result.Add((ind, ic.Weight, ic.Parameters));
        }

        // Hiç yapılandırılmamışsa varsayılan: EMA200 + Tillson
        if (result.Count == 0)
        {
            var ema = registry.Resolve("EMA200");
            var t3 = registry.Resolve("Tillson");
            if (ema is not null) result.Add((ema, 2.0m, new() { ["Period"] = "200" }));
            if (t3 is not null) result.Add((t3, 1.5m, new() { ["Period"] = "5", ["Factor"] = "0.7" }));
        }

        return result;
    }
}

/// <summary>
/// Backtest'e gönderilen JSON konfigürasyon modeli (BacktestRun.StrategyConfig içinde saklanır).
/// </summary>
public class BacktestConfig
{
    public decimal BuyThreshold { get; set; } = 1.0m;
    public decimal SellThreshold { get; set; } = -1.0m;
    public decimal? StopLossPct { get; set; } = 3.0m;
    public decimal? TakeProfitPct { get; set; } = 6.0m;
    public List<BacktestIndicatorConfig> Indicators { get; set; } = [];
}

public class BacktestIndicatorConfig
{
    public string Name { get; set; } = string.Empty;
    public decimal Weight { get; set; } = 1.0m;
    public Dictionary<string, string> Parameters { get; set; } = [];
}
