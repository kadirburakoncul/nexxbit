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

                // Toplam değeri USDT bakiyesi + diğer varlıkları yaklaşık hesapla
                // Basit versiyon: sadece USDT bakiyesini al (tam implementasyon için fiyat feed gerekli)
                var usdtBalance = nonZero
                    .Where(b => b.Asset == "USDT")
                    .Sum(b => b.Free + b.Locked);

                snapshots.Add(new BalanceSnapshot
                {
                    UserId = userId,
                    TotalValueUsdt = usdtBalance,
                    Assets = JsonSerializer.Serialize(
                        nonZero.Select(b => new { b.Asset, Total = b.Free + b.Locked })),
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
