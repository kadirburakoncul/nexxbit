using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using CriptoMoney.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CriptoMoney.Application.Features.Analytics.Queries.GetAnalytics;

public class GetAnalyticsQueryHandler(IApplicationDbContext db)
    : IRequestHandler<GetAnalyticsQuery, Result<AnalyticsDto>>
{
    public async Task<Result<AnalyticsDto>> Handle(GetAnalyticsQuery req, CancellationToken ct)
    {
        var query = db.Positions
            .Include(p => p.Coin)
            .Where(p => p.UserId == req.UserId
                     && p.Status == PositionStatus.Closed
                     && p.ClosedAt.HasValue
                     && p.RealizedPnl.HasValue);

        if (req.VirtualOnly)
            query = query.Where(p => p.IsVirtual);

        var positions = await query
            .OrderBy(p => p.ClosedAt)
            .ToListAsync(ct);

        if (positions.Count == 0)
            return Result<AnalyticsDto>.Success(EmptyResult());

        // --- Summary ---
        var wins   = positions.Where(p => p.RealizedPnl!.Value > 0).ToList();
        var losses = positions.Where(p => p.RealizedPnl!.Value <= 0).ToList();

        var totalPnl   = positions.Sum(p => p.RealizedPnl!.Value);
        var winRate    = positions.Count > 0 ? Math.Round((decimal)wins.Count / positions.Count * 100m, 2) : 0;
        var avgWinPct  = wins.Count   > 0 ? Math.Round(wins  .Average(p => p.RealizedPnlPct ?? 0), 2) : 0;
        var avgLossPct = losses.Count > 0 ? Math.Round(losses.Average(p => p.RealizedPnlPct ?? 0), 2) : 0;

        var grossWin  = wins.Sum(p => p.RealizedPnl!.Value);
        var grossLoss = Math.Abs(losses.Sum(p => p.RealizedPnl!.Value));
        var profitFactor = grossLoss > 0 ? Math.Round(grossWin / grossLoss, 2) : grossWin > 0 ? 999m : 0m;

        var avgHold = positions
            .Where(p => p.ClosedAt.HasValue)
            .Average(p => (p.ClosedAt!.Value - p.OpenedAt).TotalHours);

        // --- Daily P&L ---
        var dailyGroups = positions
            .GroupBy(p => p.ClosedAt!.Value.Date)
            .OrderBy(g => g.Key)
            .ToList();

        var cumulative = 0m;
        var dailyPnls = dailyGroups.Select(g =>
        {
            var day = g.Sum(p => p.RealizedPnl!.Value);
            cumulative += day;
            return new DailyPnl(
                g.Key.ToString("yyyy-MM-dd"),
                Math.Round(day, 4),
                g.Count(),
                Math.Round(cumulative, 4)
            );
        }).ToList();

        // --- Drawdown ---
        var peak = 0m;
        var drawdown = dailyPnls.Select(d =>
        {
            if (d.CumulativePnl > peak) peak = d.CumulativePnl;
            var dd = peak > 0 ? Math.Round((d.CumulativePnl - peak) / peak * 100m, 2) : 0m;
            return new DrawdownPoint(d.Date, dd);
        }).ToList();

        var maxDrawdownPct = drawdown.Count > 0 ? drawdown.Min(d => d.DrawdownPct) : 0m;

        // --- By Coin ---
        var byCoin = positions
            .GroupBy(p => p.Coin.Symbol)
            .Select(g =>
            {
                var w = g.Count(p => p.RealizedPnl!.Value > 0);
                return new CoinPerformance(
                    g.Key,
                    g.Count(),
                    w,
                    g.Count() > 0 ? Math.Round((decimal)w / g.Count() * 100m, 2) : 0,
                    Math.Round(g.Sum(p => p.RealizedPnl!.Value), 4),
                    Math.Round(g.Average(p => p.RealizedPnlPct ?? 0), 2)
                );
            })
            .OrderByDescending(c => c.TotalPnlUsdt)
            .ToList();

        // --- Exit Reasons ---
        var total = positions.Count;
        var exitReasons = positions
            .GroupBy(p => NormalizeReason(p.CloseReason))
            .Select(g => new ExitReasonStat(
                g.Key,
                g.Count(),
                Math.Round(g.Sum(p => p.RealizedPnl!.Value), 4),
                Math.Round((decimal)g.Count() / total * 100m, 2)
            ))
            .OrderByDescending(r => r.Count)
            .ToList();

        // --- Best / Worst Trades ---
        var topN = 5;
        var bestTrades = positions
            .OrderByDescending(p => p.RealizedPnlPct ?? 0)
            .Take(topN)
            .Select(MapToTrade)
            .ToList();

        var worstTrades = positions
            .OrderBy(p => p.RealizedPnlPct ?? 0)
            .Take(topN)
            .Select(MapToTrade)
            .ToList();

        var summary = new AnalyticsSummary(
            positions.Count,
            wins.Count,
            losses.Count,
            winRate,
            Math.Round(totalPnl, 4),
            avgWinPct,
            avgLossPct,
            profitFactor,
            maxDrawdownPct,
            Math.Round((decimal)avgHold, 2)
        );

        return Result<AnalyticsDto>.Success(new AnalyticsDto(
            summary, byCoin, exitReasons, dailyPnls, bestTrades, worstTrades, drawdown));
    }

    private static TopTrade MapToTrade(CriptoMoney.Domain.Entities.Position p) => new(
        p.Coin.Symbol,
        p.EntryPrice,
        p.ClosePrice ?? 0,
        Math.Round(p.RealizedPnlPct ?? 0, 2),
        Math.Round(p.RealizedPnl ?? 0, 4),
        p.CloseReason,
        p.OpenedAt,
        p.ClosedAt
    );

    private static string NormalizeReason(string? reason) =>
        (reason?.ToLower()) switch
        {
            "takeprofit"   => "Take Profit",
            "trailingstop" => "Trailing Stop",
            "stoploss"     => "Stop Loss",
            "maxholdtime"  => "Max Süre",
            "manuel"       => "Manuel",
            "momentum"     => "Momentum",
            "strateji"     => "Strateji",
            _ => reason ?? "Diğer"
        };

    private static AnalyticsDto EmptyResult() => new(
        new AnalyticsSummary(0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
        [], [], [], [], [], []
    );
}
