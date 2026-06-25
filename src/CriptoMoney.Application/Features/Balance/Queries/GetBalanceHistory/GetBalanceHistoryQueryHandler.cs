using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CriptoMoney.Application.Features.Balance.Queries.GetBalanceHistory;

public class GetBalanceHistoryQueryHandler(IApplicationDbContext db)
    : IRequestHandler<GetBalanceHistoryQuery, Result<List<BalanceSnapshotDto>>>
{
    public async Task<Result<List<BalanceSnapshotDto>>> Handle(
        GetBalanceHistoryQuery request, CancellationToken cancellationToken)
    {
        var since = DateTime.UtcNow.AddDays(-Math.Abs(request.Days));

        var snapshots = await db.BalanceSnapshots
            .Where(s => s.UserId == request.UserId && s.SnapshotAt >= since)
            .OrderBy(s => s.SnapshotAt)
            .Select(s => new BalanceSnapshotDto(s.TotalValueUsdt, s.Assets, s.SnapshotAt))
            .ToListAsync(cancellationToken);

        return Result<List<BalanceSnapshotDto>>.Success(snapshots);
    }
}
