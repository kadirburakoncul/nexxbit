using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Domain.Entities;
using CriptoMoney.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CriptoMoney.Infrastructure.Services;

/// <summary>
/// BTC/USDT fiyatını izler. N dakikada % düşüş tespit edilince FullAuto trade'i duraklatır.
/// SignalGenerationJob her 15dk'da çağırır.
/// </summary>
public class FlashCrashDetector(
    IApplicationDbContext db,
    IBinanceService binance,
    ITelegramService telegram,
    ILogger<FlashCrashDetector> logger)
{
    private const string ReferenceSymbol = "BTCUSDT";

    public async Task CheckAndApplyAsync(CancellationToken ct = default)
    {
        // Flash crash koruması aktif olan ve FullAuto trade'de kullanıcılar
        var settings = await db.UserRiskSettings
            .Where(s => s.FlashCrashProtectionEnabled && s.IsAutoTradeEnabled)
            .ToListAsync(ct);

        if (settings.Count == 0) return;

        var currentPrice = await binance.GetCurrentPriceAsync(ReferenceSymbol, ct);
        if (currentPrice is null) return;

        // Referans: windowMinutes önce açılış fiyatı → son N adet 1m candle'ın ilk Close'u
        foreach (var setting in settings)
        {
            if (ct.IsCancellationRequested) break;
            await ProcessUserSettingAsync(setting, currentPrice.Value, ct);
        }

        await db.SaveChangesAsync(ct);
    }

    private async Task ProcessUserSettingAsync(
        UserRiskSettings setting, decimal currentPrice, CancellationToken ct = default)
    {
        // Referans fiyat: windowMinutes önce
        var windowMinutes = Math.Max(setting.FlashCrashWindowMinutes, 1);
        var candles = await binance.GetCandlesAsync(
            ReferenceSymbol, "1m", windowMinutes + 1, ct);

        if (!candles.Succeeded || candles.Data is null || candles.Data.Count < 2) return;

        var referencePrice = candles.Data.First().Open;
        if (referencePrice <= 0) return;

        var dropPct = (referencePrice - currentPrice) / referencePrice * 100m;

        if (dropPct >= setting.FlashCrashDropPct && !setting.AutoTradePaused)
        {
            setting.AutoTradePaused = true;
            setting.AutoTradePausedAt = DateTime.UtcNow;

            logger.LogWarning(
                "Flash crash tespit edildi! BTC {Window}dk'da %{Drop:F2} düştü. UserId={UserId} — FullAuto durduruldu.",
                windowMinutes, dropPct, setting.UserId);

            db.Notifications.Add(new Notification
            {
                UserId = setting.UserId,
                Type = NotificationType.FlashCrash,
                Title = "Flash Crash Koruması Aktif",
                Body = $"BTC son {windowMinutes} dakikada %{dropPct:F2} düştü. Otomatik işlemler durduruldu.",
            });

            if (setting.TelegramEnabled
                && !string.IsNullOrWhiteSpace(setting.TelegramBotToken)
                && !string.IsNullOrWhiteSpace(setting.TelegramChatId))
            {
                await telegram.SendAsync(setting.TelegramBotToken, setting.TelegramChatId,
                    $"🚨 <b>Flash Crash Koruması Aktif!</b>\n" +
                    $"BTC son {windowMinutes} dk'da %{dropPct:F2} düştü.\n" +
                    $"Otomatik işlemler durduruldu.", ct);
            }
        }
        else if (dropPct < setting.FlashCrashDropPct * 0.5m && setting.AutoTradePaused)
        {
            setting.AutoTradePaused = false;
            setting.AutoTradePausedAt = null;

            logger.LogInformation(
                "Flash crash koruması kaldırıldı. UserId={UserId}", setting.UserId);

            db.Notifications.Add(new Notification
            {
                UserId = setting.UserId,
                Type = NotificationType.System,
                Title = "Otomatik İşlemler Devam Ediyor",
                Body = "Piyasa toparlandı. Otomatik işlemler yeniden etkinleştirildi.",
            });

            if (setting.TelegramEnabled
                && !string.IsNullOrWhiteSpace(setting.TelegramBotToken)
                && !string.IsNullOrWhiteSpace(setting.TelegramChatId))
            {
                await telegram.SendAsync(setting.TelegramBotToken, setting.TelegramChatId,
                    $"✅ <b>Flash Crash Koruması Kaldırıldı</b>\n" +
                    $"Piyasa toparlandı. Otomatik işlemler devam ediyor.", ct);
            }
        }
    }
}
