using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using MediatR;

namespace CriptoMoney.Application.Features.BinanceAccount.Queries.GetBalances;

public class GetBalancesQueryHandler(IBinanceService binanceService)
    : IRequestHandler<GetBalancesQuery, Result<List<BalanceDto>>>
{
    public async Task<Result<List<BalanceDto>>> Handle(GetBalancesQuery request, CancellationToken cancellationToken)
    {
        var result = await binanceService.GetBalancesAsync(request.UserId, cancellationToken);
        if (!result.Succeeded)
            return Result<List<BalanceDto>>.Failure(result.Errors);

        // Always include USDT (trading capital), filter zeros for other assets
        var dtos = result.Data!
            .Where(b => b.Free + b.Locked > 0 || b.Asset == "USDT")
            .OrderByDescending(b => b.Asset == "USDT")
            .ThenBy(b => b.Asset)
            .Select(b => new BalanceDto(b.Asset, b.Free, b.Locked, b.Free + b.Locked))
            .ToList();

        return Result<List<BalanceDto>>.Success(dtos);
    }
}
