using CriptoMoney.Application.Common.Models;
using MediatR;

namespace CriptoMoney.Application.Features.BinanceAccount.Queries.GetAccountStatus;

public record GetAccountStatusQuery(Guid UserId) : IRequest<Result<AccountStatusResponse>>;

public record AccountStatusResponse(
    bool IsConnected,
    string? ApiKeyHint,
    bool IsTestnet,
    DateTime? LastConnectionAt,
    string? ConnectionError
);
