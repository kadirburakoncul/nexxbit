using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using MediatR;

namespace CriptoMoney.Application.Features.BinanceAccount.Queries.GetAccountStatus;

public class GetAccountStatusQueryHandler(IUnitOfWork uow)
    : IRequestHandler<GetAccountStatusQuery, Result<AccountStatusResponse>>
{
    public async Task<Result<AccountStatusResponse>> Handle(GetAccountStatusQuery request, CancellationToken cancellationToken)
    {
        var account = await uow.UserBinanceAccounts.FirstOrDefaultAsync(
            a => a.UserId == request.UserId, cancellationToken);

        if (account is null)
            return Result<AccountStatusResponse>.Success(new AccountStatusResponse(false, null, false, null, null));

        return Result<AccountStatusResponse>.Success(new AccountStatusResponse(
            IsConnected: account.ConnectionErrorMessage is null,
            ApiKeyHint: account.ApiKeyHint,
            IsTestnet: account.IsTestnet,
            LastConnectionAt: account.LastConnectionAt,
            ConnectionError: account.ConnectionErrorMessage
        ));
    }
}
