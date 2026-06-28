using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace CriptoMoney.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class VolatileController(
    IApplicationDbContext db,
    IBinanceService binanceService) : ControllerBase
{
    private Guid CurrentUserId => Guid.Parse(
        User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);

    [HttpGet("dashboard")]
    public async Task<IActionResult> GetDashboard(
        [FromQuery] decimal minChange = 3,
        [FromQuery] int limit = 25,
        CancellationToken ct = default)
    {
        var userId = CurrentUserId;

        var momentumCoins = await binanceService.GetTopGainersAsync(minChange, limit, ct);

        var volatileStrategies = await db.UserStrategies
            .Where(s => s.UserId == userId && s.IsActive && s.IsVolatileMode)
            .Select(s => new { s.Id, s.Name, s.Timeframe, s.TrailingStopPct, s.StopLossPct,
                               s.VolatileMinChangePct, s.VolatileGainerLimit, s.VolatilePositionSizePct })
            .ToListAsync(ct);

        // Dashboard fiyat çekiminde aktif stratejinin ayarlarını kullan
        if (volatileStrategies.Count > 0)
        {
            var firstStrategy = volatileStrategies[0];
            minChange = firstStrategy.VolatileMinChangePct > 0 ? firstStrategy.VolatileMinChangePct : minChange;
            limit = firstStrategy.VolatileGainerLimit > 0 ? firstStrategy.VolatileGainerLimit : limit;
            momentumCoins = await binanceService.GetTopGainersAsync(minChange, limit, ct);
        }

        var openPositions = await db.Positions
            .Include(p => p.Coin)
            .Where(p => p.UserId == userId && p.Status == PositionStatus.Open)
            .ToListAsync(ct);

        var strategyIds = openPositions
            .Where(p => p.StrategyId.HasValue)
            .Select(p => p.StrategyId!.Value)
            .Distinct()
            .ToList();

        // Load strategy info list, then convert to dictionary (avoids anonymous-type ternary mismatch)
        var strategyInfoList = strategyIds.Count > 0
            ? await db.UserStrategies
                .Where(s => strategyIds.Contains(s.Id))
                .Select(s => new StrategyInfo(s.Id, s.Name, s.IsVolatileMode))
                .ToListAsync(ct)
            : new List<StrategyInfo>();

        var strategyInfos = strategyInfoList.ToDictionary(s => s.Id);

        var positionByCoinSymbol = openPositions
            .Where(p => p.Coin != null)
            .GroupBy(p => p.Coin.Symbol)
            .ToDictionary(g => g.Key, g => g.First());

        var coinRows = momentumCoins.Select(m =>
        {
            positionByCoinSymbol.TryGetValue(m.Symbol, out var pos);
            string? stratName = null;
            bool isVolatilePos = false;
            if (pos?.StrategyId.HasValue == true && strategyInfos.TryGetValue(pos.StrategyId.Value, out var si))
            {
                stratName = si.Name;
                isVolatilePos = si.IsVolatileMode;
            }
            decimal? unrealizedPnlPct = pos != null && pos.EntryPrice > 0
                ? Math.Round((m.LastPrice - pos.EntryPrice) / pos.EntryPrice * 100m, 2)
                : null;

            return new
            {
                m.Symbol, m.BaseAsset,
                m.PriceChangePercent, m.LastPrice,
                m.QuoteVolume, m.HighPrice, m.LowPrice,
                HasOpenPosition = pos != null,
                IsVirtual = pos?.IsVirtual ?? false,
                EntryPrice = pos?.EntryPrice,
                UnrealizedPnlPct = unrealizedPnlPct,
                StrategyName = stratName,
                IsVolatileStrategy = isVolatilePos,
                LockedByOtherStrategy = pos != null && !isVolatilePos && stratName != null,
            };
        }).ToList();

        var momentumSymbols = new HashSet<string>(momentumCoins.Select(m => m.Symbol));
        var droppedPositions = openPositions
            .Where(p => p.Coin != null && !momentumSymbols.Contains(p.Coin.Symbol))
            .Select(p =>
            {
                strategyInfos.TryGetValue(p.StrategyId ?? Guid.Empty, out var si);
                bool isVolatile = si?.IsVolatileMode ?? false;
                return new
                {
                    p.Coin.Symbol,
                    BaseAsset = p.Coin.Symbol.EndsWith("USDT") ? p.Coin.Symbol[..^4] : p.Coin.Symbol,
                    PriceChangePercent = (decimal?)null,
                    LastPrice = (decimal?)null,
                    QuoteVolume = (decimal?)null,
                    HighPrice = (decimal?)null,
                    LowPrice = (decimal?)null,
                    HasOpenPosition = true,
                    p.IsVirtual,
                    EntryPrice = (decimal?)p.EntryPrice,
                    UnrealizedPnlPct = (decimal?)null,
                    StrategyName = si?.Name,
                    IsVolatileStrategy = isVolatile,
                    LockedByOtherStrategy = !isVolatile,
                };
            })
            .ToList();

        return Ok(new
        {
            momentumCoins = coinRows,
            droppedPositions,
            activeVolatileStrategies = volatileStrategies,
            hasVolatileMode = volatileStrategies.Count > 0,
            stats = new
            {
                totalMomentum = momentumCoins.Count,
                openPositions = openPositions.Count,
                volatilePositions = openPositions.Count(p =>
                    p.StrategyId.HasValue &&
                    strategyInfos.TryGetValue(p.StrategyId.Value, out var si) &&
                    si.IsVolatileMode),
            }
        });
    }

    private record StrategyInfo(Guid Id, string Name, bool IsVolatileMode);
}
