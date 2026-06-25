using CriptoMoney.Application.Common.Models;
using CriptoMoney.Domain.Enums;
using MediatR;

namespace CriptoMoney.Application.Features.Trades.Queries.GetOrders;

public record GetOrdersQuery(
    Guid UserId,
    int? CoinId = null,
    OrderStatus? Status = null,
    int PageNumber = 1,
    int PageSize = 20
) : IRequest<Result<List<OrderDto>>>;

public record OrderDto(
    Guid Id,
    int CoinId,
    string CoinSymbol,
    Guid? SignalId,
    string Side,
    string Type,
    string Status,
    decimal Quantity,
    decimal? Price,
    decimal? FilledQuantity,
    decimal? FilledPrice,
    decimal? Commission,
    string? CommissionAsset,
    bool IsAutomatic,
    long? BinanceOrderId,
    string? ErrorMessage,
    DateTime CreatedAt
);
