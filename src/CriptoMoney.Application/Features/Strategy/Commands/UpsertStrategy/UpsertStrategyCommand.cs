using CriptoMoney.Application.Common.Models;
using MediatR;

namespace CriptoMoney.Application.Features.Strategy.Commands.UpsertStrategy;

public record UpsertStrategyCommand(
    Guid UserId,
    Guid? StrategyId,
    string Name,
    int? IndicatorId,
    List<int> CoinIds,
    string Timeframe,
    decimal TrailingStopPct,
    decimal StopLossPct
) : IRequest<Result<Guid>>;
