using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Domain.Enums;
using CriptoMoney.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CriptoMoney.BackgroundJobs.Jobs;

/// <summary>
/// Her gün 08:00 UTC'de tüm kullanıcılara günlük performans raporu gönderir.
/// Sadece önceki günde aktivite olan kullanıcılara gönderilir.
/// </summary>
public class DailyReportJob(
    IApplicationDbContext db,
    IEmailService emailService,
    ILogger<DailyReportJob> logger)
{
    public async Task ExecuteAsync(CancellationToken ct = default)
    {
        logger.LogInformation("Günlük rapor job'u başladı: {Time}", DateTime.UtcNow);

        var yesterday = DateTime.UtcNow.Date.AddDays(-1);
        var todayStart = yesterday;
        var todayEnd = yesterday.AddDays(1);

        // Dün aktivite olan kullanıcıları bul
        var activeUserIds = await db.TradeSignals
            .Where(s => s.CreatedAt >= todayStart && s.CreatedAt < todayEnd)
            .Select(s => s.UserId)
            .Distinct()
            .ToListAsync(ct);

        logger.LogInformation("Rapor gönderilecek kullanıcı: {Count}", activeUserIds.Count);

        foreach (var userId in activeUserIds)
        {
            if (ct.IsCancellationRequested) break;

            try
            {
                await SendReportAsync(userId, todayStart, todayEnd, ct);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Günlük rapor hatası: UserId={UserId}", userId);
            }
        }

        logger.LogInformation("Günlük rapor job'u tamamlandı");
    }

    private async Task SendReportAsync(
        Guid userId, DateTime from, DateTime to, CancellationToken ct)
    {
        var user = await db.Users.FindAsync([userId], ct);
        if (user is null) return;

        var totalSignals = await db.TradeSignals
            .CountAsync(s => s.UserId == userId && s.CreatedAt >= from && s.CreatedAt < to, ct);

        var filledOrders = await db.TradeOrders
            .CountAsync(o => o.UserId == userId
                && o.Status == OrderStatus.Filled
                && o.CreatedAt >= from && o.CreatedAt < to, ct);

        var realizedPnl = await db.Positions
            .Where(p => p.UserId == userId
                && p.Status == PositionStatus.Closed
                && p.ClosedAt >= from && p.ClosedAt < to)
            .SumAsync(p => (decimal?)p.RealizedPnl ?? 0, ct);

        var riskSettings = await db.UserRiskSettings
            .FirstOrDefaultAsync(r => r.UserId == userId, ct);

        var openPositions = await db.Positions
            .CountAsync(p => p.UserId == userId && p.Status == PositionStatus.Open, ct);

        // Sadece aktivite varsa gönder (sinyalsiz günlerde spam olmasın)
        if (totalSignals == 0 && filledOrders == 0) return;

        var html = EmailTemplates.DailyReport(
            user.FirstName,
            totalSignals,
            filledOrders,
            realizedPnl,
            riskSettings?.DailyLossUsedUsdt ?? 0,
            openPositions);

        await emailService.SendAsync(user.Email,
            $"CriptoMoney — {from:dd MMM yyyy} Günlük Rapor",
            html, ct);

        // Uygulama içi bildirim de oluştur
        db.Notifications.Add(new Domain.Entities.Notification
        {
            UserId = userId,
            Type = NotificationType.DailyReport,
            Title = "Günlük Rapor Hazır",
            Body = $"{from:dd.MM.yyyy} günü: {totalSignals} sinyal, {filledOrders} emir, {realizedPnl:+0.00;-0.00;0} USDT P&L",
        });
        await db.SaveChangesAsync(ct);
    }
}
