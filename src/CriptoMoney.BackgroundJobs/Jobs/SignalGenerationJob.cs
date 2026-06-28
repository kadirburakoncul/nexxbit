using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CriptoMoney.BackgroundJobs.Jobs;

public class SignalGenerationJob(
    IApplicationDbContext db,
    IBinanceService binanceService,
    ISignalEngine signalEngine,
    IAutoTradeService autoTradeService,
    FlashCrashDetector flashCrashDetector,
    MomentumTracker momentumTracker,
    ILogger<SignalGenerationJob> logger)
{
    public async Task ExecuteAsync(CancellationToken ct = default)
    {
        logger.LogInformation("Sinyal üretim job'u başladı: {Time}", DateTime.UtcNow);

        await flashCrashDetector.CheckAndApplyAsync(ct);

        var activeStrategies = await db.UserStrategies
            .Include(s => s.StrategyCoins)
                .ThenInclude(sc => sc.Coin)
            .Include(s => s.User)
            .Where(s => s.IsActive && !s.User.IsDeleted)
            .ToListAsync(ct);

        var now = DateTime.UtcNow;
        var strategiesToRun = activeStrategies
            .Where(s => ShouldRunForTimeframe(s.Timeframe, now))
            .ToList();

        logger.LogInformation("Aktif strateji: {Total}, Bu dakika çalışacak: {Run} ({Time})",
            activeStrategies.Count, strategiesToRun.Count, now.ToString("HH:mm"));

        foreach (var strategy in strategiesToRun)
        {
            if (ct.IsCancellationRequested) break;

            if (strategy.IsVolatileMode)
            {
                await ProcessVolatileStrategyAsync(strategy, ct);
            }
            else
            {
                foreach (var strategyCoin in strategy.StrategyCoins)
                {
                    if (ct.IsCancellationRequested) break;
                    try
                    {
                        await ProcessSignalAsync(strategy.UserId, strategyCoin.CoinId,
                            strategyCoin.Coin.Symbol, strategy.Timeframe, ct);
                    }
                    catch (Exception ex)
                    {
                        logger.LogError(ex, "Sinyal üretim hatası: UserId={UserId} Coin={Symbol}",
                            strategy.UserId, strategyCoin.Coin.Symbol);
                    }
                }
            }
        }

        logger.LogInformation("Sinyal üretim job'u tamamlandı: {Time}", DateTime.UtcNow);
    }

    private async Task ProcessVolatileStrategyAsync(
        CriptoMoney.Domain.Entities.UserStrategy strategy, CancellationToken ct)
    {
        var userId = strategy.UserId;
        var timeframe = strategy.Timeframe;
        try
        {
            var minChange = strategy.VolatileMinChangePct > 0 ? strategy.VolatileMinChangePct : 3m;
            var limit = strategy.VolatileGainerLimit > 0 ? strategy.VolatileGainerLimit : 20;

            var gainers = await binanceService.GetTopGainersAsync(minChange, limit, ct);
            if (gainers.Count == 0)
            {
                logger.LogDebug("Volatile mod: Momentum coin bulunamadı. UserId={UserId}", userId);
                return;
            }

            // Momentum fresh-entry filtresi: sadece son N dakikada listeye giren coinler
            var allSymbols = gainers.Select(g => g.Symbol).ToList();
            var freshSymbols = momentumTracker.UpdateAndFilter(
                userId, strategy.Id, allSymbols, strategy.MomentumFreshFilterMinutes);

            if (freshSymbols.Count < allSymbols.Count)
                logger.LogInformation(
                    "Volatile fresh filtre: {Total} gainer → {Fresh} yeni giren (son {Min}dk). UserId={UserId}",
                    allSymbols.Count, freshSymbols.Count, strategy.MomentumFreshFilterMinutes, userId);

            var symbols = freshSymbols.Select(s => s).ToList();
            if (symbols.Count == 0)
            {
                logger.LogDebug("Volatile mod: Tüm coinler zaten listede, fresh giren yok. UserId={UserId}", userId);
                return;
            }

            // DB'de kayıtlı coinleri çek
            var existingCoins = await db.Coins
                .Where(c => symbols.Contains(c.Symbol))
                .Select(c => new { c.Id, c.Symbol })
                .ToListAsync(ct);

            var existingSymbols = existingCoins.Select(c => c.Symbol).ToHashSet();

            // DB'de olmayan gainer coinleri otomatik oluştur (sadece fresh olanlar)
            var freshSet = new HashSet<string>(freshSymbols, StringComparer.OrdinalIgnoreCase);
            var newCoins = gainers
                .Where(g => freshSet.Contains(g.Symbol) && !existingSymbols.Contains(g.Symbol))
                .Select(g => new CriptoMoney.Domain.Entities.Coin
                {
                    Symbol      = g.Symbol,
                    BaseAsset   = g.BaseAsset,
                    QuoteAsset  = "USDT",
                    DisplayName = g.BaseAsset,
                    IsActive    = true,
                })
                .ToList();

            if (newCoins.Count > 0)
            {
                db.Coins.AddRange(newCoins);
                await db.SaveChangesAsync(ct);
                logger.LogInformation("Volatile mod: {Count} yeni coin otomatik eklendi: {Symbols}",
                    newCoins.Count, string.Join(", ", newCoins.Select(c => c.Symbol)));
            }

            // Tüm eşleşen coinleri birleştir (eski + yeni oluşturulanlar)
            var dbCoins = existingCoins
                .Concat(newCoins.Select(c => new { c.Id, c.Symbol }))
                .ToList();

            logger.LogInformation("Volatile mod: {GainerCount} gainer (min%{Min}), {DbCount} işlenecek. UserId={UserId} TF={TF}",
                gainers.Count, minChange, dbCoins.Count, userId, timeframe);

            foreach (var coin in dbCoins)
            {
                if (ct.IsCancellationRequested) break;
                try
                {
                    await ProcessSignalAsync(userId, coin.Id, coin.Symbol, timeframe, ct);
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Volatile sinyal hatası: UserId={UserId} Coin={Symbol}", userId, coin.Symbol);
                }
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "ProcessVolatileStrategyAsync hatası: UserId={UserId}", userId);
        }
    }

    private async Task CloseDroppedMomentumPositionsAsync(
        Guid userId, Guid strategyId, List<string> currentMomentumSymbols, CancellationToken ct)
    {
        var symbolSet = new HashSet<string>(currentMomentumSymbols);

        // Bu volatile stratejiye ait açık sanal pozisyonlar
        var openPositions = await db.Positions
            .Include(p => p.Coin)
            .Where(p => p.UserId == userId
                     && p.StrategyId == strategyId
                     && p.Status == CriptoMoney.Domain.Enums.PositionStatus.Open
                     && p.IsVirtual)
            .ToListAsync(ct);

        var dropped = openPositions
            .Where(p => p.Coin != null && !symbolSet.Contains(p.Coin.Symbol))
            .ToList();

        if (dropped.Count == 0) return;

        foreach (var pos in dropped)
        {
            pos.Status = CriptoMoney.Domain.Enums.PositionStatus.Closed;
            pos.ClosedAt = DateTime.UtcNow;
            pos.CloseReason = "Momentum listesinden çıktı";

            if (pos.EntryPrice > 0)
            {
                // Güncel fiyat almadan entry fiyatı üzerinden kapat (pozisyon gerçek değil)
                pos.RealizedPnlPct = 0;
            }

            logger.LogInformation("Volatile: Momentum dışı sanal pozisyon kapatıldı: {Symbol} StrategyId={SId}",
                pos.Coin!.Symbol, strategyId);
        }

        if (dropped.Count > 0)
            await db.SaveChangesAsync(ct);
    }

    private static bool ShouldRunForTimeframe(string timeframe, DateTime utcNow) => timeframe switch
    {
        "1m"  => true,
        "3m"  => utcNow.Minute % 3 == 0,
        "5m"  => utcNow.Minute % 5 == 0,
        "15m" => utcNow.Minute % 15 == 0,
        "30m" => utcNow.Minute % 30 == 0,
        "1h"  => utcNow.Minute == 0,
        "2h"  => utcNow.Minute == 0 && utcNow.Hour % 2 == 0,
        "4h"  => utcNow.Minute == 0 && utcNow.Hour % 4 == 0,
        "6h"  => utcNow.Minute == 0 && utcNow.Hour % 6 == 0,
        "8h"  => utcNow.Minute == 0 && utcNow.Hour % 8 == 0,
        "12h" => utcNow.Minute == 0 && utcNow.Hour % 12 == 0,
        "1d"  => utcNow.Minute == 0 && utcNow.Hour == 0,
        _     => true,
    };

    private async Task ProcessSignalAsync(
        Guid userId, int coinId, string symbol, string timeframe, CancellationToken ct)
    {
        var signal = await signalEngine.GenerateSignalAsync(userId, coinId, symbol, timeframe, ct);

        if (signal is null)
        {
            logger.LogDebug("Sinyal yok: {Symbol} {Timeframe} UserId={UserId}", symbol, timeframe, userId);
            return;
        }

        logger.LogInformation("Sinyal: {Symbol} {Direction} Score={Score:F2} UserId={UserId}",
            symbol, signal.Direction, signal.TotalScore, userId);

        await autoTradeService.ProcessSignalAsync(signal, ct);
    }
}
