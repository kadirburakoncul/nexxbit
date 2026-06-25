using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using MediatR;

namespace CriptoMoney.Application.Features.BinanceAccount.Commands.DeleteApiKey;

public class DeleteBinanceApiKeyCommandHandler(IUnitOfWork uow)
    : IRequestHandler<DeleteBinanceApiKeyCommand, Result>
{
    public async Task<Result> Handle(DeleteBinanceApiKeyCommand request, CancellationToken cancellationToken)
    {
        var account = await uow.UserBinanceAccounts.FirstOrDefaultAsync(
            a => a.UserId == request.UserId, cancellationToken);

        if (account is null)
            return Result.Success();

        uow.UserBinanceAccounts.Remove(account);
        await uow.CommitAsync(cancellationToken);
        return Result.Success();
    }
}
