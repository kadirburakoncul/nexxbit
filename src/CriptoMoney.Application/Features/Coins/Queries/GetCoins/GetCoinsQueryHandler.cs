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
        var coinIds = await db.UserWatchlists
            .Where(w => w.UserId == request.UserId)
            .Select(w => w.CoinId)
            .ToListAsync(cancellationToken);

        var coins = await db.Coins
            .Where(c => c.IsActive && coinIds.Contains(c.Id))
            .OrderBy(c => c.Symbol)
            .Select(c => new CoinDto(c.Id, c.Symbol, c.BaseAsset, c.QuoteAsset, c.DisplayName, true))
            .ToListAsync(cancellationToken);

        return Result<List<CoinDto>>.Success(coins);
    }
}
