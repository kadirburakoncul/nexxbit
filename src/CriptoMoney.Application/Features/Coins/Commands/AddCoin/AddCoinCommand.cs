using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using CriptoMoney.Application.Features.Coins.Queries.GetCoins;
using CriptoMoney.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CriptoMoney.Application.Features.Coins.Commands.AddCoin;

public record AddCoinCommand(string Symbol, string BaseAsset, string QuoteAsset)
    : IRequest<Result<CoinDto>>;

public class AddCoinCommandHandler(IApplicationDbContext db)
    : IRequestHandler<AddCoinCommand, Result<CoinDto>>
{
    public async Task<Result<CoinDto>> Handle(
        AddCoinCommand request, CancellationToken cancellationToken)
    {
        var symbol = request.Symbol.ToUpper().Trim();

        var existing = await db.Coins
            .FirstOrDefaultAsync(c => c.Symbol == symbol, cancellationToken);

        if (existing is not null)
            return Result<CoinDto>.Success(new CoinDto(
                existing.Id, existing.Symbol, existing.BaseAsset,
                existing.QuoteAsset, existing.DisplayName, false));

        var coin = new Coin
        {
            Symbol      = symbol,
            BaseAsset   = request.BaseAsset.ToUpper(),
            QuoteAsset  = request.QuoteAsset.ToUpper(),
            DisplayName = $"{request.BaseAsset.ToUpper()}/USDT",
            IsActive    = true,
        };

        db.Coins.Add(coin);
        await db.SaveChangesAsync(cancellationToken);

        return Result<CoinDto>.Success(new CoinDto(
            coin.Id, coin.Symbol, coin.BaseAsset, coin.QuoteAsset, coin.DisplayName, false));
    }
}
