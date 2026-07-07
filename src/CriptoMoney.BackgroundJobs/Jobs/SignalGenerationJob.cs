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

            // Volatile cleanup: güncel gainers listesinde olmayan ve 30dk'dır taranmayan coinleri temizle
            // Böylece monitör sadece aktif coinleri gösterir, geçmiş birikimi değil.
            var allSymbolSet   = new HashSet<string>(allSymbols, StringComparer.OrdinalIgnoreCase);
            var cleanupCutoff  = DateTime.UtcNow.AddMinutes(-30);
            var candidates     = await db.UserStrategyCoins
                .Include(sc => sc.Coin)
                .Where(sc => sc.UserStrategyId == strategy.Id
                          && (sc.LastCheckedAt == null || sc.LastCheckedAt < cleanupCutoff))
                .ToListAsync(ct);
            var staleCoins = candidates
                .Where(sc => !allSymbolSet.Contains(sc.Coin?.Symbol ?? ""))
                .ToList();
            if (staleCoins.Count > 0)
            {
                db.UserStrategyCoins.RemoveRange(staleCoins);
                await db.SaveChangesAsync(ct);
                logger.LogDebug("Volatile cleanup: {Count} eski coin kaldırıldı.", staleCoins.Count);
            }

            var freshSymbols = momentumTracker.UpdateAndFilter(
                userId, strategy.Id, allSymbols, strategy.MomentumFreshFilterMinutes);

            if (freshSymbols.Count < allSymbols.Count)
                logger.LogInformation(
                    "Volatile fresh filtre: {Total} gainer → {Fresh} yeni giren (son {Min}dk). UserId={UserId}",
                    allSymbols.Count, freshSymbols.Count, strategy.MomentumFreshFilterMinutes, userId);

            // MomentumDropped kapanmaları devre dışı — çok erken 0% çıkış üretiyordu.
            // Çıkış artık yalnızca TrailingStop / StopLoss / T3-SAT ile olur.
            // await CloseDroppedMomentumPositionsAsync(userId, strategy.Id, allSymbols, ct);

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

            // Gainers sıralamasını koru: en yüksek %değişim önce (5 slot için en güçlü momentum öncelikli)
            var gainersRank = gainers
                .Select((g, i) => (g.Symbol, Rank: i))
                .ToDictionary(x => x.Symbol, x => x.Rank, StringComparer.OrdinalIgnoreCase);

            var dbCoins = existingCoins
                .Concat(newCoins.Select(c => new { c.Id, c.Symbol }))
                .OrderBy(c => gainersRank.TryGetValue(c.Symbol, out var r) ? r : int.MaxValue)
                .ToList();

            logger.LogInformation("Volatile mod: {GainerCount} gainer (min%{Min}), {DbCount} işlenecek. UserId={UserId} TF={TF}",
                gainers.Count, minChange, dbCoins.Count, userId, timeframe);

            foreach (var coin in dbCoins)
            {
                if (ct.IsCancellationRequested) break;
                try
                {
                    await ProcessSignalAsync(userId, coin.Id, coin.Symbol, timeframe, ct, strategy.Id);
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
        var symbolSet = new HashSet<string>(currentMomentumSymbols, StringComparer.OrdinalIgnoreCase);

        // Bu volatile stratejiye ait açık pozisyonlar (sanal + gerçek)
        var openPositions = await db.Positions
            .Include(p => p.Coin)
            .Where(p => p.UserId == userId
                     && p.StrategyId == strategyId
                     && p.Status == CriptoMoney.Domain.Enums.PositionStatus.Open)
            .ToListAsync(ct);

        var dropped = openPositions
            .Where(p => p.Coin != null && !symbolSet.Contains(p.Coin.Symbol))
            .ToList();

        if (dropped.Count == 0) return;

        foreach (var pos in dropped)
        {
            // LastCheckedPrice'ı kapanış fiyatı olarak kullan (mevcut fiyata en yakın)
            var strategyCoin = await db.UserStrategyCoins
                .FirstOrDefaultAsync(sc => sc.UserStrategyId == strategyId && sc.CoinId == pos.CoinId, ct);
            var closePrice = strategyCoin?.LastCheckedPrice ?? pos.EntryPrice;

            pos.Status     = CriptoMoney.Domain.Enums.PositionStatus.Closed;
            pos.ClosedAt   = DateTime.UtcNow;
            pos.ClosePrice = closePrice;
            pos.CloseReason = "Momentum listesinden çıktı";

            if (pos.EntryPrice > 0)
            {
                pos.RealizedPnlPct = Math.Round((closePrice - pos.EntryPrice) / pos.EntryPrice * 100m, 4);
                pos.CloseValueUsdt = pos.EntryValueUsdt > 0
                    ? Math.Round(pos.EntryValueUsdt * (1m + pos.RealizedPnlPct.Value / 100m), 4)
                    : Math.Round(closePrice * pos.EntryQuantity, 4);
                pos.RealizedPnl = Math.Round((pos.CloseValueUsdt ?? 0m) - pos.EntryValueUsdt, 4);
            }

            logger.LogInformation(
                "Volatile: Momentum dışı pozisyon kapatıldı: {Symbol} IsVirtual={V} P&L%={Pnl:F4} P&L$={PnlUsdt:F2}",
                pos.Coin!.Symbol, pos.IsVirtual, pos.RealizedPnlPct, pos.RealizedPnl);
        }

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
        Guid userId, int coinId, string symbol, string timeframe, CancellationToken ct,
        Guid? strategyId = null)
    {
        var signal = await signalEngine.GenerateSignalAsync(userId, coinId, symbol, timeframe, ct, strategyId);

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
