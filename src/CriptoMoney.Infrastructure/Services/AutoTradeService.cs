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
    ILogger<AutoTradeService> logger) : IAutoTradeService
{
    public async Task ProcessSignalAsync(TradeSignal signal, CancellationToken ct = default)
    {
        // Sinyali her zaman kaydet (monitor + geçmiş için)
        await SaveSignalAsync(signal, ct);

        // Strateji bazlı gerçek işlem kontrolü
        var strategy = signal.StrategyId != Guid.Empty
            ? await db.UserStrategies.FirstOrDefaultAsync(s => s.Id == signal.StrategyId, ct)
            : null;

        // Sanal pozisyon takibi — strateji aktifse her zaman (gerçek işlem olmasa bile sinyaller sayfasını besler)
        if (signal.Direction == SignalDirection.Buy)
            await OpenVirtualPositionAsync(signal, strategy, ct);
        else if (signal.Direction is SignalDirection.Sell or SignalDirection.StrongSell)
            await CloseVirtualPositionAsync(signal, "T3 SAT sinyali", ct);

        // Kullanıcı risk ayarlarını yükle
        var risk = await db.UserRiskSettings
            .FirstOrDefaultAsync(r => r.UserId == signal.UserId, ct);

        var isRealTradeEnabled = (risk?.IsAutoTradeEnabled ?? false) && (strategy?.IsRealTradeEnabled ?? false);

        if (!isRealTradeEnabled || risk is null)
            return;

        // Flash crash koruması aktifse durdur
        if (risk.AutoTradePaused)
        {
            logger.LogWarning("Flash crash koruması aktif — sinyal bloklandı: UserId={UserId}", signal.UserId);
            return;
        }

        // Günlük kayıp sınırını kontrol et ve sıfırla
        ResetDailyLossIfNeeded(risk);

        if (IsDailyLossExceeded(risk))
        {
            logger.LogWarning("Günlük kayıp limiti aşıldı, sinyal bloklandı: UserId={UserId}", signal.UserId);
            return;
        }

        switch (risk.TradeMode)
        {
            case TradeMode.SignalOnly:
                break;

            case TradeMode.ManualApproval:
                await CreateApprovalNotificationAsync(signal, risk, ct);
                break;

            case TradeMode.FullAuto:
                if (signal.Direction is SignalDirection.Buy or SignalDirection.Sell)
                    await ExecuteOrderAsync(signal, risk, ct);
                break;
        }
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

        if (risk is null)
            return Result.Failure("Risk ayarları bulunamadı.");

        return await ExecuteOrderAsync(signal, risk, ct);
    }

    private async Task<Result> ExecuteOrderAsync(
        TradeSignal signal, UserRiskSettings risk, CancellationToken ct)
    {
        var symbol = signal.Coin?.Symbol ?? await GetSymbolAsync(signal.CoinId, ct);
        if (symbol is null) return Result.Failure("Coin bulunamadı.");

        var side = signal.Direction == SignalDirection.Buy ? OrderSide.Buy : OrderSide.Sell;

        // Pozisyon büyüklüğünü hesapla
        var quoteQty = await CalculateOrderSizeAsync(signal.UserId, risk, ct);
        if (quoteQty <= 0)
        {
            logger.LogWarning("Yetersiz bakiye veya pozisyon boyutu 0: UserId={UserId}", signal.UserId);
            return Result.Failure("Yetersiz bakiye.");
        }

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

        // Binance'e gönder
        var result = await binance.PlaceMarketOrderAsync(signal.UserId, symbol, side, quoteQty, ct);

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

            // Gerçek pozisyon yönetimi
            if (side == OrderSide.Buy)
                await OpenRealPositionAsync(signal, orderRecord, filledPrice, quoteQty, ct);
            else
                await CloseRealPositionAsync(signal, filledPrice, "T3 SAT sinyali", ct);
        }
        else
        {
            orderRecord.Status = OrderStatus.Rejected;
            orderRecord.ErrorMessage = result.Errors.FirstOrDefault();
            logger.LogError("Emir başarısız: {Symbol} {Error}", symbol, orderRecord.ErrorMessage);
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

        db.Positions.Add(new Position
        {
            UserId = signal.UserId,
            CoinId = signal.CoinId,
            EntryPrice = signal.Price,
            EntryQuantity = 0,
            EntryValueUsdt = 0,
            TrailingStopPct = strategy?.TrailingStopPct ?? 0.30m,
            TrailingStopHighWatermark = signal.Price,
            IsVirtual = true,
            Status = PositionStatus.Open,
            OpenedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync(ct);
    }

    private async Task CloseVirtualPositionAsync(TradeSignal signal, string reason, CancellationToken ct)
    {
        var position = await db.Positions
            .FirstOrDefaultAsync(p =>
                p.UserId == signal.UserId && p.CoinId == signal.CoinId
                && p.Status == PositionStatus.Open && p.IsVirtual, ct);
        if (position is null) return;

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

        db.Positions.Add(new Position
        {
            UserId = signal.UserId,
            CoinId = signal.CoinId,
            EntryOrderId = order.Id,
            EntryPrice = price,
            EntryQuantity = valueUsdt / price,
            EntryValueUsdt = valueUsdt,
            TrailingStopPct = strategy?.TrailingStopPct ?? 0.30m,
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
        Guid userId, UserRiskSettings risk, CancellationToken ct)
    {
        var usdtBalance = await binance.GetUsdtBalanceAsync(userId, ct);

        decimal size;
        if (risk.MaxPositionSizeUsdt.HasValue)
            size = risk.MaxPositionSizeUsdt.Value;
        else if (risk.MaxPositionSizePct.HasValue)
            size = usdtBalance * risk.MaxPositionSizePct.Value / 100m;
        else
            size = usdtBalance * 0.1m; // default: %10

        // Günlük kayıp limitine göre kırp
        if (risk.MaxDailyLossUsdt.HasValue)
        {
            var remaining = risk.MaxDailyLossUsdt.Value - risk.DailyLossUsedUsdt;
            size = Math.Min(size, remaining);
        }

        return Math.Max(0, Math.Round(size, 2));
    }

    private static void ResetDailyLossIfNeeded(UserRiskSettings risk)
    {
        var today = DateTime.UtcNow.Date;
        if (risk.DailyLossResetAt?.Date != today)
        {
            risk.DailyLossUsedUsdt = 0;
            risk.DailyLossResetAt = DateTime.UtcNow;
        }
    }

    private static bool IsDailyLossExceeded(UserRiskSettings risk)
    {
        if (risk.MaxDailyLossUsdt.HasValue && risk.DailyLossUsedUsdt >= risk.MaxDailyLossUsdt.Value)
            return true;
        return false;
    }

    private async Task<string?> GetSymbolAsync(int coinId, CancellationToken ct)
    {
        var coin = await db.Coins.FindAsync([coinId], ct);
        return coin?.Symbol;
    }
}
