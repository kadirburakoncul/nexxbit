using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using MediatR;

namespace CriptoMoney.Application.Features.Coins.Commands.DeleteCoin;

public record DeleteCoinCommand(int CoinId) : IRequest<Result>;

public class DeleteCoinCommandHandler(IUnitOfWork uow)
    : IRequestHandler<DeleteCoinCommand, Result>
{
    public async Task<Result> Handle(DeleteCoinCommand request, CancellationToken cancellationToken)
    {
        var coin = await uow.Coins.GetByIdAsync<int>(request.CoinId, cancellationToken);
        if (coin is null)
            return Result.Failure("Coin bulunamadı.");

        uow.Coins.Remove(coin);
        await uow.CommitAsync(cancellationToken);
        return Result.Success();
    }
}
