using CriptoMoney.Application.Common.Models;
using CriptoMoney.Domain.Enums;
using MediatR;

namespace CriptoMoney.Application.Features.Strategy.Queries.GetStrategies;

public record GetStrategiesQuery(Guid UserId) : IRequest<Result<List<StrategyDto>>>;

public record StrategyDto(
    Guid Id,
    string Name,
    int? IndicatorId,
    string? IndicatorDisplayName,
    string Timeframe,
    decimal TrailingStopPct,
    decimal StopLossPct,
    bool IsActive,
    bool IsRealTradeEnabled,
    DateTime? ActivatedAt,
    List<StrategyCoinDto> Coins
);

public record StrategyCoinDto(
    int CoinId,
    string Symbol,
    string DisplayName,
    ReEntryState ReEntryState
);
