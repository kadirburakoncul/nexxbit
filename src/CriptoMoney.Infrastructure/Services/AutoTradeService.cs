using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using CriptoMoney.Domain.Entities;
using CriptoMoney.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CriptoMoney.Infrastructure.Services;

public class AutoTradeService(
    IApplicationDbContext db,
    IBinanceService binance,
    ITelegramService telegram,
    ILogger<AutoTradeService> logger) : IAutoTradeService
{
    public async Task ProcessSignalAsync(TradeSignal signal, CancellationToken ct = default)
    {
        await SaveSignalAsync(signal, ct);

        var strategy = signal.StrategyId != Guid.Empty
            ? await db.UserStrategies.FirstOrDefaultAsync(s => s.Id == signal.StrategyId, ct)
            : null;

        if (signal.Direction == SignalDirection.Buy)
        {
            // Başka strateji bu coini zaten tutuyorsa sanal pozisyon açma
            var blocking = await db.Positions
                .FirstOrDefaultAsync(p => p.UserId == signal.UserId && p.CoinId == signal.CoinId
                    && p.Status == PositionStatus.Open && p.IsVirtual
                    && p.StrategyId != signal.StrategyId, ct);
            if (blocking == null)
                await OpenVirtualPositionAsync(signal, strategy, ct);
            else
                logger.LogDebug("Sanal AL bloklandı: {CoinId} başka strateji {SId} tutıyor", signal.CoinId, blocking.StrategyId);
        }
        else if (signal.Direction is SignalDirection.Sell or SignalDirection.StrongSell)
        {
            // Sadece pozisyonu açan strateji kapatabilir
            var ownedByOther = await db.Positions
                .AnyAsync(p => p.UserId == signal.UserId && p.CoinId == signal.CoinId
                    && p.Status == PositionStatus.Open && p.IsVirtual
                    && p.StrategyId != null && p.StrategyId != signal.StrategyId, ct);
            if (!ownedByOther)
                await CloseVirtualPositionAsync(signal, "T3 SAT sinyali", ct);
            else
                logger.LogDebug("Sanal SAT bloklandı: {CoinId} başka stratejiye ait", signal.CoinId);
        }

        if (!(strategy?.IsRealTradeEnabled ?? false))
            return;

        var risk = await db.UserRiskSettings
            .FirstOrDefaultAsync(r => r.UserId == signal.UserId, ct);

        if (risk?.AutoTradePaused == true)
        {
            logger.LogWarning("Flash crash koruması aktif — sinyal bloklandı: UserId={UserId}", signal.UserId);
            return;
        }

        if (risk is not null)
        {
            ResetDailyLossIfNeeded(risk);
            if (IsDailyLossExceeded(risk))
            {
                logger.LogWarning("Günlük kayıp limiti aşıldı, sinyal bloklandı: UserId={UserId}", signal.UserId);
                return;
            }
        }

        if (signal.Direction is SignalDirection.Buy or SignalDirection.Sell)
            await ExecuteOrderAsync(signal, strategy, risk, ct);
    }

    public async Task<Result> ApproveSignalAsync(Guid signalId, Guid userId, CancellationToken ct = default)
    {
        var signal = await db.TradeSignals
            .Include(s => s.Coin)
            .FirstOrDefaultAsync(s => s.Id == signalId && s.UserId == userId, ct);

        if (signal is null)
            return Result.Failure("Sinyal bulunamadı.");

        if (signal.IsActedUpon)
            return Result.Failure("Bu sinyal zaten işleme alındı.");

        var risk = await db.UserRiskSettings
            .FirstOrDefaultAsync(r => r.UserId == userId, ct);

        var strategy = signal.StrategyId != Guid.Empty
            ? await db.UserStrategies.FirstOrDefaultAsync(s => s.Id == signal.StrategyId, ct)
            : null;

        return await ExecuteOrderAsync(signal, strategy, risk, ct);
    }

    private async Task<Result> ExecuteOrderAsync(
        TradeSignal signal, UserStrategy? strategy, UserRiskSettings? risk, CancellationToken ct)
    {
        var symbol = signal.Coin?.Symbol ?? await GetSymbolAsync(signal.CoinId, ct);
        if (symbol is null) return Result.Failure("Coin bulunamadı.");

        var side = signal.Direction == SignalDirection.Buy ? OrderSide.Buy : OrderSide.Sell;

        decimal orderQty;
        if (side == OrderSide.Buy)
        {
            // Başka strateji bu coini gerçek pozisyonla tutuyorsa blokla
            var realBlock = await db.Positions
                .FirstOrDefaultAsync(p => p.UserId == signal.UserId && p.CoinId == signal.CoinId
                    && p.Status == PositionStatus.Open && !p.IsVirtual
                    && p.StrategyId != signal.StrategyId, ct);
            if (realBlock != null)
            {
                logger.LogDebug("Gerçek AL bloklandı: {CoinId} başka strateji {SId} tutıyor", signal.CoinId, realBlock.StrategyId);
                return Result.Failure("Bu coin başka bir strateji tarafından tutuluyor.");
            }

            // Maksimum 5 eş zamanlı gerçek pozisyon kontrolü
            var openRealCount = await db.Positions
                .CountAsync(p => p.UserId == signal.UserId && p.Status == PositionStatus.Open && !p.IsVirtual, ct);
            if (openRealCount >= 5)
            {
                logger.LogWarning("Max pozisyon sınırına ulaşıldı (5): UserId={UserId}", signal.UserId);
                return Result.Failure("Maksimum 5 eş zamanlı açık pozisyon sınırına ulaşıldı.");
            }

            bool isVolatileMode = strategy?.IsVolatileMode ?? false;
            decimal? volatilePosSizePct = strategy?.VolatilePositionSizePct;
            orderQty = await CalculateOrderSizeAsync(signal.UserId, risk, isVolatileMode, volatilePosSizePct, ct);
            if (orderQty <= 0)
            {
                logger.LogWarning("Yetersiz bakiye veya pozisyon boyutu 0: UserId={UserId}", signal.UserId);
                return Result.Failure("Yetersiz bakiye.");
            }
        }
        else
        {
            // Gerçek SAT: sadece pozisyonu açan strateji kapatabilir
            var realPos = await db.Positions
                .FirstOrDefaultAsync(p => p.UserId == signal.UserId && p.CoinId == signal.CoinId
                    && p.Status == PositionStatus.Open && !p.IsVirtual, ct);
            if (realPos != null && realPos.StrategyId != null && realPos.StrategyId != signal.StrategyId)
            {
                logger.LogDebug("Gerçek SAT bloklandı: {CoinId} başka stratejiye ait pozisyon", signal.CoinId);
                return Result.Failure("Bu pozisyon başka bir stratejiye ait.");
            }

            var baseAsset = symbol.EndsWith("USDT") ? symbol[..^4] : symbol.Replace("BTC", "").Replace("ETH", "");
            orderQty = await binance.GetCoinBalanceAsync(signal.UserId, baseAsset, ct);
            if (orderQty <= 0)
            {
                logger.LogWarning("Satılacak coin bakiyesi 0: {Symbol} UserId={UserId}", symbol, signal.UserId);
                return Result.Failure($"Binance'te satılacak {baseAsset} bakiyesi bulunamadı.");
            }
            orderQty = Math.Floor(orderQty * 100_000_000m) / 100_000_000m;
        }

        var quoteQty = orderQty;

        var orderRecord = new TradeOrder
        {
            UserId = signal.UserId,
            CoinId = signal.CoinId,
            SignalId = signal.Id,
            Side = side,
            Type = OrderType.Market,
            Status = OrderStatus.Pending,
            Quantity = quoteQty,
            Price = signal.Price,
            IsAutomatic = true,
        };

        db.TradeOrders.Add(orderRecord);
        signal.IsActedUpon = true;
        await db.SaveChangesAsync(ct);

        Application.Common.Models.Result<PlaceOrderResult> result = null!;
        const int maxAttempts = 3;
        for (int attempt = 1; attempt <= maxAttempts; attempt++)
        {
            result = await binance.PlaceMarketOrderAsync(signal.UserId, symbol, side, quoteQty, ct);
            if (result.Succeeded) break;
            if (attempt < maxAttempts)
            {
                logger.LogWarning("Emir başarısız (deneme {A}/{M}): {Symbol} {Error} — yeniden deneniyor...",
                    attempt, maxAttempts, symbol, result.Errors.FirstOrDefault());
                await Task.Delay(TimeSpan.FromSeconds(attempt * 2), ct);
            }
        }

        if (result.Succeeded && result.Data is not null)
        {
            orderRecord.BinanceOrderId = result.Data.BinanceOrderId;
            orderRecord.ClientOrderId = result.Data.ClientOrderId;
            orderRecord.FilledQuantity = result.Data.ExecutedQty;
            var filledPrice = result.Data.ExecutedQty > 0
                ? result.Data.CummulativeQuoteQty / result.Data.ExecutedQty
                : signal.Price;
            orderRecord.FilledPrice = filledPrice;
            orderRecord.Status = OrderStatus.Filled;
            orderRecord.BinanceCreatedAt = DateTime.UtcNow;

            logger.LogInformation("Emir gönderildi: {Symbol} {Side} {Qty} USDT, BinanceId={Id}",
                symbol, side, quoteQty, result.Data.BinanceOrderId);

            if (side == OrderSide.Buy)
            {
                await OpenRealPositionAsync(signal, orderRecord, filledPrice, quoteQty, ct);
                await SendTelegramAsync(signal.UserId, risk,
                    $"🟢 <b>AL Emri Gerçekleşti</b>\n" +
                    $"Coin: <b>{symbol}</b>\n" +
                    $"Fiyat: <b>{filledPrice:F6}</b>\n" +
                    $"Miktar: <b>{quoteQty:F2} USDT</b>", ct);
            }
            else
            {
                await CloseRealPositionAsync(signal, filledPrice, "T3 SAT sinyali", ct);
                await SendTelegramAsync(signal.UserId, risk,
                    $"🔴 <b>SAT Emri Gerçekleşti</b>\n" +
                    $"Coin: <b>{symbol}</b>\n" +
                    $"Fiyat: <b>{filledPrice:F6}</b>", ct);
            }
        }
        else
        {
            orderRecord.Status = OrderStatus.Rejected;
            orderRecord.ErrorMessage = result.Errors.FirstOrDefault();
            logger.LogError("Emir kalıcı olarak başarısız ({MaxAttempts} deneme): {Symbol} {Error}",
                maxAttempts, symbol, orderRecord.ErrorMessage);

            db.Notifications.Add(new Notification
            {
                UserId = signal.UserId,
                Type = NotificationType.BinanceError,
                Channel = NotificationChannel.InApp,
                Title = $"Emir Başarısız: {symbol}",
                Body = $"{side} emri {maxAttempts} denemede başarısız oldu. Hata: {orderRecord.ErrorMessage}",
            });
            await SendTelegramAsync(signal.UserId, risk,
                $"⚠️ <b>Emir Başarısız: {symbol}</b>\n" +
                $"Yön: {side} | Hata: {orderRecord.ErrorMessage}", ct);
        }

        await db.SaveChangesAsync(ct);
        return result.Succeeded ? Result.Success() : Result.Failure(orderRecord.ErrorMessage!);
    }

    private async Task OpenVirtualPositionAsync(TradeSignal signal, UserStrategy? strategy, CancellationToken ct)
    {
        var exists = await db.Positions
            .AnyAsync(p => p.UserId == signal.UserId && p.CoinId == signal.CoinId
                && p.Status == PositionStatus.Open && p.IsVirtual, ct);
        if (exists) return;

        var (slPrice, tpPrice, trailingPct) = ComputeStops(signal.Price, strategy, signal.IndicatorScores);

        db.Positions.Add(new Position
        {
            UserId = signal.UserId,
            CoinId = signal.CoinId,
            StrategyId = signal.StrategyId != Guid.Empty ? signal.StrategyId : null,
            EntryPrice = signal.Price,
            EntryQuantity = 0,
            EntryValueUsdt = 0,
            StopLossPrice = slPrice,
            TakeProfitPrice = tpPrice,
            TrailingStopPct = trailingPct,
            TrailingStopHighWatermark = signal.Price,
            IsVirtual = true,
            Status = PositionStatus.Open,
            OpenedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync(ct);

        logger.LogInformation(
            "Sanal pozisyon açıldı: {Symbol} Entry={Entry:F6} SL={SL} TP={TP} Trail={Trail}%",
            signal.Coin?.Symbol ?? signal.CoinId.ToString(), signal.Price,
            slPrice?.ToString("F6") ?? "—", tpPrice?.ToString("F6") ?? "—",
            trailingPct?.ToString("F2") ?? "—");
    }

    private async Task CloseVirtualPositionAsync(TradeSignal signal, string reason, CancellationToken ct)
    {
        var position = await db.Positions
            .FirstOrDefaultAsync(p =>
                p.UserId == signal.UserId && p.CoinId == signal.CoinId
                && p.Status == PositionStatus.Open && p.IsVirtual, ct);
        if (position is null) return;

        // Race condition guard
        if (position.Status != PositionStatus.Open) return;

        position.Status = PositionStatus.Closed;
        position.ClosedAt = DateTime.UtcNow;
        position.ClosePrice = signal.Price;
        position.CloseReason = reason;

        if (position.EntryPrice > 0)
        {
            var pnlPct = (signal.Price - position.EntryPrice) / position.EntryPrice * 100m;
            position.RealizedPnlPct = Math.Round(pnlPct, 4);
        }

        await db.SaveChangesAsync(ct);
        logger.LogInformation("Sanal pozisyon kapatıldı: Coin={CoinId} Entry={Entry} Close={Close} PnL%={Pnl}",
            signal.CoinId, position.EntryPrice, signal.Price, position.RealizedPnlPct);
    }

    private async Task OpenRealPositionAsync(TradeSignal signal, TradeOrder order, decimal price, decimal valueUsdt, CancellationToken ct)
    {
        var exists = await db.Positions
            .AnyAsync(p => p.UserId == signal.UserId && p.CoinId == signal.CoinId && p.Status == PositionStatus.Open, ct);
        if (exists) return;

        var strategy = signal.StrategyId != Guid.Empty
            ? await db.UserStrategies.FirstOrDefaultAsync(s => s.Id == signal.StrategyId, ct)
            : null;

        var (slPriceReal, tpPriceReal, trailingPctReal) = ComputeStops(price, strategy, signal.IndicatorScores);

        db.Positions.Add(new Position
        {
            UserId = signal.UserId,
            CoinId = signal.CoinId,
            StrategyId = signal.StrategyId != Guid.Empty ? signal.StrategyId : null,
            EntryOrderId = order.Id,
            EntryPrice = price,
            EntryQuantity = valueUsdt / price,
            EntryValueUsdt = valueUsdt,
            StopLossPrice = slPriceReal,
            TakeProfitPrice = tpPriceReal,
            TrailingStopPct = trailingPctReal,
            TrailingStopHighWatermark = price,
            Status = PositionStatus.Open,
            OpenedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync(ct);
    }

    private async Task CloseRealPositionAsync(TradeSignal signal, decimal closePrice, string reason, CancellationToken ct)
    {
        var position = await db.Positions
            .FirstOrDefaultAsync(p =>
                p.UserId == signal.UserId &&
                p.CoinId == signal.CoinId &&
                p.Status == PositionStatus.Open, ct);
        if (position is null) return;

        // Race condition: başka thread zaten kapattıysa atla
        if (position.Status != PositionStatus.Open) return;

        position.Status = PositionStatus.Closed;
        position.ClosedAt = DateTime.UtcNow;
        position.ClosePrice = closePrice;
        position.CloseReason = reason;

        if (position.EntryValueUsdt > 0 && position.EntryPrice > 0)
        {
            var pnlPct = (closePrice - position.EntryPrice) / position.EntryPrice * 100m;
            position.RealizedPnlPct = Math.Round(pnlPct, 4);
            position.RealizedPnl = Math.Round(position.EntryValueUsdt * pnlPct / 100m, 4);
            position.CloseValueUsdt = position.EntryValueUsdt + (position.RealizedPnl ?? 0);

            // Günlük kayıp takibi
            if (position.RealizedPnl < 0)
            {
                var risk = await db.UserRiskSettings.FirstOrDefaultAsync(r => r.UserId == signal.UserId, ct);
                if (risk != null)
                {
                    ResetDailyLossIfNeeded(risk);
                    risk.DailyLossUsedUsdt += Math.Abs(position.RealizedPnl.Value);
                }
            }
        }
        await db.SaveChangesAsync(ct);
    }

    private async Task SaveSignalAsync(TradeSignal signal, CancellationToken ct)
    {
        db.TradeSignals.Add(signal);
        await db.SaveChangesAsync(ct);
    }

    private async Task CreateApprovalNotificationAsync(
        TradeSignal signal, UserRiskSettings risk, CancellationToken ct)
    {
        var symbol = await GetSymbolAsync(signal.CoinId, ct) ?? "Bilinmeyen";
        var notification = new Notification
        {
            UserId = signal.UserId,
            Title = $"{signal.Direction} Sinyali — {symbol}",
            Body = $"{symbol} için {signal.Direction} sinyali oluştu. Skor: {signal.TotalScore:F2}. Onaylamak için uygulamaya girin.",
            Type = signal.Direction == SignalDirection.Buy ? NotificationType.BuySignal : NotificationType.SellSignal,
            Channel = NotificationChannel.InApp,
            Payload = $"{{\"signalId\":\"{signal.Id}\"}}",
        };

        db.Notifications.Add(notification);
        await db.SaveChangesAsync(ct);
    }

    private async Task<decimal> CalculateOrderSizeAsync(
        Guid userId, UserRiskSettings? risk, bool isVolatileMode, decimal? volatilePosSizePct, CancellationToken ct)
    {
        var usdtBalance = await binance.GetUsdtBalanceAsync(userId, ct);

        decimal size;
        if (risk?.MaxPositionSizeUsdt.HasValue == true)
        {
            size = risk.MaxPositionSizeUsdt.Value;
        }
        else if (risk?.MaxPositionSizePct.HasValue == true)
        {
            size = usdtBalance * risk.MaxPositionSizePct.Value / 100m;
        }
        else
        {
            // Varsayılan: anaparanın %20'si (max 5 eş zamanlı pozisyon = %100 kullanım)
            size = usdtBalance * 0.20m;
        }

        // Volatile modda kullanıcı tanımlı oran veya varsayılan %50 küçültme
        if (isVolatileMode)
        {
            var pct = volatilePosSizePct.HasValue
                ? volatilePosSizePct.Value / 100m
                : 0.5m;
            size *= pct;
        }

        // Günlük kayıp limitine göre kırp
        if (risk?.MaxDailyLossUsdt.HasValue == true)
        {
            var remaining = risk.MaxDailyLossUsdt.Value - risk.DailyLossUsedUsdt;
            size = Math.Min(size, remaining);
        }

        return Math.Max(0, Math.Round(size, 2));
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
            risk.DailyLossResetAt = DateTime.UtcNow;
        }
    }

    private static bool IsDailyLossExceeded(UserRiskSettings risk)
    {
        return risk.MaxDailyLossUsdt.HasValue && risk.DailyLossUsedUsdt >= risk.MaxDailyLossUsdt.Value;
    }

    /// <summary>
    /// Strateji ayarına göre SL/TP/Trailing değerlerini hesaplar.
    /// UseAtrBasedStops=true ise signal'den ATR çeker, dinamik hesap yapar.
    /// </summary>
    private static (decimal? sl, decimal? tp, decimal? trailingPct) ComputeStops(
        decimal entryPrice, UserStrategy? strategy, string? indicatorScoresJson)
    {
        if (strategy is null)
            return (null, null, null);

        decimal? slPrice    = null;
        decimal? tpPrice    = null;
        decimal? trailingPct = strategy.TrailingStopPct > 0 ? strategy.TrailingStopPct : (decimal?)null;

        if (strategy.UseAtrBasedStops)
        {
            decimal atr = 0;
            if (!string.IsNullOrEmpty(indicatorScoresJson))
            {
                try
                {
                    var scores = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, decimal>>(indicatorScoresJson);
                    scores?.TryGetValue("ATR", out atr);
                }
                catch { /* ATR parse edilemedi — fixed'e düş */ }
            }

            if (atr > 0)
            {
                slPrice    = entryPrice - atr * strategy.AtrSlMultiplier;
                tpPrice    = entryPrice + atr * strategy.AtrTpMultiplier;
                trailingPct = null; // ATR modunda trailing yerine TP kullan
            }
            else
            {
                // ATR alınamadı — sabit yüzdelere geri dön
                slPrice = strategy.StopLossPct > 0 ? entryPrice * (1 - strategy.StopLossPct / 100m) : null;
                tpPrice = strategy.TakeProfitPct.HasValue ? entryPrice * (1 + strategy.TakeProfitPct.Value / 100m) : null;
            }
        }
        else
        {
            slPrice = strategy.StopLossPct > 0 ? entryPrice * (1 - strategy.StopLossPct / 100m) : null;
            tpPrice = strategy.TakeProfitPct.HasValue ? entryPrice * (1 + strategy.TakeProfitPct.Value / 100m) : null;
        }

        return (slPrice, tpPrice, trailingPct);
    }

    private async Task<string?> GetSymbolAsync(int coinId, CancellationToken ct)
    {
        var coin = await db.Coins.FindAsync([coinId], ct);
        return coin?.Symbol;
    }

    private async Task SendTelegramAsync(Guid userId, UserRiskSettings? risk, string message, CancellationToken ct)
    {
        var settings = risk ?? await db.UserRiskSettings.FirstOrDefaultAsync(r => r.UserId == userId, ct);
        if (settings?.TelegramEnabled == true
            && !string.IsNullOrWhiteSpace(settings.TelegramBotToken)
            && !string.IsNullOrWhiteSpace(settings.TelegramChatId))
        {
            await telegram.SendAsync(settings.TelegramBotToken, settings.TelegramChatId, message, ct);
        }
    }
}
