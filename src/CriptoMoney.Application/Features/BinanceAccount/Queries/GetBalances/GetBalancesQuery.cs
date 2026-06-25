using CriptoMoney.Application.Common.Models;
using MediatR;

namespace CriptoMoney.Application.Features.BinanceAccount.Queries.GetBalances;

public record GetBalancesQuery(Guid UserId) : IRequest<Result<List<BalanceDto>>>;

public record BalanceDto(string Asset, decimal Free, decimal Locked, decimal Total);
