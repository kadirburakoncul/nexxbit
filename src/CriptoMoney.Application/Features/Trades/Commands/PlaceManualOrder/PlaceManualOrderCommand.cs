using CriptoMoney.Application.Common.Models;
using CriptoMoney.Domain.Enums;
using MediatR;

namespace CriptoMoney.Application.Features.Trades.Commands.PlaceManualOrder;

public record PlaceManualOrderCommand(
    Guid UserId,
    int CoinId,
    string Symbol,
    OrderSide Side,
    decimal QuoteQty   // USDT miktarı
) : IRequest<Result<Guid>>;
