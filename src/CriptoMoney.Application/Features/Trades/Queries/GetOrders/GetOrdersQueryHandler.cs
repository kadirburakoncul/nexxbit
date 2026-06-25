using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CriptoMoney.Application.Features.Trades.Queries.GetOrders;

public class GetOrdersQueryHandler(IApplicationDbContext db)
    : IRequestHandler<GetOrdersQuery, Result<List<OrderDto>>>
{
    public async Task<Result<List<OrderDto>>> Handle(
        GetOrdersQuery request, CancellationToken cancellationToken)
    {
        var query = db.TradeOrders
            .Include(o => o.Coin)
            .Where(o => o.UserId == request.UserId);

        if (request.CoinId.HasValue)
            query = query.Where(o => o.CoinId == request.CoinId.Value);

        if (request.Status.HasValue)
            query = query.Where(o => o.Status == request.Status.Value);

        var orders = await query
            .OrderByDescending(o => o.CreatedAt)
            .Skip((request.PageNumber - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(o => new OrderDto(
                o.Id,
                o.CoinId,
                o.Coin.Symbol,
                o.SignalId,
                o.Side.ToString(),
                o.Type.ToString(),
                o.Status.ToString(),
                o.Quantity,
                o.Price,
                o.FilledQuantity,
                o.FilledPrice,
                o.Commission,
                o.CommissionAsset,
                o.IsAutomatic,
                o.BinanceOrderId,
                o.ErrorMessage,
                o.CreatedAt))
            .ToListAsync(cancellationToken);

        return Result<List<OrderDto>>.Success(orders);
    }
}
