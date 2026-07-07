using CriptoMoney.Application.Common.Email;
using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CriptoMoney.BackgroundJobs.Jobs;

/// <summary>
/// Her gün 08:00 UTC'de tüm kullanıcılara günlük performans raporu gönderir.
/// Yalnızca önceki günde aktivitesi olan kullanıcılara gönderilir.
/// </summary>
public class DailyReportJob(
    IApplicationDbContext db,
    IEmailService emailService,
    ILogger<DailyReportJob> logger)
{
    public async Task ExecuteAsync(CancellationToken ct = default)
    {
        logger.LogInformation("Günlük rapor job'u başladı: {Time}", DateTime.UtcNow);

        var yesterday  = DateTime.UtcNow.Date.AddDays(-1);
        var todayStart = yesterday;
        var todayEnd   = yesterday.AddDays(1);

        var activeUserIds = await db.TradeSignals
            .Where(s => s.CreatedAt >= todayStart && s.CreatedAt < todayEnd)
            .Select(s => s.UserId)
            .Distinct()
            .ToListAsync(ct);

        // Dün pozisyon kapatan ama sinyal üretmeyenler de dahil
        var posUserIds = await db.Positions
            .Where(p => p.IsVirtual && p.ClosedAt >= todayStart && p.ClosedAt < todayEnd)
            .Select(p => p.UserId)
            .Distinct()
            .ToListAsync(ct);

        var userIds = activeUserIds.Union(posUserIds).Distinct().ToList();
        logger.LogInformation("Rapor gönderilecek kullanıcı: {Count}", userIds.Count);

        foreach (var userId in userIds)
        {
            if (ct.IsCancellationRequested) break;
            try { await SendReportAsync(userId, todayStart, todayEnd, ct); }
            catch (Exception ex) { logger.LogError(ex, "Günlük rapor hatası: UserId={UserId}", userId); }
        }

        logger.LogInformation("Günlük rapor job'u tamamlandı");
    }

    private static string HoldBucket(DateTime opened, DateTime closed)
    {
        var mins = (closed - opened).TotalMinutes;
        return mins switch
        {
            < 5   => "0–5dk",
            < 15  => "5–15dk",
            < 30  => "15–30dk",
            < 60  => "30–60dk",
            < 180 => "1–3sa",
            _     => "3sa+"
        };
    }

    private async Task SendReportAsync(Guid userId, DateTime from, DateTime to, CancellationToken ct)
    {
        var user = await db.Users.FindAsync([userId], ct);
        if (user is null) return;

        // Dün kapatılan sanal pozisyonlar (Coin navigation dahil)
        var positions = await db.Positions
            .Include(p => p.Coin)
            .Where(p => p.UserId == userId
                && p.Status == PositionStatus.Closed
                && p.IsVirtual
                && p.ClosedAt >= from
                && p.ClosedAt < to)
            .OrderByDescending(p => p.ClosedAt)
            .ToListAsync(ct);

        var totalSignals = await db.TradeSignals
            .CountAsync(s => s.UserId == userId && s.CreatedAt >= from && s.CreatedAt < to, ct);

        if (positions.Count == 0 && totalSignals == 0) return;

        var openPositions = await db.Positions
            .CountAsync(p => p.UserId == userId && p.Status == PositionStatus.Open && p.IsVirtual, ct);

        // --- Temel istatistikler ---
        var wins     = positions.Where(p => (p.RealizedPnlPct ?? 0) > 0).ToList();
        var losses   = positions.Where(p => (p.RealizedPnlPct ?? 0) <= 0).ToList();
        var withPct  = positions.Where(p => p.RealizedPnlPct != null).ToList();
        var avgPct   = withPct.Count > 0 ? withPct.Average(p => p.RealizedPnlPct!.Value) : 0m;
        var netUsdt  = positions.Where(p => p.RealizedPnl != null).Sum(p => p.RealizedPnl!.Value);
        var avgWin   = wins.Where(p => p.RealizedPnlPct != null)
                          .Select(p => p.RealizedPnlPct!.Value).DefaultIfEmpty(0).Average();
        var avgLoss  = losses.Where(p => p.RealizedPnlPct != null)
                          .Select(p => p.RealizedPnlPct!.Value).DefaultIfEmpty(0).Average();
        var profitFactor = avgLoss != 0 ? Math.Abs(avgWin / avgLoss) : 0m;

        // --- Kapatma nedenine göre ---
        var byReason = positions
            .GroupBy(p => p.CloseReason ?? "Diğer")
            .Select(g => new ReasonStat(
                g.Key,
                g.Count(),
                g.Count(p => (p.RealizedPnlPct ?? 0) > 0),
                g.Where(p => p.RealizedPnlPct != null)
                 .Select(p => p.RealizedPnlPct!.Value).DefaultIfEmpty(0).Average()))
            .OrderByDescending(r => r.Count)
            .ToList();

        // --- Tutma süresine göre ---
        var holdOrder = new[] { "0–5dk", "5–15dk", "15–30dk", "30–60dk", "1–3sa", "3sa+" };
        var holdMap   = positions
            .Where(p => p.ClosedAt.HasValue)
            .GroupBy(p => HoldBucket(p.OpenedAt, p.ClosedAt!.Value))
            .ToDictionary(g => g.Key, g => g.ToList());
        var byHold = holdOrder.Select(k =>
        {
            var list = holdMap.GetValueOrDefault(k, []);
            return new HoldStat(
                k,
                list.Count,
                list.Count(p => (p.RealizedPnlPct ?? 0) > 0),
                list.Count > 0
                    ? list.Where(p => p.RealizedPnlPct != null)
                          .Select(p => p.RealizedPnlPct!.Value).DefaultIfEmpty(0).Average()
                    : 0m);
        }).ToList();

        // --- En iyi / kötü 5 ---
        var ctr    = new System.Globalization.CultureInfo("tr-TR");
        var sorted = positions
            .Where(p => p.RealizedPnlPct != null)
            .OrderByDescending(p => p.RealizedPnlPct!.Value)
            .ToList();

        TradeLine ToLine(Domain.Entities.Position p) => new(
            p.Coin.Symbol,
            p.RealizedPnlPct ?? 0,
            p.RealizedPnl,
            p.ClosedAt!.Value.ToString("dd.MM HH:mm", ctr),
            p.CloseReason);

        var topWinners = sorted.Take(5).Select(ToLine).ToList();
        var topLosers  = sorted.TakeLast(5).Reverse().Select(ToLine).ToList();
        var recent     = positions.Take(10).Select(ToLine).ToList();

        var html = EmailTemplates.TradingAnalysisReport(
            user.FirstName,
            from,
            positions.Count,
            wins.Count,
            losses.Count,
            avgPct,
            avgWin,
            avgLoss,
            netUsdt,
            profitFactor,
            byReason,
            byHold,
            topWinners,
            topLosers,
            recent);

        await emailService.SendAsync(user.Email,
            $"Nexxbit — {from:dd MMM yyyy} Trader Raporu",
            html, ct);

        var pnlSign = netUsdt >= 0 ? "+" : "";
        db.Notifications.Add(new Domain.Entities.Notification
        {
            UserId = userId,
            Type   = NotificationType.DailyReport,
            Title  = $"Günlük Rapor — {from:dd MMM yyyy}",
            Body   = $"{positions.Count} kapalı pozisyon, {wins.Count}K/{losses.Count}K. " +
                     $"Net P&L: {pnlSign}{netUsdt:F2} USDT · Açık: {openPositions}",
        });
        await db.SaveChangesAsync(ct);
    }
}
