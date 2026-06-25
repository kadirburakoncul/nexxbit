using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using MediatR;

namespace CriptoMoney.Application.Features.Coins.Queries.GetCandles;

public record GetCandlesQuery(string Symbol, string Interval, int Limit)
    : IRequest<Result<List<CandleDto>>>;

public record CandleDto(
    DateTime OpenTime, decimal Open, decimal High, decimal Low,
    decimal Close, decimal Volume, bool IsClosed);

public class GetCandlesQueryHandler(IBinanceService binance)
    : IRequestHandler<GetCandlesQuery, Result<List<CandleDto>>>
{
    public async Task<Result<List<CandleDto>>> Handle(
        GetCandlesQuery request, CancellationToken cancellationToken)
    {
        var result = await binance.GetCandlesAsync(
            request.Symbol, request.Interval, request.Limit, cancellationToken);

        if (!result.Succeeded)
            return Result<List<CandleDto>>.Failure(result.Errors);

        var dtos = result.Data!
            .Select(c => new CandleDto(c.OpenTime, c.Open, c.High, c.Low, c.Close, c.Volume, c.IsClosed))
            .ToList();

        return Result<List<CandleDto>>.Success(dtos);
    }
}
