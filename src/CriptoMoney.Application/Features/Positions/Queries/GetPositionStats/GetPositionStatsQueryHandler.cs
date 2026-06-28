using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using CriptoMoney.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CriptoMoney.Application.Features.Positions.Queries.GetPositionStats;

public class GetPositionStatsQueryHandler(IApplicationDbContext db)
    : IRequestHandler<GetPositionStatsQuery, Result<PositionStatsDto>>
{
    public async Task<Result<PositionStatsDto>> Handle(
        GetPositionStatsQuery request, CancellationToken ct)
    {
        var positions = await db.Positions
            .Where(p => p.UserId == request.UserId)
            .Select(p => new { p.Status, p.RealizedPnl, p.RealizedPnlPct })
            .ToListAsync(ct);

        var total = positions.Count;
        var open = positions.Count(p => p.Status == PositionStatus.Open);
        var closed = positions.Count(p => p.Status == PositionStatus.Closed);
        // RealizedPnl = real positions (USDT), RealizedPnlPct = virtual positions (%)
        var wins = positions.Count(p =>
            p.Status == PositionStatus.Closed &&
            (p.RealizedPnl > 0 || (p.RealizedPnl == null && p.RealizedPnlPct > 0)));
        var losses = positions.Count(p =>
            p.Status == PositionStatus.Closed &&
            (p.RealizedPnl < 0 || (p.RealizedPnl == null && p.RealizedPnlPct < 0)));
        var totalPnl = positions
            .Where(p => p.Status == PositionStatus.Closed && p.RealizedPnl.HasValue)
            .Sum(p => p.RealizedPnl!.Value);

        // Sanal pozisyonlar sadece RealizedPnlPct içerir; her işlemi eşit ağırlıkta sayarak topla
        var totalPnlPct = positions
            .Where(p => p.Status == PositionStatus.Closed && p.RealizedPnlPct.HasValue)
            .Sum(p => p.RealizedPnlPct!.Value);

        return Result<PositionStatsDto>.Success(new PositionStatsDto(
            total, open, closed, wins, losses, Math.Round(totalPnl, 2), Math.Round(totalPnlPct, 2)));
    }
}
