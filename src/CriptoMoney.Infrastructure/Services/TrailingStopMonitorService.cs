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

        // High watermark güncelle
        if (position.TrailingStopHighWatermark is null || currentPrice > position.TrailingStopHighWatermark)
        {
            position.TrailingStopHighWatermark = currentPrice;
            await db.SaveChangesAsync(ct);
        }

        var peak  = position.TrailingStopHighWatermark!.Value;
        var entry = position.EntryPrice;

        var strategyCoin = strategyCoins
            .FirstOrDefault(sc => sc.CoinId == position.CoinId && sc.UserStrategy.UserId == position.UserId);

        var strategy = strategyCoin?.UserStrategy;

        var trailingPct  = position.TrailingStopPct ?? strategy?.TrailingStopPct ?? 2.5m;
        var stopLossPct  = strategy?.StopLossPct ?? 1.5m;

        var trailingTrigger = peak  * (1 - trailingPct / 100m);
        var stopLossTrigger = entry * (1 - stopLossPct / 100m);

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

        // Normal exit koşulları
        ExitReason? exitReason = null;
        if (position.TakeProfitPrice.HasValue && currentPrice >= position.TakeProfitPrice.Value)
            exitReason = ExitReason.TakeProfit;
        else if (currentPrice <= trailingTrigger) exitReason = ExitReason.TrailingStop;
        else if (currentPrice <= stopLossTrigger) exitReason = ExitReason.StopLoss;

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
        var closePct = strategy.PartialTpClosePct > 0 ? strategy.PartialTpClosePct : 50m;

        position.IsPartialTpHit = true;
        position.PartialTpHitPrice = currentPrice;

        // Kısmi P&L: girişten şimdiye kadar olan kazanç × kapanan oran
        var grossPnlPct = (currentPrice - position.EntryPrice) / position.EntryPrice * 100m;
        position.PartialRealizedPnlPct = Math.Round(grossPnlPct * closePct / 100m, 4);

        if (!position.IsVirtual && position.EntryQuantity > 0)
        {
            // Gerçek pozisyon: kısmi sat
            var sellQty = Math.Floor(position.EntryQuantity * (closePct / 100m) * 100_000_000m) / 100_000_000m;
            if (sellQty > 0)
            {
                var sellResult = await binance.PlaceMarketOrderAsync(
                    position.UserId, position.Coin.Symbol, OrderSide.Sell, sellQty, ct);
                if (sellResult.Succeeded)
                {
                    position.EntryQuantity  -= sellQty;
                    position.EntryValueUsdt *= (1m - closePct / 100m);
                    logger.LogInformation("Partial TP ({Pct}%): {Symbol} {Qty} coin satıldı @ {Price:F6}",
                        closePct, position.Coin.Symbol, sellQty, currentPrice);
                }
            }
        }

        // Trailing stop'u partial TP fiyatına sıfırla (HWM artık bu fiyat)
        position.TrailingStopHighWatermark = currentPrice;

        await db.SaveChangesAsync(ct);
        logger.LogInformation("Partial TP tetiklendi: {Symbol} @ {Price:F6} PartialPnl%={P:F2}",
            position.Coin.Symbol, currentPrice, position.PartialRealizedPnlPct);
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

        position.Status    = PositionStatus.Closed;
        position.ClosePrice = currentPrice;
        position.ClosedAt  = DateTime.UtcNow;
        position.CloseReason = exitReason.ToString();
        position.RealizedPnlPct = Math.Round((currentPrice - entry) / entry * 100m, 4);

        if (position.IsVirtual)
        {
            await db.SaveChangesAsync(ct);
            logger.LogInformation("Sanal pozisyon kapatıldı ({Reason}): {Symbol} PnL%={Pnl:F4}",
                exitReason, position.Coin.Symbol, position.RealizedPnlPct);
            return;
        }

        var riskSettings = await db.UserRiskSettings
            .FirstOrDefaultAsync(r => r.UserId == position.UserId, ct);

        // Gerçek pozisyon: Binance'e SELL emri
        var coinQty = position.EntryQuantity;
        if (coinQty > 0)
        {
            coinQty = Math.Floor(coinQty * 100_000_000m) / 100_000_000m;
            var sellResult = await binance.PlaceMarketOrderAsync(
                position.UserId, position.Coin.Symbol, OrderSide.Sell, coinQty, ct);

            if (sellResult.Succeeded && sellResult.Data is not null)
            {
                var receivedUsdt = sellResult.Data.CummulativeQuoteQty;
                position.CloseValueUsdt = receivedUsdt;
                position.RealizedPnl = Math.Round(receivedUsdt - position.EntryValueUsdt, 4);
                position.RealizedPnlPct = position.EntryValueUsdt > 0
                    ? Math.Round((receivedUsdt - position.EntryValueUsdt) / position.EntryValueUsdt * 100m, 4)
                    : 0;

                // Fix 2: Günlük kayıp takibi güncelle
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
                logger.LogError("{Reason} SELL BAŞARISIZ: {Symbol} {Error}",
                    exitReason, position.Coin.Symbol, sellResult.Errors.FirstOrDefault());
            }
        }
        else
        {
            position.CloseValueUsdt = currentPrice * position.EntryQuantity;
            position.RealizedPnl = Math.Round(((currentPrice - entry) / entry) * position.EntryValueUsdt, 4);
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

    private enum ExitReason { TakeProfit, TrailingStop, StopLoss }
}
