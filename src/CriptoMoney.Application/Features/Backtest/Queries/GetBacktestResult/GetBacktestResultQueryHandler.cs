using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CriptoMoney.Application.Features.Backtest.Queries.GetBacktestResult;

public class GetBacktestResultQueryHandler(IApplicationDbContext db)
    : IRequestHandler<GetBacktestResultQuery, Result<BacktestResultDto>>
{
    public async Task<Result<BacktestResultDto>> Handle(
        GetBacktestResultQuery request, CancellationToken cancellationToken)
    {
        var run = await db.BacktestRuns
            .Include(r => r.Trades)
            .FirstOrDefaultAsync(r => r.Id == request.RunId && r.UserId == request.UserId, cancellationToken);

        if (run is null)
            return Result<BacktestResultDto>.Failure("Backtest bulunamadı.");

        // Coin sembolleri için ayrı sorgu (navigation yüklemek yerine)
        var coinIds = run.Trades.Select(t => t.CoinId).Distinct().ToList();
        var coinSymbols = await db.Coins
            .Where(c => coinIds.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, c => c.Symbol, cancellationToken);

        var trades = run.Trades.Select(t => new BacktestTradeDto(
            t.Id,
            t.CoinId,
            coinSymbols.GetValueOrDefault(t.CoinId, "?"),
            t.Side.ToString(),
            t.EntryTime,
            t.EntryPrice,
            t.ExitTime,
            t.ExitPrice,
            t.ExitReason?.ToString(),
            t.Quantity,
            t.Commission,
            t.PnlUsdt,
            t.PnlPct,
            t.EntryScore
        )).OrderBy(t => t.EntryTime).ToList();

        var dto = new BacktestResultDto(
            run.Id,
            run.Name ?? string.Empty,
            run.Status.ToString(),
            run.Timeframe,
            run.StartDate,
            run.EndDate,
            run.InitialCapital,
            run.FinalCapital,
            run.NetPnl,
            run.NetPnlPct,
            run.WinRate,
            run.TotalTrades,
            run.WinningTrades,
            run.MaxDrawdown,
            run.SharpeRatio,
            run.ErrorMessage,
            run.CompletedAt,
            trades
        );

        return Result<BacktestResultDto>.Success(dto);
    }
}
