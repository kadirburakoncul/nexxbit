using CriptoMoney.Application.Common.Models;
using MediatR;

namespace CriptoMoney.Application.Features.Strategy.Queries.GetStrategyMonitor;

public record GetStrategyMonitorQuery(Guid UserId) : IRequest<Result<List<StrategyMonitorDto>>>;

public record StrategyMonitorDto(
    Guid StrategyId,
    string Name,
    string Timeframe,
    List<CoinMonitorDto> Coins
);

public record CoinMonitorDto(
    int CoinId,
    string CoinSymbol,
    int ReEntryState,
    bool HasOpenPosition,
    DateTime? LastSignalAt,
    string? LastSignalDirection,
    decimal? LastSignalPrice,
    DateTime? LastCheckedAt,
    decimal? LastCheckedPrice,
    string? LastCheckedReason,
    decimal? LastBuyPrice,
    DateTime? LastBuyAt,
    decimal? LastSellPrice,
    DateTime? LastSellAt
);
