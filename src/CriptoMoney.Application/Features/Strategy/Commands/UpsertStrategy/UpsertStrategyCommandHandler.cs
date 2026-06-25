using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using CriptoMoney.Domain.Entities;
using CriptoMoney.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CriptoMoney.Application.Features.Strategy.Commands.UpsertStrategy;

public class UpsertStrategyCommandHandler(IApplicationDbContext db)
    : IRequestHandler<UpsertStrategyCommand, Result<Guid>>
{
    public async Task<Result<Guid>> Handle(UpsertStrategyCommand request, CancellationToken ct)
    {
        // Coin çakışma kontrolü: bir coin başka aktif stratejide kullanılamaz
        foreach (var coinId in request.CoinIds)
        {
            var conflict = await db.UserStrategyCoins
                .AnyAsync(sc => sc.Coin.Id == coinId
                    && sc.UserStrategy.UserId == request.UserId
                    && sc.UserStrategy.IsActive
                    && sc.UserStrategyId != request.StrategyId, ct);

            if (conflict)
            {
                var coin = await db.Coins.FindAsync([coinId], ct);
                return Result<Guid>.Failure($"{coin?.Symbol ?? coinId.ToString()} başka aktif bir stratejide zaten kullanılıyor.");
            }
        }

        UserStrategy strategy;

        if (request.StrategyId.HasValue)
        {
            var existing = await db.UserStrategies
                .Include(s => s.StrategyCoins)
                .FirstOrDefaultAsync(s => s.Id == request.StrategyId && s.UserId == request.UserId, ct);

            if (existing is null)
                return Result<Guid>.Failure("Strateji bulunamadı.");

            existing.Name = request.Name;
            existing.IndicatorId = request.IndicatorId;
            existing.Timeframe = request.Timeframe;
            existing.TrailingStopPct = request.TrailingStopPct;
            existing.StopLossPct = request.StopLossPct;

            // Coin listesini güncelle — yeniden gelmeyenleri kaldır, yenileri ekle
            var existingCoinIds = existing.StrategyCoins.Select(sc => sc.CoinId).ToHashSet();
            var requestCoinIds = request.CoinIds.ToHashSet();

            foreach (var sc in existing.StrategyCoins.Where(sc => !requestCoinIds.Contains(sc.CoinId)).ToList())
                db.UserStrategyCoins.Remove(sc);

            foreach (var coinId in requestCoinIds.Where(id => !existingCoinIds.Contains(id)))
                db.UserStrategyCoins.Add(new UserStrategyCoin { UserStrategyId = existing.Id, CoinId = coinId });

            strategy = existing;
        }
        else
        {
            strategy = new UserStrategy
            {
                UserId = request.UserId,
                Name = request.Name,
                IndicatorId = request.IndicatorId,
                Timeframe = request.Timeframe,
                TrailingStopPct = request.TrailingStopPct,
                StopLossPct = request.StopLossPct,
                IsActive = true,
            };
            db.UserStrategies.Add(strategy);
            await db.SaveChangesAsync(ct);

            foreach (var coinId in request.CoinIds)
                db.UserStrategyCoins.Add(new UserStrategyCoin { UserStrategyId = strategy.Id, CoinId = coinId });
        }

        await db.SaveChangesAsync(ct);
        return Result<Guid>.Success(strategy.Id);
    }
}
