using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Domain.Entities;
using CriptoMoney.Domain.Enums;
using CriptoMoney.Infrastructure.Indicators;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CriptoMoney.BackgroundJobs.Jobs;

/// <summary>
/// Her kullanıcının aktif BistStrategy'lerini, o kullanıcının kendi BistIndicatorSetting
/// (T3 period/factor, opsiyonel RSI filtresi) parametreleriyle tarar — kripto sinyal motoruna
/// (SignalEngine, AutoTradeService, Position) hiç bağlı değil, tamamen bağımsız.
/// Sadece BIST işlem saatlerinde (10:00-18:10 TRT, hafta içi) çalışır.
/// </summary>
public class BistSignalScanJob(
    IApplicationDbContext db,
    IBistDataService bistData,
    ILogger<BistSignalScanJob> logger)
{
    public async Task ExecuteAsync(CancellationToken ct = default)
    {
        if (!IsWithinTradingHours(DateTime.UtcNow))
        {
            logger.LogDebug("BIST seans dışı — tarama atlandı.");
            return;
        }

        var strategies = await db.BistStrategies
            .Include(s => s.StrategyStocks)
                .ThenInclude(ss => ss.BistStock)
            .Where(s => s.IsActive)
            .ToListAsync(ct);

        if (strategies.Count == 0) return;

        var userIds = strategies.Select(s => s.UserId).Distinct().ToList();
        var settingsByUser = await db.BistIndicatorSettings
            .Where(s => userIds.Contains(s.UserId))
            .ToDictionaryAsync(s => s.UserId, ct);

        logger.LogInformation("BIST sinyal taraması başladı: {Count} aktif strateji", strategies.Count);

        foreach (var strategy in strategies)
        {
            if (ct.IsCancellationRequested) break;

            var settings = settingsByUser.TryGetValue(strategy.UserId, out var s)
                ? s
                : new Domain.Entities.BistIndicatorSetting { UserId = strategy.UserId }; // varsayılanlar

            foreach (var strategyStock in strategy.StrategyStocks)
            {
                if (ct.IsCancellationRequested) break;
                try
                {
                    await ScanAsync(strategy, strategyStock, settings, ct);
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "BIST tarama hatası: {Symbol} StrategyId={Id}",
                        strategyStock.BistStock.Symbol, strategy.Id);
                }
            }
        }

        await db.SaveChangesAsync(ct);
        logger.LogInformation("BIST sinyal taraması tamamlandı.");
    }

    private async Task ScanAsync(
        Domain.Entities.BistStrategy strategy,
        Domain.Entities.BistStrategyStock strategyStock,
        Domain.Entities.BistIndicatorSetting settings,
        CancellationToken ct)
    {
        var symbol = strategyStock.BistStock.Symbol;
        var candleResult = await bistData.GetCandlesAsync(symbol, strategy.Timeframe, 200, ct);
        if (!candleResult.Succeeded || candleResult.Data is null || candleResult.Data.Count < settings.T3Period * 6 + 5)
        {
            strategyStock.LastCheckedAt = DateTime.UtcNow;
            strategyStock.LastCheckedReason = "Yetersiz veri";
            return;
        }

        var candles = candleResult.Data;
        var closes = candles.Select(c => c.Close).ToArray();
        var t3 = TillsonIndicator.ComputeT3(closes, settings.T3Period, settings.T3Factor);

        var t3TurnUp   = t3[^3] > t3[^4] && !(t3[^4] > t3[^5]) && t3[^2] > t3[^3];
        var t3TurnDown = !(t3[^3] > t3[^4]) && t3[^4] > t3[^5]  && !(t3[^2] > t3[^3]);

        var lastClosedCandle = candles[^2];
        var lastClosedPrice  = lastClosedCandle.Close;

        strategyStock.LastPrice = lastClosedPrice;
        strategyStock.LastPriceAt = DateTime.UtcNow;
        strategyStock.LastT3 = Math.Round(t3[^1], 4);
        strategyStock.LastT3UpDirection = t3[^2] > t3[^3];
        strategyStock.LastCheckedAt = DateTime.UtcNow;

        if (!t3TurnUp && !t3TurnDown)
        {
            strategyStock.LastCheckedReason = t3[^2] > t3[^3] ? "T3 yükseliyor — 2-bar konfirmasyon yok" : "T3 düşüyor — 2-bar konfirmasyon yok";
            return;
        }

        // Strateji düzeyinde RSI filtresi — sadece AL sinyalini onaylamak için
        var rsiEnabled = strategy.IsRsiFilterEnabled;
        if (t3TurnUp && rsiEnabled)
        {
            var rsi = RsiIndicator.ComputeRsi(closes, strategy.RsiPeriod);
            var rsiValue = Math.Round(rsi[^2], 2);
            if (rsiValue < strategy.RsiBuyThreshold)
            {
                strategyStock.LastCheckedReason = $"T3 yukarı döndü ama RSI {rsiValue:F1} < {strategy.RsiBuyThreshold:F0} — AL bloklandı";
                return;
            }
        }

        var direction = t3TurnUp ? SignalDirection.Buy : SignalDirection.Sell;
        strategyStock.LastCheckedReason = t3TurnUp ? "AL sinyali üretildi" : "SAT sinyali üretildi";

        var alreadyExists = await db.BistSignals.AnyAsync(sig =>
            sig.BistStrategyId == strategy.Id &&
            sig.BistStockId == strategyStock.BistStockId &&
            sig.CandleTime == lastClosedCandle.OpenTime, ct);
        if (alreadyExists) return;

        db.BistSignals.Add(new Domain.Entities.BistSignal
        {
            UserId = strategy.UserId,
            BistStrategyId = strategy.Id,
            BistStockId = strategyStock.BistStockId,
            Direction = direction,
            Price = lastClosedPrice,
            CandleTime = lastClosedCandle.OpenTime,
            Reason = strategyStock.LastCheckedReason,
        });

        logger.LogInformation("BIST sinyal: {Symbol} {Direction} @ {Price:F2} StrategyId={Id}",
            symbol, direction, lastClosedPrice, strategy.Id);
    }

    /// <summary>BIST seansı: 10:00-18:10 TRT (UTC+3), hafta içi. TRT'de DST uygulanmıyor.</summary>
    private static bool IsWithinTradingHours(DateTime utcNow)
    {
        var trt = utcNow.AddHours(3);
        if (trt.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday) return false;
        var minutesOfDay = trt.Hour * 60 + trt.Minute;
        return minutesOfDay >= 10 * 60 && minutesOfDay <= 18 * 60 + 10;
    }
}
