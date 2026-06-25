using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CriptoMoney.BackgroundJobs.Jobs;

public class SignalGenerationJob(
    IApplicationDbContext db,
    ISignalEngine signalEngine,
    IAutoTradeService autoTradeService,
    FlashCrashDetector flashCrashDetector,
    ILogger<SignalGenerationJob> logger)
{
    public async Task ExecuteAsync(CancellationToken ct = default)
    {
        logger.LogInformation("Sinyal üretim job'u başladı: {Time}", DateTime.UtcNow);

        await flashCrashDetector.CheckAndApplyAsync(ct);

        // Tüm aktif stratejileri yükle (Binance bağlantısı artık zorunlu değil)
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

        logger.LogInformation("Sinyal üretim job'u tamamlandı: {Time}", DateTime.UtcNow);
    }

    // Her timeframe her dakika kontrol edilir.
    // T3 yön değişimi mantığı zaten tekrar sinyal üretimini engeller.
    private static bool ShouldRunForTimeframe(string timeframe, DateTime utcNow) => true;

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
