using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using CriptoMoney.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CriptoMoney.Application.Features.Coins.Commands.SyncCoins;

public record SyncCoinsCommand : IRequest<Result<SyncCoinsResultDto>>;

public record SyncCoinsResultDto(int Added, int Total);

public class SyncCoinsCommandHandler(IBinanceService binance, IApplicationDbContext db)
    : IRequestHandler<SyncCoinsCommand, Result<SyncCoinsResultDto>>
{
    public async Task<Result<SyncCoinsResultDto>> Handle(
        SyncCoinsCommand request, CancellationToken cancellationToken)
    {
        var binanceResult = await binance.GetUsdtTradingPairsAsync(cancellationToken);
        if (!binanceResult.Succeeded)
            return Result<SyncCoinsResultDto>.Failure(binanceResult.Errors);

        var existingSymbols = await db.Coins
            .Select(c => c.Symbol)
            .ToHashSetAsync(cancellationToken);

        var newCoins = binanceResult.Data!
            .Where(b => b.IsTrading && !existingSymbols.Contains(b.Symbol))
            .Select(b => new Coin
            {
                Symbol      = b.Symbol,
                BaseAsset   = b.BaseAsset,
                QuoteAsset  = b.QuoteAsset,
                DisplayName = $"{b.BaseAsset}/USDT",
                IsActive    = true,
            })
            .ToList();

        if (newCoins.Count > 0)
        {
            db.Coins.AddRange(newCoins);
            await db.SaveChangesAsync(cancellationToken);
        }

        return Result<SyncCoinsResultDto>.Success(
            new SyncCoinsResultDto(newCoins.Count, existingSymbols.Count + newCoins.Count));
    }
}
