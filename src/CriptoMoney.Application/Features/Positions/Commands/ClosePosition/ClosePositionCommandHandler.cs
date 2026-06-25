using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using CriptoMoney.Domain.Entities;
using CriptoMoney.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CriptoMoney.Application.Features.Positions.Commands.ClosePosition;

public class ClosePositionCommandHandler(
    IApplicationDbContext db,
    IBinanceService binance) : IRequestHandler<ClosePositionCommand, Result>
{
    public async Task<Result> Handle(ClosePositionCommand request, CancellationToken cancellationToken)
    {
        var position = await db.Positions
            .Include(p => p.Coin)
            .FirstOrDefaultAsync(p => p.Id == request.PositionId && p.UserId == request.UserId,
                cancellationToken);

        if (position is null)
            return Result.Failure("Pozisyon bulunamadı.");

        if (position.Status != PositionStatus.Open)
            return Result.Failure("Bu pozisyon zaten kapalı.");

        // Binance'e market Sell emri gönder
        var orderResult = await binance.PlaceMarketOrderAsync(
            request.UserId,
            position.Coin.Symbol,
            OrderSide.Sell,
            position.EntryQuantity * position.EntryPrice, // yaklaşık USDT değeri
            cancellationToken);

        var closeOrder = new TradeOrder
        {
            UserId = request.UserId,
            CoinId = position.CoinId,
            Side = OrderSide.Sell,
            Type = OrderType.Market,
            Status = orderResult.Succeeded ? OrderStatus.Filled : OrderStatus.Rejected,
            Quantity = position.EntryQuantity,
            Price = orderResult.Data?.CummulativeQuoteQty / (orderResult.Data?.ExecutedQty > 0 ? orderResult.Data.ExecutedQty : 1),
            FilledQuantity = orderResult.Data?.ExecutedQty,
            FilledPrice = orderResult.Data?.ExecutedQty > 0
                ? orderResult.Data.CummulativeQuoteQty / orderResult.Data.ExecutedQty
                : null,
            BinanceOrderId = orderResult.Data?.BinanceOrderId,
            ClientOrderId = orderResult.Data?.ClientOrderId,
            IsAutomatic = false,
            ErrorMessage = orderResult.Succeeded ? null : orderResult.Errors.FirstOrDefault(),
            BinanceCreatedAt = DateTime.UtcNow,
        };

        db.TradeOrders.Add(closeOrder);
        await db.SaveChangesAsync(cancellationToken);

        if (!orderResult.Succeeded)
            return Result.Failure($"Emir gönderilemedi: {closeOrder.ErrorMessage}");

        // Pozisyonu kapat
        var closePrice = closeOrder.FilledPrice ?? position.EntryPrice;
        var closeValue = closePrice * position.EntryQuantity;
        var pnl = closeValue - position.EntryValueUsdt;
        var pnlPct = pnl / position.EntryValueUsdt * 100;

        position.Status = PositionStatus.Closed;
        position.CloseOrderId = closeOrder.Id;
        position.ClosePrice = closePrice;
        position.CloseValueUsdt = closeValue;
        position.RealizedPnl = Math.Round(pnl, 2);
        position.RealizedPnlPct = Math.Round(pnlPct, 4);
        position.ClosedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}
