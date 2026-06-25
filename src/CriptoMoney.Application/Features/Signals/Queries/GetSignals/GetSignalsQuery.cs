using CriptoMoney.Application.Common.Models;
using CriptoMoney.Domain.Enums;
using MediatR;

namespace CriptoMoney.Application.Features.Signals.Queries.GetSignals;

public record GetSignalsQuery(
    Guid UserId,
    int? CoinId = null,
    SignalDirection? Direction = null,
    int PageNumber = 1,
    int PageSize = 20
) : IRequest<Result<List<SignalDto>>>;

public record SignalDto(
    Guid Id,
    int CoinId,
    string CoinSymbol,
    string Timeframe,
    string Direction,
    decimal TotalScore,
    decimal Price,
    DateTime CandleTime,
    bool IsActedUpon,
    string IndicatorScores,
    DateTime CreatedAt
);
