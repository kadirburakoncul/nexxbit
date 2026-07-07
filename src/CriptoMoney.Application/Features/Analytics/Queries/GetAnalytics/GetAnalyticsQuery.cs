using CriptoMoney.Application.Common.Models;
using MediatR;

namespace CriptoMoney.Application.Features.Analytics.Queries.GetAnalytics;

public record GetAnalyticsQuery(Guid UserId, bool VirtualOnly = false) : IRequest<Result<AnalyticsDto>>;

public record AnalyticsDto(
    AnalyticsSummary Summary,
    List<CoinPerformance> ByCoin,
    List<ExitReasonStat> ExitReasons,
    List<DailyPnl> DailyPnl,
    List<TopTrade> BestTrades,
    List<TopTrade> WorstTrades,
    List<DrawdownPoint> Drawdown
);

public record AnalyticsSummary(
    int TotalTrades,
    int WinCount,
    int LossCount,
    decimal WinRate,
    decimal TotalPnlUsdt,
    decimal AvgWinPct,
    decimal AvgLossPct,
    decimal ProfitFactor,
    decimal MaxDrawdownPct,
    decimal AvgHoldHours
);

public record CoinPerformance(
    string Symbol,
    int Trades,
    int Wins,
    decimal WinRate,
    decimal TotalPnlUsdt,
    decimal AvgPnlPct
);

public record ExitReasonStat(
    string Reason,
    int Count,
    decimal TotalPnlUsdt,
    decimal Pct
);

public record DailyPnl(
    string Date,
    decimal PnlUsdt,
    int Trades,
    decimal CumulativePnl
);

public record TopTrade(
    string Symbol,
    decimal EntryPrice,
    decimal ExitPrice,
    decimal PnlPct,
    decimal PnlUsdt,
    string? CloseReason,
    DateTime OpenedAt,
    DateTime? ClosedAt
);

public record DrawdownPoint(
    string Date,
    decimal DrawdownPct
);
