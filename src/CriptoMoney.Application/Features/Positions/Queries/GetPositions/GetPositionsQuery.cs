using CriptoMoney.Application.Common.Models;
using CriptoMoney.Domain.Enums;
using MediatR;

namespace CriptoMoney.Application.Features.Positions.Queries.GetPositions;

public record GetPositionsQuery(
    Guid UserId,
    PositionStatus? Status = null,
    bool? IsVirtual = null,
    int PageNumber = 1,
    int PageSize = 200
) : IRequest<Result<List<PositionDto>>>;

public record PositionDto(
    Guid Id,
    int CoinId,
    string CoinSymbol,
    decimal EntryPrice,
    decimal EntryQuantity,
    decimal EntryValueUsdt,
    decimal? StopLossPrice,
    decimal? TakeProfitPrice,
    string Status,
    decimal? ClosePrice,
    decimal? CloseValueUsdt,
    decimal? RealizedPnl,
    decimal? RealizedPnlPct,
    decimal? UnrealizedPnlPct,
    bool IsVirtual,
    DateTime OpenedAt,
    DateTime? ClosedAt,
    string? CloseReason,
    Guid? StrategyId,
    string? StrategyName,
    bool? StrategyIsActive
);
