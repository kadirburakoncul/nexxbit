using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CriptoMoney.Application.Features.Coins.Commands.DeleteCoin;

public record DeleteCoinCommand(int CoinId, Guid UserId) : IRequest<Result>;

public class DeleteCoinCommandHandler(IApplicationDbContext db)
    : IRequestHandler<DeleteCoinCommand, Result>
{
    public async Task<Result> Handle(DeleteCoinCommand request, CancellationToken cancellationToken)
    {
        var entry = await db.UserWatchlists
            .FirstOrDefaultAsync(w => w.UserId == request.UserId && w.CoinId == request.CoinId,
                cancellationToken);

        if (entry is null)
            return Result.Failure("Coin listenizde bulunamadı.");

        db.UserWatchlists.Remove(entry);
        await db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}
