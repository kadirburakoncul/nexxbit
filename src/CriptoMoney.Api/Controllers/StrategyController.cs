using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Features.Strategy.Commands.UpsertStrategy;
using CriptoMoney.Application.Features.Strategy.Queries.GetStrategies;
using CriptoMoney.Application.Features.Strategy.Queries.GetStrategyMonitor;
using CriptoMoney.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace CriptoMoney.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class StrategyController(IMediator mediator, IApplicationDbContext db) : ControllerBase
{
    private Guid CurrentUserId => Guid.Parse(
        User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);

    [HttpGet]
    public async Task<IActionResult> GetStrategies(CancellationToken ct)
    {
        var result = await mediator.Send(new GetStrategiesQuery(CurrentUserId), ct);
        return result.Succeeded ? Ok(result.Data) : BadRequest(result);
    }

    [HttpGet("monitor")]
    public async Task<IActionResult> GetMonitor(CancellationToken ct)
    {
        var result = await mediator.Send(new GetStrategyMonitorQuery(CurrentUserId), ct);
        return result.Succeeded ? Ok(result.Data) : BadRequest(result);
    }

    [HttpPost]
    public async Task<IActionResult> CreateStrategy([FromBody] UpsertStrategyRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(BuildCommand(null, req), ct);
        return result.Succeeded
            ? CreatedAtAction(nameof(GetStrategies), new { id = result.Data }, new { strategyId = result.Data })
            : BadRequest(result);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateStrategy(Guid id, [FromBody] UpsertStrategyRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(BuildCommand(id, req), ct);
        return result.Succeeded ? NoContent() : BadRequest(result);
    }

    [HttpPatch("{id:guid}/toggle")]
    public async Task<IActionResult> ToggleStrategy(
        Guid id,
        [FromQuery] string? action = null,    // "close" | "manual" | null
        CancellationToken ct = default)
    {
        var strategy = await db.UserStrategies
            .FirstOrDefaultAsync(s => s.Id == id && s.UserId == CurrentUserId, ct);

        if (strategy is null) return NotFound();

        // Aktifleştirme: indikatör pasifse engelle
        if (!strategy.IsActive && strategy.IndicatorId.HasValue)
        {
            var indicatorSetting = await db.UserIndicatorSettings
                .FirstOrDefaultAsync(s =>
                    s.UserId == CurrentUserId &&
                    s.IndicatorId == strategy.IndicatorId.Value &&
                    s.CoinId == null, ct);

            bool indicatorEnabled = indicatorSetting?.IsEnabled ?? true;
            if (!indicatorEnabled)
            {
                var indicatorName = await db.Indicators
                    .Where(i => i.Id == strategy.IndicatorId.Value)
                    .Select(i => i.DisplayName)
                    .FirstOrDefaultAsync(ct) ?? "İndikatör";

                return Conflict(new
                {
                    errors = new[] { $"\"{indicatorName}\" indikatörü pasif durumda. Stratejiyi aktifleştirmek için önce indikatörü aktif yapın." }
                });
            }
        }

        // Deaktifleştirme onay kontrolü (action belirtilmemişse)
        if (strategy.IsActive && action is null)
        {
            var realPositionCount = await db.Positions
                .CountAsync(p => p.StrategyId == id && p.Status == PositionStatus.Open && !p.IsVirtual, ct);

            var virtualPositionCount = await db.Positions
                .CountAsync(p => p.StrategyId == id && p.Status == PositionStatus.Open && p.IsVirtual, ct);

            if (realPositionCount > 0 || virtualPositionCount > 0)
            {
                return Ok(new
                {
                    requiresConfirmation = true,
                    isActive = true,
                    signalCount = 0,
                    realPositionCount,
                    virtualPositionCount,
                });
            }
        }

        // Hem close hem manual: önce sinyalleri ve sanal pozisyonları temizle
        if (strategy.IsActive && action is "close" or "manual")
        {
            var signals = await db.TradeSignals
                .Where(s => s.StrategyId == id && !s.IsActedUpon)
                .ToListAsync(ct);
            db.TradeSignals.RemoveRange(signals);

            var virtualPositions = await db.Positions
                .Where(p => p.StrategyId == id && p.Status == PositionStatus.Open && p.IsVirtual)
                .ToListAsync(ct);
            foreach (var pos in virtualPositions)
            {
                pos.Status = PositionStatus.Closed;
                pos.ClosedAt = DateTime.UtcNow;
                pos.CloseReason = "Strateji deaktif edildi";
                if (pos.EntryPrice > 0) { pos.ClosePrice = pos.EntryPrice; pos.RealizedPnl = 0; pos.RealizedPnlPct = 0; }
            }

            if (action == "close")
            {
                // Gerçek pozisyonları da DB'de kapat (market satış PositionController'dan yapılır)
                var realPositions = await db.Positions
                    .Where(p => p.StrategyId == id && p.Status == PositionStatus.Open && !p.IsVirtual)
                    .ToListAsync(ct);
                foreach (var pos in realPositions)
                {
                    pos.Status = PositionStatus.Closed;
                    pos.ClosedAt = DateTime.UtcNow;
                    pos.CloseReason = "Strateji deaktif edildi — market satış";
                    if (pos.EntryPrice > 0) { pos.ClosePrice = pos.EntryPrice; pos.RealizedPnl = 0; pos.RealizedPnlPct = 0; }
                }
            }
            // action=="manual": gerçek pozisyonlar açık kalır, StrategyId korunur (strateji pasif=orphaned)
        }

        strategy.IsActive = !strategy.IsActive;
        if (strategy.IsActive) strategy.ActivatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);
        return Ok(new { isActive = strategy.IsActive, activatedAt = strategy.ActivatedAt, requiresConfirmation = false });
    }

    [HttpPatch("{id:guid}/toggle-real-trade")]
    public async Task<IActionResult> ToggleRealTrade(Guid id, CancellationToken ct)
    {
        var strategy = await db.UserStrategies
            .FirstOrDefaultAsync(s => s.Id == id && s.UserId == CurrentUserId, ct);

        if (strategy is null) return NotFound();

        strategy.IsRealTradeEnabled = !strategy.IsRealTradeEnabled;
        await db.SaveChangesAsync(ct);
        return Ok(new { isRealTradeEnabled = strategy.IsRealTradeEnabled });
    }

    [HttpPatch("{id:guid}/coins/{coinId:int}/reset-reentry")]
    public async Task<IActionResult> ResetReEntry(Guid id, int coinId, CancellationToken ct)
    {
        var strategyCoin = await db.UserStrategyCoins
            .Include(sc => sc.UserStrategy)
            .FirstOrDefaultAsync(sc =>
                sc.UserStrategyId == id &&
                sc.CoinId == coinId &&
                sc.UserStrategy.UserId == CurrentUserId, ct);

        if (strategyCoin is null) return NotFound();

        strategyCoin.ReEntryState = Domain.Enums.ReEntryState.Normal;
        strategyCoin.LastCheckedReason = "Manuel sıfırlama";
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteStrategy(Guid id, CancellationToken ct)
    {
        var strategy = await db.UserStrategies
            .Include(s => s.StrategyCoins)
            .FirstOrDefaultAsync(s => s.Id == id && s.UserId == CurrentUserId, ct);

        if (strategy is null) return NotFound();

        var signals = await db.TradeSignals
            .Where(s => s.StrategyId == id)
            .ToListAsync(ct);

        db.TradeSignals.RemoveRange(signals);
        db.UserStrategyCoins.RemoveRange(strategy.StrategyCoins);
        db.UserStrategies.Remove(strategy);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    private UpsertStrategyCommand BuildCommand(Guid? strategyId, UpsertStrategyRequest req) =>
        new(CurrentUserId, strategyId, req.Name, req.IndicatorId, req.CoinIds,
            req.Timeframe, req.TrailingStopPct, req.StopLossPct, req.IsVolatileMode,
            req.TakeProfitPct, req.MinVolumeUsdt, req.VolatilePositionSizePct,
            req.VolatileMinChangePct, req.VolatileGainerLimit, req.IsRsiFilterEnabled,
            req.MomentumFreshFilterMinutes,
            req.UseAtrBasedStops, req.AtrPeriod, req.AtrSlMultiplier, req.AtrTpMultiplier,
            req.PartialTpPct, req.PartialTpClosePct,
            req.IsVolumeSurgeFilterEnabled, req.VolumeSurgeMultiplier,
            req.UseMarketRegimeFilter,
            req.IsEma200RuleEnabled,
            req.MaxHoldHours, req.SlCooldownHours, req.IsGreenCandleFilterEnabled,
            req.MaxOpenPositions, req.MaxPositionSizeUsdt, req.MaxPositionSizePct, req.MinPositionSizeUsdt,
            req.UseAdxFilter, req.AdxPeriod, req.AdxMinValue,
            req.UseMacdFilter,
            req.UseBreakevenStop, req.BreakevenTriggerPct);
}

public class UpsertStrategyRequest
{
    public string Name { get; set; } = "";
    public int? IndicatorId { get; set; }
    public List<int> CoinIds { get; set; } = [];
    public string Timeframe { get; set; } = "1h";
    public decimal TrailingStopPct { get; set; }
    public decimal StopLossPct { get; set; }
    public decimal? TakeProfitPct { get; set; }
    public decimal? MinVolumeUsdt { get; set; }
    public decimal? VolatilePositionSizePct { get; set; }
    public bool IsVolatileMode { get; set; } = false;
    public decimal VolatileMinChangePct { get; set; } = 3.0m;
    public int VolatileGainerLimit { get; set; } = 20;
    public bool IsRsiFilterEnabled { get; set; } = false;
    public int MomentumFreshFilterMinutes { get; set; } = 5;
    public bool UseAtrBasedStops { get; set; } = false;
    public int AtrPeriod { get; set; } = 14;
    public decimal AtrSlMultiplier { get; set; } = 1.5m;
    public decimal AtrTpMultiplier { get; set; } = 3.0m;
    public decimal? PartialTpPct { get; set; }
    public decimal PartialTpClosePct { get; set; } = 50m;
    public bool IsVolumeSurgeFilterEnabled { get; set; } = false;
    public decimal VolumeSurgeMultiplier { get; set; } = 2.0m;
    public bool UseMarketRegimeFilter { get; set; } = true;
    public bool IsEma200RuleEnabled { get; set; } = true;
    public int MaxHoldHours { get; set; } = 8;
    public int SlCooldownHours { get; set; } = 4;
    public bool IsGreenCandleFilterEnabled { get; set; } = true;
    public int MaxOpenPositions { get; set; } = 5;
    public decimal? MaxPositionSizeUsdt { get; set; }
    public decimal? MaxPositionSizePct { get; set; }
    public decimal MinPositionSizeUsdt { get; set; } = 10m;
    // ADX filtresi
    public bool UseAdxFilter { get; set; } = false;
    public int AdxPeriod { get; set; } = 14;
    public decimal AdxMinValue { get; set; } = 25m;
    // MACD filtresi
    public bool UseMacdFilter { get; set; } = false;
    // Breakeven stop
    public bool UseBreakevenStop { get; set; } = false;
    public decimal BreakevenTriggerPct { get; set; } = 1.5m;
}
