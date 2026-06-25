using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CriptoMoney.Application.Features.Backtest.Queries.ListBacktestRuns;

public class ListBacktestRunsQueryHandler(IApplicationDbContext db)
    : IRequestHandler<ListBacktestRunsQuery, Result<List<BacktestSummaryDto>>>
{
    public async Task<Result<List<BacktestSummaryDto>>> Handle(
        ListBacktestRunsQuery request, CancellationToken cancellationToken)
    {
        var runs = await db.BacktestRuns
            .Where(r => r.UserId == request.UserId)
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new BacktestSummaryDto(
                r.Id,
                r.Name ?? string.Empty,
                r.Status.ToString(),
                r.Timeframe,
                r.StartDate,
                r.EndDate,
                r.InitialCapital,
                r.NetPnlPct,
                r.WinRate,
                r.TotalTrades,
                r.MaxDrawdown,
                r.CreatedAt,
                r.ErrorMessage))
            .ToListAsync(cancellationToken);

        return Result<List<BacktestSummaryDto>>.Success(runs);
    }
}
