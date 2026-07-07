using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Domain.Entities;
using CriptoMoney.Domain.Enums;
using CriptoMoney.Application.Common.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace CriptoMoney.Infrastructure.Services;

/// <summary>
/// Açık pozisyonları 2 saniyede bir izler.
/// Değişiklikler: bulk price fetch (N+1→1), partial TP, race condition guard, daily loss güncelleme.
/// </summary>
public class TrailingStopMonitorService(
    IServiceScopeFactory scopeFactory,
    ITelegramService telegram,
    ILogger<TrailingStopMonitorService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("TrailingStopMonitorService başladı.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CheckPositionsAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "TrailingStopMonitorService hatası");
            }

            await Task.Delay(TimeSpan.FromSeconds(2), stoppingToken);
        }
    }

    private async Task CheckPositionsAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db      = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();
        var binance = scope.ServiceProvider.GetRequiredService<IBinanceService>();

        var openPositions = await db.Positions
            .Include(p => p.Coin)
            .Where(p => p.Status == PositionStatus.Open)
            .ToListAsync(ct);

        if (openPositions.Count == 0) return;

        // Fix 4: Tüm unique sembollerin fiyatlarını tek API çağrısında al
        var symbols = openPositions.Select(p => p.Coin.Symbol).Distinct().ToList();
        var prices  = await binance.GetBulkPricesAsync(symbols, ct);

        var coinIds      = openPositions.Select(p => p.CoinId).Distinct().ToList();
        var strategyCoins = await db.UserStrategyCoins
            .Include(sc => sc.UserStrategy)
            .Where(sc => coinIds.Contains(sc.CoinId))
            .ToListAsync(ct);

        foreach (var position in openPositions)
        {
            if (ct.IsCancellationRequested) break;
            if (!prices.TryGetValue(position.Coin.Symbol, out var price)) continue;

            try
            {
                await CheckPositionAsync(db, binance, position, strategyCoins, price, ct);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Pozisyon kontrol hatası: PositionId={Id}", position.Id);
            }
        }
    }

    private async Task CheckPositionAsync(
        IApplicationDbContext db,
        IBinanceService binance,
        Position position,
        List<Domain.Entities.UserStrategyCoin> strategyCoins,
        decimal currentPrice,
        CancellationToken ct)
    {
        // Fix 9: Race condition — başka thread kapattıysa atla
        if (position.Status != PositionStatus.Open) return;

        // High watermark + peak price güncelle
        bool changed = false;
        if (position.TrailingStopHighWatermark is null || currentPrice > position.TrailingStopHighWatermark)
        {
            position.TrailingStopHighWatermark = currentPrice;
            changed = true;
        }
        if (position.PeakPrice is null || currentPrice > position.PeakPrice)
        {
            position.PeakPrice = currentPrice;
            position.PeakPriceAt = DateTime.UtcNow;
            position.PeakPnlPct = position.EntryPrice > 0
                ? Math.Round((currentPrice - position.EntryPrice) / position.EntryPrice * 100m, 4)
                : null;
            changed = true;
        }
        if (position.TroughPrice is null || currentPrice < position.TroughPrice)
        {
            position.TroughPrice = currentPrice;
            position.TroughPriceAt = DateTime.UtcNow;
            position.TroughPnlPct = position.EntryPrice > 0
                ? Math.Round((currentPrice - position.EntryPrice) / position.EntryPrice * 100m, 4)
                : null;
            changed = true;
        }
        if (changed) await db.SaveChangesAsync(ct);

        var peak  = position.TrailingStopHighWatermark!.Value;
        var entry = position.EntryPrice;

        var strategyCoin = strategyCoins
            .FirstOrDefault(sc => sc.CoinId == position.CoinId && sc.UserStrategy.UserId == position.UserId);

        var strategy = strategyCoin?.UserStrategy;

        // Volatile mod: coin UserStrategyCoins'te yok, StrategyId üzerinden doğrudan çek
        if (strategy is null && position.StrategyId.HasValue)
            strategy = await db.UserStrategies
                .FirstOrDefaultAsync(s => s.Id == position.StrategyId.Value, ct);

        var trailingPct  = position.TrailingStopPct ?? strategy?.TrailingStopPct ?? 5.0m;

        var trailingTrigger = peak  * (1 - trailingPct / 100m);
        // Position'daki SL fiyatını kullan; yoksa strategy %'sinden hesapla
        var stopLossTrigger = position.StopLossPrice
            ?? entry * (1 - (strategy?.StopLossPct ?? 3.0m) / 100m);

        // B: Maksimum tutma süresi — strateji ayarından alınır (varsayılan 8sa)
        var maxHoldHours = strategy?.MaxHoldHours ?? 8;
        var hoursOpen = (DateTime.UtcNow - position.OpenedAt).TotalHours;
        if (hoursOpen >= maxHoldHours)
        {
            logger.LogWarning("Maks tutma süresi ({Max}sa) doldu: {Symbol} {Hours:F1}sa açık — zorla kapatılıyor",
                maxHoldHours, position.Coin.Symbol, hoursOpen);
            await ClosePositionAsync(db, binance, position, strategyCoin, currentPrice, ExitReason.MaxHoldTime, ct);
            return;
        }

        // Fix 7: Partial TP — ilk hedefte kısmen kapat
        if (!position.IsPartialTpHit && strategy?.PartialTpPct.HasValue == true)
        {
            var partialTpPrice = entry * (1 + strategy.PartialTpPct!.Value / 100m);
            if (currentPrice >= partialTpPrice)
            {
                await HandlePartialTpAsync(db, binance, position, strategy, currentPrice, ct);
                return; // Bu döngüde tam kapama yapma — monitoring devam eder
            }
        }

        // Breakeven stop — kâr eşiğine ulaşıldıysa SL'yi giriş fiyatına taşı
        if (strategy?.UseBreakevenStop == true
            && (position.StopLossPrice == null || position.StopLossPrice < entry))
        {
            var currentPnlPct = entry > 0 ? (currentPrice - entry) / entry * 100m : 0m;
            if (currentPnlPct >= strategy.BreakevenTriggerPct)
            {
                position.StopLossPrice = entry;
                stopLossTrigger = entry;
                await db.SaveChangesAsync(ct);
                logger.LogInformation("Breakeven stop aktif: {Symbol} SL → giriş={Entry:F6} ({Pct:F2}% kârdayken)",
                    position.Coin.Symbol, entry, currentPnlPct);
            }
        }

        // Normal exit koşulları
        ExitReason? exitReason = null;
        if (position.TakeProfitPrice.HasValue && currentPrice >= position.TakeProfitPrice.Value)
            exitReason = ExitReason.TakeProfit;
        else if (currentPrice <= stopLossTrigger)
            exitReason = ExitReason.StopLoss;
        else
        {
            // C: Trailing stop her zaman aktif — partial TP bekleme kaldırıldı.
            // Erken düşüşlerde SL önce tetiklenir (SL trigger > trailing trigger olduğu durumlarda).
            // Coin yükseldikçe peak artar, trailing stop peak'i takip eder.
            if (currentPrice <= trailingTrigger)
                exitReason = ExitReason.TrailingStop;
        }

        if (exitReason is null) return;

        logger.LogWarning("{Reason} tetiklendi: {Symbol} [{Type}] giriş={Entry:F6} şimdi={Now:F6}",
            exitReason, position.Coin.Symbol, position.IsVirtual ? "sanal" : "gerçek", entry, currentPrice);

        await ClosePositionAsync(db, binance, position, strategyCoin, currentPrice, exitReason.Value, ct);
    }

    // Fix 7: Partial TP mantığı
    private async Task HandlePartialTpAsync(
        IApplicationDbContext db,
        IBinanceService binance,
        Position position,
        UserStrategy strategy,
        decimal currentPrice,
        CancellationToken ct)
    {
        var closePct    = strategy.PartialTpClosePct > 0 ? strategy.PartialTpClosePct : 50m;
        var grossPnlPct = (currentPrice - position.EntryPrice) / position.EntryPrice * 100m;

        if (!position.IsVirtual && position.EntryQuantity > 0)
        {
            // Gerçek pozisyon: ÖNCE sat, SONRA state güncelle.
            var sellQty = Math.Floor(position.EntryQuantity * (closePct / 100m) * 100_000_000m) / 100_000_000m;
            if (sellQty > 0)
            {
                var sellResult = await binance.PlaceMarketOrderAsync(
                    position.UserId, position.Coin.Symbol, OrderSide.Sell, sellQty, ct);
                if (sellResult.Succeeded && sellResult.Data is not null)
                {
                    var receivedUsdt = sellResult.Data.CummulativeQuoteQty;
                    position.EntryQuantity  -= sellQty;
                    // Orijinal maliyetin kapanan yüzdesi kadar düş (proceeds değil maliyet bazlı)
                    position.EntryValueUsdt = Math.Round(position.EntryValueUsdt * (1m - closePct / 100m), 4);

                    position.IsPartialTpHit      = true;
                    position.PartialTpHitPrice   = currentPrice;
                    position.PartialRealizedPnlPct = Math.Round(grossPnlPct * closePct / 100m, 4);
                    position.TrailingStopHighWatermark = currentPrice;
                    position.TrailingStopPct = 1.0m; // Kısmi TP sonrası trailing daralt: %1

                    logger.LogInformation("Partial TP ({Pct}%): {Symbol} {Qty} coin → {USDT} USDT @ {Price:F6}",
                        closePct, position.Coin.Symbol, sellQty, receivedUsdt, currentPrice);
                }
                else
                {
                    logger.LogError("Partial TP SELL BAŞARISIZ: {Symbol} {Error}",
                        position.Coin.Symbol, sellResult.Errors.FirstOrDefault());
                    // State güncelleme yok — bir sonraki döngüde yeniden denenecek
                }
            }
        }
        else
        {
            // Sanal pozisyon: sadece state güncelle
            position.IsPartialTpHit      = true;
            position.PartialTpHitPrice   = currentPrice;
            position.PartialRealizedPnlPct = Math.Round(grossPnlPct * closePct / 100m, 4);
            position.TrailingStopHighWatermark = currentPrice;
            position.TrailingStopPct = 1.0m; // Kısmi TP sonrası trailing daralt: %1
            logger.LogInformation("Sanal Partial TP: {Symbol} @ {Price:F6} PartialPnl%={P:F2}",
                position.Coin.Symbol, currentPrice, position.PartialRealizedPnlPct);
        }

        await db.SaveChangesAsync(ct);
        logger.LogInformation("Partial TP işlendi: {Symbol} @ {Price:F6}",
            position.Coin.Symbol, currentPrice);
    }

    private async Task ClosePositionAsync(
        IApplicationDbContext db,
        IBinanceService binance,
        Position position,
        Domain.Entities.UserStrategyCoin? strategyCoin,
        decimal currentPrice,
        ExitReason exitReason,
        CancellationToken ct)
    {
        // Fix 9: Double-check race condition
        if (position.Status != PositionStatus.Open) return;

        var entry = position.EntryPrice;
        var peak  = position.TrailingStopHighWatermark ?? entry;

        if (position.IsVirtual)
        {
            position.Status         = PositionStatus.Closed;
            position.ClosePrice     = currentPrice;
            position.ClosedAt       = DateTime.UtcNow;
            position.CloseReason    = exitReason.ToString();
            position.RealizedPnlPct = Math.Round((currentPrice - entry) / entry * 100m, 4);
            // USDT tutarlarını da hesapla (istatistik ve raporlama için)
            position.CloseValueUsdt = position.EntryValueUsdt > 0
                ? Math.Round(position.EntryValueUsdt * (1m + position.RealizedPnlPct.Value / 100m), 4)
                : Math.Round(currentPrice * position.EntryQuantity, 4);
            position.RealizedPnl = Math.Round(
                (position.CloseValueUsdt ?? 0m) - position.EntryValueUsdt, 4);
            await db.SaveChangesAsync(ct);
            logger.LogInformation(
                "Sanal pozisyon kapatıldı ({Reason}): {Symbol} PnL%={Pnl:F4} PnL$={PnlUsdt:F2}",
                exitReason, position.Coin.Symbol, position.RealizedPnlPct, position.RealizedPnl);
            return;
        }

        var riskSettings = await db.UserRiskSettings
            .FirstOrDefaultAsync(r => r.UserId == position.UserId, ct);

        // Gerçek pozisyon: kapatmadan önce DB'den taze durum kontrolü (race condition — başka servis kapattıysa atla)
        var freshStatus = await db.Positions
            .Where(p => p.Id == position.Id)
            .Select(p => p.Status)
            .FirstOrDefaultAsync(ct);
        if (freshStatus != PositionStatus.Open)
        {
            logger.LogDebug("Gerçek pozisyon zaten kapatılmış (double-close engellendi): PositionId={Id}", position.Id);
            return;
        }

        // Binance'e SELL emri — ÖNCE sat, SONRA kapat.
        // SAT başarısız olursa pozisyonu açık bırak; coin cüzdanda kalır ve izleme devam eder.
        var coinQty = position.EntryQuantity;
        if (coinQty > 0)
        {
            coinQty = Math.Floor(coinQty * 100_000_000m) / 100_000_000m;
            var sellResult = await binance.PlaceMarketOrderAsync(
                position.UserId, position.Coin.Symbol, OrderSide.Sell, coinQty, ct);

            if (sellResult.Succeeded && sellResult.Data is not null)
            {
                var receivedUsdt = sellResult.Data.CummulativeQuoteQty;

                position.Status      = PositionStatus.Closed;
                position.ClosePrice  = currentPrice;
                position.ClosedAt    = DateTime.UtcNow;
                position.CloseReason = exitReason.ToString();
                position.CloseValueUsdt = receivedUsdt;
                position.RealizedPnl = Math.Round(receivedUsdt - position.EntryValueUsdt, 4);
                position.RealizedPnlPct = position.EntryValueUsdt > 0
                    ? Math.Round((receivedUsdt - position.EntryValueUsdt) / position.EntryValueUsdt * 100m, 4)
                    : 0;

                if (position.RealizedPnl < 0 && riskSettings != null)
                {
                    ResetDailyLossIfNeeded(riskSettings);
                    riskSettings.DailyLossUsedUsdt += Math.Abs(position.RealizedPnl.Value);
                }

                logger.LogInformation("{Reason} SELL emri: {Symbol} {Qty} coin → {USDT} USDT PnL={Pnl}",
                    exitReason, position.Coin.Symbol, coinQty, receivedUsdt, position.RealizedPnl);
            }
            else
            {
                // SAT başarısız — pozisyonu AÇIK bırak, bir sonraki döngüde tekrar denenecek.
                logger.LogError("{Reason} SELL BAŞARISIZ (pozisyon açık kalıyor, yeniden denenecek): {Symbol} {Error}",
                    exitReason, position.Coin.Symbol, sellResult.Errors.FirstOrDefault());
                await db.SaveChangesAsync(ct); // sadece HWM güncellemelerini kaydet
                return;
            }
        }
        else
        {
            // Coin miktarı 0 — fiyat bazlı P&L hesapla (sanal benzeri durum)
            position.Status      = PositionStatus.Closed;
            position.ClosePrice  = currentPrice;
            position.ClosedAt    = DateTime.UtcNow;
            position.CloseReason = exitReason.ToString();
            position.CloseValueUsdt = currentPrice * position.EntryQuantity;
            position.RealizedPnl    = Math.Round(((currentPrice - entry) / entry) * position.EntryValueUsdt, 4);
            position.RealizedPnlPct = Math.Round((currentPrice - entry) / entry * 100m, 4);
        }

        var sellSignal = new TradeSignal
        {
            UserId = position.UserId,
            CoinId = position.CoinId,
            Timeframe = strategyCoin?.UserStrategy.Timeframe ?? "1h",
            Direction = SignalDirection.Sell,
            TotalScore = -1m,
            CandleTime = DateTime.UtcNow,
            Price = currentPrice,
            IndicatorScores = $"{{\"exit\":\"{exitReason}\",\"entry\":{entry:F6},\"peak\":{peak:F6}}}",
            IsActedUpon = true,
        };

        if (strategyCoin is not null)
        {
            sellSignal.StrategyId = strategyCoin.UserStrategyId;
            strategyCoin.ReEntryState = ReEntryState.WaitingForSell;
        }

        db.TradeSignals.Add(sellSignal);
        await db.SaveChangesAsync(ct);

        if (riskSettings?.TelegramEnabled == true
            && !string.IsNullOrWhiteSpace(riskSettings.TelegramBotToken)
            && !string.IsNullOrWhiteSpace(riskSettings.TelegramChatId))
        {
            var emoji = exitReason == ExitReason.TakeProfit ? "✅" : "🛑";
            var pnl = position.RealizedPnlPct.HasValue ? $"{position.RealizedPnlPct:F2}%" : "-";
            var partialNote = position.IsPartialTpHit
                ? $"\nKısmi TP: <b>{position.PartialRealizedPnlPct:F2}%</b> daha önce alındı" : "";
            await telegram.SendAsync(riskSettings.TelegramBotToken, riskSettings.TelegramChatId,
                $"{emoji} <b>{exitReason}</b> Tetiklendi\n" +
                $"Coin: <b>{position.Coin.Symbol}</b>\n" +
                $"Giriş: <b>{entry:F6}</b> → Çıkış: <b>{currentPrice:F6}</b>\n" +
                $"P&amp;L: <b>{pnl}</b>{partialNote}", ct);
        }
    }

    private static void ResetDailyLossIfNeeded(UserRiskSettings risk)
    {
        var today = DateTime.UtcNow.Date;
        var lastReset = risk.DailyLossResetAt.HasValue
            ? DateTime.SpecifyKind(risk.DailyLossResetAt.Value, DateTimeKind.Utc).Date
            : (DateTime?)null;
        if (lastReset != today)
        {
            risk.DailyLossUsedUsdt = 0;
            risk.DailyLossResetAt  = DateTime.UtcNow;
        }
    }

    private enum ExitReason { TakeProfit, TrailingStop, StopLoss, MaxHoldTime }
}
