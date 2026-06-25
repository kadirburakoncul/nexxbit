using CriptoMoney.Application.Common.Models;
using CriptoMoney.Domain.Enums;
using MediatR;

namespace CriptoMoney.Application.Features.Backtest.Queries.GetBacktestResult;

public record GetBacktestResultQuery(Guid RunId, Guid UserId) : IRequest<Result<BacktestResultDto>>;

public record BacktestResultDto(
    Guid Id,
    string Name,
    string Status,
    string Timeframe,
    DateTime StartDate,
    DateTime EndDate,
    decimal InitialCapital,
    decimal? FinalCapital,
    decimal? NetPnl,
    decimal? NetPnlPct,
    decimal? WinRate,
    int? TotalTrades,
    int? WinningTrades,
    decimal? MaxDrawdown,
    decimal? SharpeRatio,
    string? ErrorMessage,
    DateTime? CompletedAt,
    List<BacktestTradeDto> Trades
);

public record BacktestTradeDto(
    long Id,
    int CoinId,
    string CoinSymbol,
    string Side,
    DateTime EntryTime,
    decimal EntryPrice,
    DateTime? ExitTime,
    decimal? ExitPrice,
    string? ExitReason,
    decimal Quantity,
    decimal Commission,
    decimal? PnlUsdt,
    decimal? PnlPct,
    decimal? EntryScore
);
