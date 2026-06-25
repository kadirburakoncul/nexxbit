using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CriptoMoney.Application.Features.Coins.Queries.GetCoins;

public class GetCoinsQueryHandler(IApplicationDbContext db)
    : IRequestHandler<GetCoinsQuery, Result<List<CoinDto>>>
{
    public async Task<Result<List<CoinDto>>> Handle(
        GetCoinsQuery request, CancellationToken cancellationToken)
    {
        var watchlistIds = await db.UserWatchlists
            .Where(w => w.UserId == request.UserId)
            .Select(w => w.CoinId)
            .ToHashSetAsync(cancellationToken);

        var coins = await db.Coins
            .Where(c => c.IsActive)
            .OrderBy(c => c.Symbol)
            .Select(c => new CoinDto(
                c.Id,
                c.Symbol,
                c.BaseAsset,
                c.QuoteAsset,
                c.DisplayName,
                watchlistIds.Contains(c.Id)))
            .ToListAsync(cancellationToken);

        return Result<List<CoinDto>>.Success(coins);
    }
}
