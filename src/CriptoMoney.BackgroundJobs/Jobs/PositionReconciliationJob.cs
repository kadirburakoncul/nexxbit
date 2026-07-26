using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CriptoMoney.BackgroundJobs.Jobs;

/// <summary>
/// Binance cüzdanı ile DB'deki açık gerçek pozisyonları karşılaştırır.
///
/// Neden var: 2026-07 döneminde DB'de "açık" görünen AVAXUSDT pozisyonunun cüzdan
/// bakiyesi 0'dı — coin elde yoktu ama sistem 17 gün boyunca onu izlemeye devam etti.
/// Bu tür hayalet pozisyonlar hem yanlış P&amp;L raporlar hem de MaxOpenPositions
/// kotasını doldurarak yeni işlemleri engeller.
///
/// Job yalnızca RAPORLAR ve işaretler; pozisyonu kendi başına kapatmaz —
/// kapatma kararı TrailingStopMonitorService'in satış akışına aittir.
/// </summary>
public class PositionReconciliationJob(
    IApplicationDbContext db,
    IBinanceService binance,
    ILogger<PositionReconciliationJob> logger)
{
    /// <summary>Cüzdan bakiyesi pozisyon miktarının bu oranının altındaysa uyumsuz sayılır.</summary>
    private const decimal MismatchThreshold = 0.5m;

    public async Task ExecuteAsync(CancellationToken ct = default)
    {
        var openPositions = await db.Positions
            .Include(p => p.Coin)
            .Where(p => p.Status == PositionStatus.Open && !p.IsVirtual)
            .ToListAsync(ct);

        if (openPositions.Count == 0)
        {
            logger.LogDebug("Mutabakat: açık gerçek pozisyon yok");
            return;
        }

        var mismatches = 0;

        foreach (var userGroup in openPositions.GroupBy(p => p.UserId))
        {
            var balancesResult = await binance.GetBalancesAsync(userGroup.Key, ct);
            if (!balancesResult.Succeeded || balancesResult.Data is null)
            {
                logger.LogWarning("Mutabakat: {UserId} için bakiye alınamadı — atlandı", userGroup.Key);
                continue;
            }

            var balances = balancesResult.Data
                .ToDictionary(b => b.Asset, b => b.Free + b.Locked, StringComparer.OrdinalIgnoreCase);

            foreach (var position in userGroup)
            {
                if (ct.IsCancellationRequested) return;

                var baseAsset = ExtractBaseAsset(position.Coin.Symbol);
                balances.TryGetValue(baseAsset, out var walletQty);

                if (position.EntryQuantity <= 0) continue;

                var ratio = walletQty / position.EntryQuantity;
                if (ratio >= MismatchThreshold) continue;

                mismatches++;
                logger.LogWarning(
                    "MUTABAKATSIZLIK: {Symbol} pozisyonu DB'de {DbQty} coin diyor, cüzdanda {WalletQty} var " +
                    "({Ratio:P0}). PositionId={Id}, {Hours:F1}sa açık. Coin elde yoksa pozisyon hayalettir.",
                    position.Coin.Symbol, position.EntryQuantity, walletQty, ratio,
                    position.Id, (DateTime.UtcNow - position.OpenedAt).TotalHours);
            }
        }

        if (mismatches == 0)
            logger.LogInformation("Mutabakat tamam: {Count} açık pozisyonun tamamı cüzdanla uyumlu", openPositions.Count);
        else
            logger.LogWarning("Mutabakat: {Count} pozisyonda uyumsuzluk tespit edildi", mismatches);
    }

    private static string ExtractBaseAsset(string symbol)
    {
        foreach (var quote in new[] { "USDT", "FDUSD", "TUSD", "BUSD", "USDC", "TRY", "BTC", "ETH", "BNB" })
            if (symbol.EndsWith(quote, StringComparison.OrdinalIgnoreCase))
                return symbol[..^quote.Length];
        return symbol;
    }
}
