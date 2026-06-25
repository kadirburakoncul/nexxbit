using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Domain.Entities;
using CriptoMoney.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace CriptoMoney.Infrastructure.Services;

/// <summary>
/// Açık pozisyonları 2 saniyede bir izler.
/// Trailing stop (%X tepe fiyattan düşüş) veya stop loss (%X giriş fiyatından düşüş) tetiklendiğinde
/// SAT sinyali oluşturur, pozisyonu kapatır ve re-entry state'i günceller.
/// </summary>
public class TrailingStopMonitorService(
    IServiceScopeFactory scopeFactory,
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
        var db = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();
        var binance = scope.ServiceProvider.GetRequiredService<IBinanceService>();

        var openPositions = await db.Positions
            .Include(p => p.Coin)
            .Where(p => p.Status == PositionStatus.Open)   // hem sanal hem gerçek
            .ToListAsync(ct);

        if (openPositions.Count == 0) return;

        var coinIds = openPositions.Select(p => p.CoinId).Distinct().ToList();
        var strategyCoins = await db.UserStrategyCoins
            .Include(sc => sc.UserStrategy)
            .Where(sc => coinIds.Contains(sc.CoinId))
            .ToListAsync(ct);

        foreach (var position in openPositions)
        {
            if (ct.IsCancellationRequested) break;

            try
            {
                await CheckPositionAsync(db, binance, position, strategyCoins, ct);
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
        CancellationToken ct)
    {
        var currentPrice = await binance.GetCurrentPriceAsync(position.Coin.Symbol, ct);
        if (currentPrice is null) return;

        // Tepe fiyatı güncelle (high watermark)
        if (position.TrailingStopHighWatermark is null || currentPrice > position.TrailingStopHighWatermark)
        {
            position.TrailingStopHighWatermark = currentPrice;
            await db.SaveChangesAsync(ct);
        }

        var peak  = position.TrailingStopHighWatermark!.Value;
        var entry = position.EntryPrice;

        // Strateji trailing/stop ayarlarını bul
        var strategyCoin = strategyCoins
            .FirstOrDefault(sc => sc.CoinId == position.CoinId && sc.UserStrategy.UserId == position.UserId);

        // Trailing stop %'si: pozisyona kayıtlıysa onu kullan, yoksa stratejideki
        var trailingPct = position.TrailingStopPct
            ?? strategyCoin?.UserStrategy.TrailingStopPct
            ?? 0.30m;

        var stopLossPct = strategyCoin?.UserStrategy.StopLossPct ?? 0.30m;

        var trailingTrigger = peak  * (1 - trailingPct / 100m);
        var stopLossTrigger = entry * (1 - stopLossPct / 100m);

        ExitReason? exitReason = null;
        if (currentPrice <= trailingTrigger) exitReason = ExitReason.TrailingStop;
        else if (currentPrice <= stopLossTrigger) exitReason = ExitReason.StopLoss;

        if (exitReason is null) return;

        logger.LogWarning("{Reason} tetiklendi: {Symbol} [{Type}] giriş={Entry:F6} tepe={Peak:F6} şimdi={Now:F6}",
            exitReason, position.Coin.Symbol, position.IsVirtual ? "sanal" : "gerçek", entry, peak, currentPrice);

        // Pozisyonu kapat
        position.Status = PositionStatus.Closed;
        position.ClosePrice = currentPrice;
        position.ClosedAt = DateTime.UtcNow;
        position.RealizedPnlPct = Math.Round((currentPrice.Value - entry) / entry * 100m, 4);

        if (position.IsVirtual)
        {
            // Sanal pozisyon: sadece kayıt güncelle, gerçek emir yok
            await db.SaveChangesAsync(ct);
            logger.LogInformation("Sanal pozisyon kapatıldı (trailing): {Symbol} PnL%={Pnl:F4}",
                position.Coin.Symbol, position.RealizedPnlPct);
            return;
        }

        // Gerçek pozisyon: PnL hesapla, SAT sinyali oluştur
        position.CloseValueUsdt = currentPrice * position.EntryQuantity;
        position.RealizedPnl = Math.Round(((currentPrice.Value - entry) / entry) * position.EntryValueUsdt, 4);

        var sellSignal = new TradeSignal
        {
            UserId = position.UserId,
            CoinId = position.CoinId,
            Timeframe = strategyCoin?.UserStrategy.Timeframe ?? "1h",
            Direction = SignalDirection.Sell,
            TotalScore = -1m,
            CandleTime = DateTime.UtcNow,
            Price = currentPrice.Value,
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

        logger.LogInformation("Trailing/Stop sinyal oluşturuldu: {Symbol} {Exit} fiyat={Price:F6}",
            position.Coin.Symbol, exitReason, currentPrice);
    }

    private enum ExitReason { TrailingStop, StopLoss }
}
