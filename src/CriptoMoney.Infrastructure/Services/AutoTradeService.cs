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
    IEmailService emailService,
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
            if (blocking != null)
            {
                logger.LogDebug("Sanal AL bloklandı: {CoinId} başka strateji {SId} tutuyor", signal.CoinId, blocking.StrategyId);
            }
            else
            {
                // Re-entry cooldown: aynı coin son 30dk içinde herhangi bir nedenle kapanmışsa bekle
                var cooldownCutoff = DateTime.UtcNow.AddMinutes(-30);
                var recentlyClosed = await db.Positions
                    .AnyAsync(p => p.UserId == signal.UserId
                        && p.CoinId == signal.CoinId
                        && p.StrategyId == signal.StrategyId
                        && p.Status == PositionStatus.Closed
                        && p.IsVirtual
                        && p.ClosedAt >= cooldownCutoff, ct);
                if (recentlyClosed)
                {
                    logger.LogDebug(
                        "Re-entry cooldown (30dk): {CoinId} son 30dk içinde kapandı, yeniden giriş engellendi",
                        signal.CoinId);
                }
                else
                {
                    // G: SL ve TrailingStop özel cooldown — strateji ayarından alınır (varsayılan 4sa)
                    var slCooldownHours = strategy?.SlCooldownHours ?? 4;
                    var slCutoff = DateTime.UtcNow.AddHours(-slCooldownHours);
                    var recentStopLoss = await db.Positions
                        .AnyAsync(p => p.UserId == signal.UserId
                            && p.CoinId == signal.CoinId
                            && p.StrategyId == signal.StrategyId
                            && p.Status == PositionStatus.Closed
                            && p.IsVirtual
                            && (p.CloseReason == "StopLoss" || p.CloseReason == "TrailingStop")
                            && p.ClosedAt >= slCutoff, ct);
                    if (recentStopLoss)
                    {
                        logger.LogDebug(
                            "SL/Trailing cooldown ({Hours}sa): {CoinId} son {Hours} saat içinde zarar ile kapandı, giriş engellendi",
                            slCooldownHours, signal.CoinId, slCooldownHours);
                    }
                    else
                    {
                    // Düşen bıçak + H: kırmızı mum filtresi
                    bool fallingKnife = false;
                    var entrySymbol = signal.Coin?.Symbol ?? await GetSymbolAsync(signal.CoinId, ct);
                    if (entrySymbol != null)
                    {
                        var cr = await binance.GetCandlesAsync(entrySymbol, strategy?.Timeframe ?? "5m", 3, ct);
                        if (cr.Succeeded && cr.Data?.Count >= 2)
                        {
                            var chg = (cr.Data[^1].Close - cr.Data[^2].Close) / cr.Data[^2].Close * 100m;
                            if (chg < -0.5m)
                            {
                                fallingKnife = true;
                                logger.LogDebug("Düşen bıçak: {Symbol} son mum -%{Chg:F2}, giriş engellendi",
                                    entrySymbol, Math.Abs(chg));
                            }
                            // H: Son kapanmış mum kırmızıysa giriş yapma (strateji ayarından kontrol edilir)
                            else if (strategy?.IsGreenCandleFilterEnabled != false
                                && cr.Data[^2].Close < cr.Data[^2].Open)
                            {
                                fallingKnife = true;
                                logger.LogDebug("Kırmızı mum: {Symbol} son kapanış < açılış, giriş engellendi",
                                    entrySymbol);
                            }
                        }
                    }

                    if (!fallingKnife)
                    {
                        // Strateji bazlı maksimum eş zamanlı açık pozisyon limiti
                        var maxOpenPositions = strategy?.MaxOpenPositions ?? 5;
                        var openCount = await db.Positions
                            .CountAsync(p => p.UserId == signal.UserId
                                && p.Status == PositionStatus.Open
                                && p.IsVirtual
                                && p.StrategyId == signal.StrategyId, ct);
                        if (openCount >= maxOpenPositions)
                            logger.LogInformation(
                                "Max pozisyon limiti ({Max}) doldu: CoinId={CoinId} atlandı",
                                maxOpenPositions, signal.CoinId);
                        else
                            await OpenVirtualPositionAsync(signal, strategy, ct);
                    }
                    } // end StopLoss cooldown
                }
            }
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

        if (signal.Direction == SignalDirection.Buy && risk is not null && risk.MaxOpenPositions > 0)
        {
            var openRealCount = await db.Positions.CountAsync(p =>
                p.UserId == signal.UserId && p.Status == PositionStatus.Open && !p.IsVirtual, ct);
            if (openRealCount >= risk.MaxOpenPositions)
            {
                logger.LogWarning("Maks. açık pozisyon limiti doldu ({Count}/{Max}), sinyal bloklandı: UserId={UserId}",
                    openRealCount, risk.MaxOpenPositions, signal.UserId);
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

            // Strateji bazlı maksimum eş zamanlı gerçek pozisyon kontrolü
            var maxRealPositions = strategy?.MaxOpenPositions ?? 5;
            var openRealCount = await db.Positions
                .CountAsync(p => p.UserId == signal.UserId && p.Status == PositionStatus.Open && !p.IsVirtual, ct);
            if (openRealCount >= maxRealPositions)
            {
                logger.LogWarning("Max pozisyon sınırına ulaşıldı ({Max}): UserId={UserId}", maxRealPositions, signal.UserId);
                return Result.Failure($"Maksimum {maxRealPositions} eş zamanlı açık pozisyon sınırına ulaşıldı.");
            }

            orderQty = await CalculateOrderSizeAsync(signal.UserId, risk, strategy, ct);
            if (orderQty <= 0)
            {
                logger.LogWarning("Yetersiz bakiye veya geçici API hatası — emir atlandı, strateji korundu: UserId={UserId} Strateji={StratName}",
                    signal.UserId, strategy?.Name);
                return Result.Failure("Yetersiz bakiye.");
            }
            var minOrderSize = strategy?.MinPositionSizeUsdt ?? 10m;
            if (orderQty < minOrderSize)
            {
                logger.LogWarning("Min emir tutarı karşılanmıyor: {Qty:F2} USDT < {Min:F2} USDT, {Symbol} atlandı (strateji devre dışı bırakılmadı)",
                    orderQty, minOrderSize, symbol);
                return Result.Failure($"Emir tutarı minimum {minOrderSize:F0} USDT altında ({orderQty:F2} USDT).");
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

            var errMsg = orderRecord.ErrorMessage ?? "";
            var isNotionalError = errMsg.Contains("NOTIONAL", StringComparison.OrdinalIgnoreCase)
                || errMsg.Contains("MIN_NOTIONAL", StringComparison.OrdinalIgnoreCase)
                || errMsg.Contains("LOT_SIZE", StringComparison.OrdinalIgnoreCase);

            if (isNotionalError)
            {
                logger.LogWarning("NOTIONAL/LOT_SIZE hatası — strateji devre dışı bırakılmıyor, sadece bu emir atlandı: {Symbol}", symbol);
            }
            else
            {
                await DisableRealTradeAsync(strategy, signal.UserId, symbol,
                    $"{side} emri başarısız: {orderRecord.ErrorMessage}", ct);
            }
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
            EntryQuantity = signal.Price > 0 ? Math.Round(100m / signal.Price, 8) : 0m,
            EntryValueUsdt = 100m, // $100 sanal simülasyon
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
        // Sadece gerçek pozisyon çakışmasını kontrol et — virtual pozisyon gerçek alımı bloklamamalı
        var exists = await db.Positions
            .AnyAsync(p => p.UserId == signal.UserId && p.CoinId == signal.CoinId
                && p.Status == PositionStatus.Open && !p.IsVirtual, ct);
        if (exists) return;

        var strategy = signal.StrategyId != Guid.Empty
            ? await db.UserStrategies.FirstOrDefaultAsync(s => s.Id == signal.StrategyId, ct)
            : null;

        var (slPriceReal, tpPriceReal, trailingPctReal) = ComputeStops(price, strategy, signal.IndicatorScores);

        // Binance'den gelen gerçek coin miktarını kullan (komisyon mahsup edilmiş).
        // Formül (valueUsdt/price) kullanmak yetersiz bakiye hatasına yol açar.
        var actualQty = (order.FilledQuantity ?? 0) > 0 ? order.FilledQuantity!.Value : valueUsdt / price;

        db.Positions.Add(new Position
        {
            UserId = signal.UserId,
            CoinId = signal.CoinId,
            StrategyId = signal.StrategyId != Guid.Empty ? signal.StrategyId : null,
            EntryOrderId = order.Id,
            EntryPrice = price,
            EntryQuantity = actualQty,
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
        Guid userId, UserRiskSettings? risk, UserStrategy? strategy, CancellationToken ct)
    {
        var usdtBalance = await binance.GetUsdtBalanceAsync(userId, ct);

        decimal size;
        // Strateji ayarı, global RiskSettings'e göre önceliklidir
        if (strategy?.MaxPositionSizeUsdt.HasValue == true)
            size = strategy.MaxPositionSizeUsdt.Value;
        else if (strategy?.MaxPositionSizePct.HasValue == true)
            size = usdtBalance * strategy.MaxPositionSizePct.Value / 100m;
        else if (risk?.MaxPositionSizeUsdt.HasValue == true)
            size = risk.MaxPositionSizeUsdt.Value;
        else if (risk?.MaxPositionSizePct.HasValue == true)
            size = usdtBalance * risk.MaxPositionSizePct.Value / 100m;
        else
            // Varsayılan: bakiyenin %20'si (5 eş zamanlı pozisyon = %100 kullanım)
            size = usdtBalance * 0.20m;

        // Volatile modda kullanıcı tanımlı oran veya varsayılan %50 küçültme
        if (strategy?.IsVolatileMode == true)
        {
            var pct = strategy.VolatilePositionSizePct.HasValue
                ? strategy.VolatilePositionSizePct.Value / 100m
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

    private async Task DisableRealTradeAsync(UserStrategy? strategy, Guid userId, string symbol, string reason, CancellationToken ct)
    {
        if (strategy is not null && strategy.IsRealTradeEnabled)
        {
            strategy.IsRealTradeEnabled = false;
            logger.LogWarning("Canlı al-sat devre dışı bırakıldı: {StratName} — {Reason}", strategy.Name, reason);
        }

        var body = $"Coin: {symbol}\nStrateji: {strategy?.Name ?? "—"}\nNeden: {reason}";
        db.Notifications.Add(new Notification
        {
            UserId = userId,
            Type = NotificationType.BinanceError,
            Channel = NotificationChannel.InApp,
            Title = "Canlı Al-Sat Durduruldu",
            Body = body,
        });

        var risk = await db.UserRiskSettings.FirstOrDefaultAsync(r => r.UserId == userId, ct);
        await SendTelegramAsync(userId, risk,
            $"🚨 <b>Canlı Al-Sat Durduruldu</b>\n{body}", ct);

        try
        {
            var user = await db.Users.FindAsync([userId], ct);
            if (user?.Email != null)
            {
                var html = EmailTemplates.TradeError(user.FirstName, symbol, strategy?.Name ?? "—", reason);
                await emailService.SendAsync(user.Email, "Canlı Al-Sat Durduruldu — Nexxbit", html, ct);
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Hata e-postası gönderilemedi: UserId={UserId}", userId);
        }

        await db.SaveChangesAsync(ct);
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
