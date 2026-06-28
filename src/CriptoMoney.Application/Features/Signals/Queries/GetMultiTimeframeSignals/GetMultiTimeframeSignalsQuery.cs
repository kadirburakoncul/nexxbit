using CriptoMoney.Application.Common.Models;
using MediatR;

namespace CriptoMoney.Application.Features.Signals.Queries.GetMultiTimeframeSignals;

public record GetMultiTimeframeSignalsQuery(Guid UserId, int Hours = 24)
    : IRequest<Result<List<MultiTimeframeSignalDto>>>;

public record TimeframeSignalDto(
    string Timeframe,
    string Direction,
    decimal Score,
    decimal Price,
    DateTime CandleTime
);

public record MultiTimeframeSignalDto(
    int CoinId,
    string CoinSymbol,
    List<TimeframeSignalDto> Timeframes,
    string Confluence  // "STRONG_BUY" | "BUY" | "NEUTRAL" | "SELL" | "STRONG_SELL"
);
