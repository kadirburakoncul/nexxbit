using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using CriptoMoney.Domain.Entities;
using CriptoMoney.Domain.Enums;
using MediatR;

namespace CriptoMoney.Application.Features.Trades.Commands.PlaceManualOrder;

public class PlaceManualOrderCommandHandler(
    IApplicationDbContext db,
    IBinanceService binance) : IRequestHandler<PlaceManualOrderCommand, Result<Guid>>
{
    public async Task<Result<Guid>> Handle(
        PlaceManualOrderCommand request, CancellationToken cancellationToken)
    {
        var orderRecord = new TradeOrder
        {
            UserId = request.UserId,
            CoinId = request.CoinId,
            Side = request.Side,
            Type = OrderType.Market,
            Status = OrderStatus.Pending,
            Quantity = request.QuoteQty,
            IsAutomatic = false,
        };

        db.TradeOrders.Add(orderRecord);
        await db.SaveChangesAsync(cancellationToken);

        var result = await binance.PlaceMarketOrderAsync(
            request.UserId, request.Symbol, request.Side, request.QuoteQty, cancellationToken);

        if (result.Succeeded && result.Data is not null)
        {
            orderRecord.BinanceOrderId = result.Data.BinanceOrderId;
            orderRecord.ClientOrderId = result.Data.ClientOrderId;
            orderRecord.FilledQuantity = result.Data.ExecutedQty;
            orderRecord.FilledPrice = result.Data.ExecutedQty > 0
                ? result.Data.CummulativeQuoteQty / result.Data.ExecutedQty
                : null;
            orderRecord.Status = OrderStatus.Filled;
            orderRecord.BinanceCreatedAt = DateTime.UtcNow;
        }
        else
        {
            orderRecord.Status = OrderStatus.Rejected;
            orderRecord.ErrorMessage = result.Errors.FirstOrDefault();
        }

        await db.SaveChangesAsync(cancellationToken);

        return result.Succeeded
            ? Result<Guid>.Success(orderRecord.Id)
            : Result<Guid>.Failure(orderRecord.ErrorMessage!);
    }
}
