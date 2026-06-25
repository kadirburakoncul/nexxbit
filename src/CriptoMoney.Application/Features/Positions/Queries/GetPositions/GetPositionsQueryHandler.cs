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

        var dtos = positions.Select(p => new PositionDto(
            p.Id,
            p.CoinId,
            p.Coin.Symbol,
            p.EntryPrice,
            p.EntryQuantity,
            p.EntryValueUsdt,
            p.StopLossPrice,
            p.TakeProfitPrice,
            p.Status.ToString(),
            p.ClosePrice,
            p.CloseValueUsdt,
            p.RealizedPnl,
            p.RealizedPnlPct,
            null,
            p.IsVirtual,
            p.OpenedAt,
            p.ClosedAt,
            p.CloseReason
        )).ToList();

        return Result<List<PositionDto>>.Success(dtos);
    }
}
