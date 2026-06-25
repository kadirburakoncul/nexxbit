using CriptoMoney.Application.Common.Models;
using MediatR;

namespace CriptoMoney.Application.Features.Coins.Queries.GetCoins;

public record GetCoinsQuery(Guid UserId) : IRequest<Result<List<CoinDto>>>;

public record CoinDto(
    int Id,
    string Symbol,
    string BaseAsset,
    string QuoteAsset,
    string DisplayName,
    bool IsInWatchlist
);
