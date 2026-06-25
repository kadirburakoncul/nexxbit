using CriptoMoney.Application.Common.Models;
using MediatR;

namespace CriptoMoney.Application.Features.Backtest.Queries.ListBacktestRuns;

public record ListBacktestRunsQuery(Guid UserId) : IRequest<Result<List<BacktestSummaryDto>>>;

public record BacktestSummaryDto(
    Guid Id,
    string Name,
    string Status,
    string Timeframe,
    DateTime StartDate,
    DateTime EndDate,
    decimal InitialCapital,
    decimal? NetPnlPct,
    decimal? WinRate,
    int? TotalTrades,
    decimal? MaxDrawdown,
    DateTime CreatedAt,
    string? ErrorMessage
);
