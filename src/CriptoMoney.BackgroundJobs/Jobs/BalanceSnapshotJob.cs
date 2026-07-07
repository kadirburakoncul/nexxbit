using System.Text.Json;
using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CriptoMoney.BackgroundJobs.Jobs;

/// <summary>
/// Her gün gece 00:05 UTC'de tüm Binance bağlı kullanıcıların bakiyesini kaydeder.
/// Portföy P&L geçmişi ve grafik için kullanılır.
/// </summary>
public class BalanceSnapshotJob(
    IApplicationDbContext db,
    IBinanceService binance,
    ILogger<BalanceSnapshotJob> logger)
{
    public async Task ExecuteAsync(CancellationToken ct = default)
    {
        logger.LogInformation("Bakiye snapshot job'u başladı: {Time}", DateTime.UtcNow);

        var connectedUsers = await db.UserBinanceAccounts
            .Where(a => a.IsActive)
            .Select(a => a.UserId)
            .ToListAsync(ct);

        logger.LogInformation("Bağlı kullanıcı sayısı: {Count}", connectedUsers.Count);

        var snapshots = new List<BalanceSnapshot>();

        foreach (var userId in connectedUsers)
        {
            if (ct.IsCancellationRequested) break;

            try
            {
                var balanceResult = await binance.GetBalancesAsync(userId, ct);
                if (!balanceResult.Succeeded || balanceResult.Data is null) continue;

                var nonZero = balanceResult.Data
                    .Where(b => b.Free + b.Locked > 0)
                    .ToList();

                // Tüm USDT-dışı varlıkların güncel fiyatını çek (toplu, hata olursa tek tek dener)
                var nonUsdtSymbols = nonZero
                    .Where(b => b.Asset != "USDT")
                    .Select(b => b.Asset + "USDT")
                    .Distinct()
                    .ToList();

                var prices = await binance.GetBulkPricesAsync(nonUsdtSymbols, ct);

                // Bulk çağrı bazı sembolleri döndürmediyse (örn. Earn/Locked tokenlar) tek tek dene
                var missing = nonUsdtSymbols.Where(s => !prices.ContainsKey(s)).ToList();
                foreach (var sym in missing)
                {
                    var p = await binance.GetCurrentPriceAsync(sym, ct);
                    if (p.HasValue) prices[sym] = p.Value;
                }

                decimal totalValueUsdt = 0;
                var assetBreakdown = new List<object>();
                foreach (var b in nonZero)
                {
                    var qty = b.Free + b.Locked;
                    var valueUsdt = b.Asset == "USDT"
                        ? qty
                        : prices.TryGetValue(b.Asset + "USDT", out var price) ? qty * price : 0m;

                    totalValueUsdt += valueUsdt;
                    assetBreakdown.Add(new { b.Asset, Total = qty, ValueUsdt = Math.Round(valueUsdt, 2) });
                }

                snapshots.Add(new BalanceSnapshot
                {
                    UserId = userId,
                    TotalValueUsdt = Math.Round(totalValueUsdt, 2),
                    Assets = JsonSerializer.Serialize(assetBreakdown),
                    SnapshotAt = DateTime.UtcNow,
                });
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Bakiye snapshot hatası: UserId={UserId}", userId);
            }
        }

        if (snapshots.Count > 0)
        {
            db.BalanceSnapshots.AddRange(snapshots);
            await db.SaveChangesAsync(ct);
        }

        logger.LogInformation("Bakiye snapshot tamamlandı: {Count} kullanıcı kaydedildi", snapshots.Count);
    }
}
