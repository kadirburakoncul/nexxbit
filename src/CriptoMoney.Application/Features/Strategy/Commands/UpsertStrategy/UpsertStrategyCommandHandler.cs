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
        // Volatil modda coin listesi boş olabilir — strateji momentum tarayıcısını kullanır
        if (!request.IsVolatileMode && request.CoinIds.Count == 0)
            return Result<Guid>.Failure("En az 1 coin seçin.");

        // Aynı isimde başka strateji var mı?
        var duplicateName = await db.UserStrategies.AnyAsync(s =>
            s.UserId == request.UserId &&
            s.Name == request.Name &&
            s.Id != (request.StrategyId ?? Guid.Empty), ct);

        if (duplicateName)
            return Result<Guid>.Failure("Bu isimde bir strateji zaten mevcut.");

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
            existing.IsVolatileMode = request.IsVolatileMode;
            existing.TakeProfitPct = request.TakeProfitPct;
            existing.MinVolumeUsdt = request.MinVolumeUsdt;
            existing.VolatilePositionSizePct = request.VolatilePositionSizePct;
            existing.VolatileMinChangePct = request.VolatileMinChangePct;
            existing.VolatileGainerLimit = request.VolatileGainerLimit;
            existing.IsRsiFilterEnabled = request.IsRsiFilterEnabled;
            existing.MomentumFreshFilterMinutes = request.MomentumFreshFilterMinutes;
            existing.UseAtrBasedStops = request.UseAtrBasedStops;
            existing.AtrPeriod = request.AtrPeriod;
            existing.AtrSlMultiplier = request.AtrSlMultiplier;
            existing.AtrTpMultiplier = request.AtrTpMultiplier;
            existing.PartialTpPct = request.PartialTpPct;
            existing.PartialTpClosePct = request.PartialTpClosePct;
            existing.IsVolumeSurgeFilterEnabled = request.IsVolumeSurgeFilterEnabled;
            existing.VolumeSurgeMultiplier = request.VolumeSurgeMultiplier;
            existing.UseMarketRegimeFilter = request.UseMarketRegimeFilter;

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
                IsVolatileMode = request.IsVolatileMode,
                TakeProfitPct = request.TakeProfitPct,
                MinVolumeUsdt = request.MinVolumeUsdt,
                VolatilePositionSizePct = request.VolatilePositionSizePct,
                VolatileMinChangePct = request.VolatileMinChangePct,
                VolatileGainerLimit = request.VolatileGainerLimit,
                IsRsiFilterEnabled = request.IsRsiFilterEnabled,
                MomentumFreshFilterMinutes = request.MomentumFreshFilterMinutes,
                UseAtrBasedStops = request.UseAtrBasedStops,
                AtrPeriod = request.AtrPeriod,
                AtrSlMultiplier = request.AtrSlMultiplier,
                AtrTpMultiplier = request.AtrTpMultiplier,
                PartialTpPct = request.PartialTpPct,
                PartialTpClosePct = request.PartialTpClosePct,
                IsVolumeSurgeFilterEnabled = request.IsVolumeSurgeFilterEnabled,
                VolumeSurgeMultiplier = request.VolumeSurgeMultiplier,
                UseMarketRegimeFilter = request.UseMarketRegimeFilter,
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
