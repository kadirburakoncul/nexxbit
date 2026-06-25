using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CriptoMoney.Application.Features.Strategy.Queries.GetStrategies;

public class GetStrategiesQueryHandler(IApplicationDbContext db)
    : IRequestHandler<GetStrategiesQuery, Result<List<StrategyDto>>>
{
    public async Task<Result<List<StrategyDto>>> Handle(
        GetStrategiesQuery request, CancellationToken ct)
    {
        var strategies = await db.UserStrategies
            .Include(s => s.StrategyCoins)
                .ThenInclude(sc => sc.Coin)
            .Where(s => s.UserId == request.UserId)
            .OrderBy(s => s.CreatedAt)
            .ToListAsync(ct);

        // Aktif indikatör display adlarını toplu çek
        var indicatorIds = strategies
            .Where(s => s.IndicatorId.HasValue)
            .Select(s => s.IndicatorId!.Value)
            .Distinct()
            .ToList();

        var indicatorNames = indicatorIds.Any()
            ? await db.Indicators
                .Where(i => indicatorIds.Contains(i.Id))
                .ToDictionaryAsync(i => i.Id, i => i.DisplayName, ct)
            : new Dictionary<int, string>();

        var dtos = strategies.Select(s => new StrategyDto(
            s.Id,
            s.Name,
            s.IndicatorId,
            s.IndicatorId.HasValue ? indicatorNames.GetValueOrDefault(s.IndicatorId.Value) : null,
            s.Timeframe,
            s.TrailingStopPct,
            s.StopLossPct,
            s.IsActive,
            s.IsRealTradeEnabled,
            s.ActivatedAt,
            s.StrategyCoins.Select(sc => new StrategyCoinDto(
                sc.CoinId,
                sc.Coin.Symbol,
                sc.Coin.DisplayName,
                sc.ReEntryState
            )).ToList()
        )).ToList();

        return Result<List<StrategyDto>>.Success(dtos);
    }
}
