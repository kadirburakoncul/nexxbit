using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using CriptoMoney.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CriptoMoney.Application.Features.Coins.Commands.ToggleWatchlist;

public class ToggleWatchlistCommandHandler(IApplicationDbContext db)
    : IRequestHandler<ToggleWatchlistCommand, Result<bool>>
{
    public async Task<Result<bool>> Handle(
        ToggleWatchlistCommand request, CancellationToken cancellationToken)
    {
        var exists = await db.UserWatchlists
            .FirstOrDefaultAsync(w => w.UserId == request.UserId && w.CoinId == request.CoinId,
                cancellationToken);

        if (exists is not null)
        {
            db.UserWatchlists.Remove(exists);
            await db.SaveChangesAsync(cancellationToken);
            return Result<bool>.Success(false); // kaldırıldı
        }

        var coin = await db.Coins.FindAsync([request.CoinId], cancellationToken);
        if (coin is null)
            return Result<bool>.Failure("Coin bulunamadı.");

        db.UserWatchlists.Add(new UserWatchlist
        {
            UserId = request.UserId,
            CoinId = request.CoinId,
        });
        await db.SaveChangesAsync(cancellationToken);
        return Result<bool>.Success(true); // eklendi
    }
}
