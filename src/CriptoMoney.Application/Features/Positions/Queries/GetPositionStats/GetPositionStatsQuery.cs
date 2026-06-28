using CriptoMoney.Application.Common.Models;
using MediatR;

namespace CriptoMoney.Application.Features.Positions.Queries.GetPositionStats;

public record GetPositionStatsQuery(Guid UserId) : IRequest<Result<PositionStatsDto>>;

public record PositionStatsDto(
    int Total,
    int Open,
    int Closed,
    int Wins,
    int Losses,
    decimal TotalPnlUsdt,
    decimal TotalPnlPct
);
