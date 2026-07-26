using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Domain.Entities;
using CriptoMoney.Domain.Enums;
using CriptoMoney.Infrastructure.Indicators;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CriptoMoney.BackgroundJobs.Jobs;

/// <summary>
/// Her kullanıcının aktif BistStrategy'lerini kendi T3/RSI parametreleriyle tarar —
/// kripto sinyal motoruna (SignalEngine, AutoTradeService, Position) hiç bağlı değil.
///
/// BIST modülü EMİR GÖNDERMEZ. Sinyal üretir ve kağıt üzerinde pozisyon takibi yapar;
/// gerçek alım/satımı kullanıcı kendi aracı kurumunda gerçekleştirir.
///
/// Günlük periyot için gün içinde bar değişmediğinden tarama kapanış sonrası
/// günde bir kez yapılır (bkz. DependencyInjection cron ayarı).
/// </summary>
public class BistSignalScanJob(
    IApplicationDbContext db,
    IBistDataService bistData,
    ILogger<BistSignalScanJob> logger)
{
    /// <summary>BIST alım+satım komisyon/vergi yaklaşık gidiş-dönüş oranı.</summary>
    private const decimal RoundTripFeePct = 0.2m;

    public async Task ExecuteAsync(CancellationToken ct = default)
    {
        var strategies = await db.BistStrategies
            .Include(s => s.StrategyStocks)
                .ThenInclude(ss => ss.BistStock)
            .Where(s => s.IsActive)
            .ToListAsync(ct);

        if (strategies.Count == 0)
        {
            logger.LogDebug("BIST: aktif strateji yok.");
            return;
        }

        // Gün içi periyotlarda seans dışında tarama anlamsız; günlükte kapanış
        // sonrası çalıştığı için seans kontrolü uygulanmaz.
        var intraday = strategies.Any(s => s.Timeframe != "1d" && s.Timeframe != "1wk");
        if (intraday && !IsWithinTradingHours(DateTime.UtcNow))
        {
            logger.LogDebug("BIST seans dışı — gün içi stratejiler atlandı.");
            return;
        }

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
                : new BistIndicatorSetting { UserId = strategy.UserId }; // varsayılanlar

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
        BistStrategy strategy,
        BistStrategyStock strategyStock,
        BistIndicatorSetting settings,
        CancellationToken ct)
    {
        var symbol = strategyStock.BistStock.Symbol;
        var stockId = strategyStock.BistStockId;

        // EMA200 filtresi için 200 bar + T3 ısınması gerekiyor
        var needed = Math.Max(settings.T3Period * 6 + 5, strategy.UseEma200Filter ? 210 : 40);
        var candleResult = await bistData.GetCandlesAsync(symbol, strategy.Timeframe, 400, ct);

        if (!candleResult.Succeeded || candleResult.Data is null || candleResult.Data.Count < needed)
        {
            strategyStock.LastCheckedAt = DateTime.UtcNow;
            strategyStock.LastCheckedReason =
                $"Yetersiz veri ({candleResult.Data?.Count ?? 0}/{needed})";
            return;
        }

        var candles = candleResult.Data;

        // T3 kaynağı kripto tarafıyla aynı: (H + L + 2C) / 4.
        // Yalnızca close kullanmak gün içi aralığı yok sayıyordu.
        var src = candles.Select(c => (c.High + c.Low + 2m * c.Close) / 4m).ToArray();
        var closes = candles.Select(c => c.Close).ToArray();
        var t3 = TillsonIndicator.ComputeT3(src, settings.T3Period, settings.T3Factor);

        var lastClosedCandle = candles[^2];   // [^1] = devam eden bar
        var lastClosedPrice  = lastClosedCandle.Close;

        strategyStock.LastPrice = lastClosedPrice;
        strategyStock.LastPriceAt = DateTime.UtcNow;
        strategyStock.LastT3 = Math.Round(t3[^1], 4);
        strategyStock.LastT3UpDirection = t3[^2] > t3[^3];
        strategyStock.LastCheckedAt = DateTime.UtcNow;

        // Açık pozisyon varsa önce çıkış kurallarını uygula
        var openPosition = strategy.IsPositionTrackingEnabled
            ? await db.BistPositions.FirstOrDefaultAsync(p =>
                p.BistStrategyId == strategy.Id && p.BistStockId == stockId &&
                p.Status == PositionStatus.Open, ct)
            : null;

        if (openPosition is not null &&
            await TryCloseAsync(openPosition, strategy, candles, lastClosedPrice, symbol, ct))
        {
            strategyStock.LastCheckedReason = $"Pozisyon kapatıldı: {openPosition.CloseReason}";
            return;
        }

        var t3TurnUp   = t3[^3] > t3[^4] && !(t3[^4] > t3[^5]) && t3[^2] > t3[^3];
        var t3TurnDown = !(t3[^3] > t3[^4]) && t3[^4] > t3[^5]  && !(t3[^2] > t3[^3]);

        if (!t3TurnUp && !t3TurnDown)
        {
            strategyStock.LastCheckedReason = t3[^2] > t3[^3]
                ? "T3 yükseliyor — 2-bar konfirmasyon yok"
                : "T3 düşüyor — 2-bar konfirmasyon yok";
            return;
        }

        // EMA200 trend filtresi — fiyat uzun vadeli ortalamanın üstünde olmalı.
        // 20 hisse × 2 yıl backtestinde tek başına en büyük fark bu filtreden geldi.
        if (t3TurnUp && strategy.UseEma200Filter)
        {
            var ema200 = TechnicalUtils.ComputeEma(closes, 200);
            var emaLast = ema200[^2];
            if (emaLast <= 0 || lastClosedPrice < emaLast)
            {
                strategyStock.LastCheckedReason =
                    $"AL sinyali var ama fiyat {lastClosedPrice:F2} < EMA200 {emaLast:F2} — trend aşağı, bloklandı";
                return;
            }
        }

        // RSI filtresi — sadece AL sinyalini onaylamak için
        if (t3TurnUp && strategy.IsRsiFilterEnabled)
        {
            var rsi = RsiIndicator.ComputeRsi(closes, strategy.RsiPeriod);
            var rsiValue = Math.Round(rsi[^2], 2);
            if (rsiValue < strategy.RsiBuyThreshold)
            {
                strategyStock.LastCheckedReason =
                    $"T3 yukarı döndü ama RSI {rsiValue:F1} < {strategy.RsiBuyThreshold:F0} — AL bloklandı";
                return;
            }
        }

        var direction = t3TurnUp ? SignalDirection.Buy : SignalDirection.Sell;
        strategyStock.LastCheckedReason = t3TurnUp ? "AL sinyali üretildi" : "SAT sinyali üretildi";

        // T3 SAT sinyali: açık pozisyon varsa kapat
        if (direction == SignalDirection.Sell && openPosition is not null)
            ClosePosition(openPosition, lastClosedPrice, "T3 SAT sinyali", symbol);

        var alreadyExists = await db.BistSignals.AnyAsync(sig =>
            sig.BistStrategyId == strategy.Id &&
            sig.BistStockId == stockId &&
            sig.CandleTime == lastClosedCandle.OpenTime, ct);
        if (alreadyExists) return;

        db.BistSignals.Add(new BistSignal
        {
            UserId = strategy.UserId,
            BistStrategyId = strategy.Id,
            BistStockId = stockId,
            Direction = direction,
            Price = lastClosedPrice,
            CandleTime = lastClosedCandle.OpenTime,
            Reason = strategyStock.LastCheckedReason,
        });

        // AL sinyali: kağıt üzerinde pozisyon aç (takip için)
        if (direction == SignalDirection.Buy && strategy.IsPositionTrackingEnabled && openPosition is null)
        {
            db.BistPositions.Add(new BistPosition
            {
                UserId = strategy.UserId,
                BistStrategyId = strategy.Id,
                BistStockId = stockId,
                EntryPrice = lastClosedPrice,
                EntryCandleTime = lastClosedCandle.OpenTime,
                OpenedAt = DateTime.UtcNow,
                PeakPrice = lastClosedPrice,
                PeakPriceAt = DateTime.UtcNow,
                StopLossPrice = strategy.StopLossPct > 0
                    ? lastClosedPrice * (1 - strategy.StopLossPct / 100m)
                    : null,
                Status = PositionStatus.Open,
            });
        }

        logger.LogInformation("BIST sinyal: {Symbol} {Direction} @ {Price:F2} StrategyId={Id}",
            symbol, direction, lastClosedPrice, strategy.Id);
    }

    /// <summary>
    /// Stop-loss / trailing stop kontrolü. Kapatıldıysa true döner.
    /// Bar içi en düşük/en yüksek kullanılır — sadece kapanışa bakmak
    /// gün içinde tetiklenen stopları kaçırırdı.
    /// </summary>
    private async Task<bool> TryCloseAsync(
        BistPosition position, BistStrategy strategy,
        List<BistCandle> candles,
        decimal lastClosedPrice, string symbol, CancellationToken ct)
    {
        await Task.CompletedTask;

        // Son kapanmış bardan bu yana zirveyi güncelle
        var lastBar = candles[^2];
        if (lastBar.High > position.PeakPrice)
        {
            position.PeakPrice = lastBar.High;
            position.PeakPriceAt = DateTime.UtcNow;
        }

        if (strategy.StopLossPct > 0 && position.StopLossPrice.HasValue
            && lastBar.Low <= position.StopLossPrice.Value)
        {
            ClosePosition(position, position.StopLossPrice.Value, "StopLoss", symbol);
            return true;
        }

        // Trailing yalnızca kâr eşiği aşıldıktan sonra devreye girer.
        // Eşiksiz haliyle zirve girişi bir tık geçtiğinde tetik giriş fiyatına
        // yapışıyor ve ilk geri çekilmede pozisyon başabaşta kapanıyordu.
        var activationPrice = position.EntryPrice * (1 + strategy.TrailingActivationPct / 100m);
        if (strategy.TrailingStopPct > 0 && position.PeakPrice >= activationPrice)
        {
            var trigger = position.PeakPrice * (1 - strategy.TrailingStopPct / 100m);
            // Taban: trailing asla girişin altında satmasın (komisyon dahil)
            trigger = Math.Max(trigger, position.EntryPrice * (1 + RoundTripFeePct / 100m));

            if (lastBar.Low <= trigger)
            {
                ClosePosition(position, trigger, "TrailingStop", symbol);
                return true;
            }
        }

        return false;
    }

    private void ClosePosition(BistPosition position, decimal price, string reason, string symbol)
    {
        position.Status = PositionStatus.Closed;
        position.ClosePrice = price;
        position.ClosedAt = DateTime.UtcNow;
        position.CloseReason = reason;
        position.RealizedPnlPct = position.EntryPrice > 0
            ? Math.Round((price - position.EntryPrice) / position.EntryPrice * 100m - RoundTripFeePct, 4)
            : 0m;

        logger.LogInformation("BIST pozisyon kapandı ({Reason}): {Symbol} giriş={Entry:F2} çıkış={Exit:F2} net={Pnl:F2}%",
            reason, symbol, position.EntryPrice, price, position.RealizedPnlPct);
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
