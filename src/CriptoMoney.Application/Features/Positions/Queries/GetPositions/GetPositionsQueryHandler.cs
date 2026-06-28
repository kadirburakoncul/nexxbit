using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CriptoMoney.Application.Features.Positions.Queries.GetPositions;

public class GetPositionsQueryHandler(IApplicationDbContext db)
    : IRequestHandler<GetPositionsQuery, Result<List<PositionDto>>>
{
    public async Task<Result<List<PositionDto>>> Handle(
        GetPositionsQuery request, CancellationToken cancellationToken)
    {
        var query = db.Positions
            .Include(p => p.Coin)
            .Where(p => p.UserId == request.UserId);

        if (request.Status.HasValue)
            query = query.Where(p => p.Status == request.Status.Value);

        if (request.IsVirtual.HasValue)
            query = query.Where(p => p.IsVirtual == request.IsVirtual.Value);

        var positions = await query
            .OrderByDescending(p => p.OpenedAt)
            .Skip((request.PageNumber - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToListAsync(cancellationToken);

        var strategyIds = positions
            .Where(p => p.StrategyId.HasValue)
            .Select(p => p.StrategyId!.Value)
            .Distinct()
            .ToList();

        var strategyInfoList = strategyIds.Count > 0
            ? await db.UserStrategies
                .Where(s => strategyIds.Contains(s.Id))
                .Select(s => new StrategyRef(s.Id, s.Name, s.IsActive))
                .ToListAsync(cancellationToken)
            : new List<StrategyRef>();

        var strategyInfo = strategyInfoList.ToDictionary(s => s.Id);

        var dtos = positions.Select(p =>
        {
            string? stratName = null;
            bool? stratActive = null;
            if (p.StrategyId.HasValue && strategyInfo.TryGetValue(p.StrategyId.Value, out var si))
            {
                stratName = si.Name;
                stratActive = si.IsActive;
            }
            return new PositionDto(
                p.Id, p.CoinId, p.Coin.Symbol,
                p.EntryPrice, p.EntryQuantity, p.EntryValueUsdt,
                p.StopLossPrice, p.TakeProfitPrice,
                p.Status.ToString(),
                p.ClosePrice, p.CloseValueUsdt,
                p.RealizedPnl, p.RealizedPnlPct, null,
                p.IsVirtual, p.OpenedAt, p.ClosedAt, p.CloseReason,
                p.StrategyId, stratName, stratActive
            );
        }).ToList();

        return Result<List<PositionDto>>.Success(dtos);
    }

    private record StrategyRef(Guid Id, string Name, bool IsActive);
}
