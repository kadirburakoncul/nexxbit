using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Features.Strategy.Commands.UpsertStrategy;
using CriptoMoney.Application.Features.Strategy.Queries.GetStrategies;
using CriptoMoney.Application.Features.Strategy.Queries.GetStrategyMonitor;
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
    public async Task<IActionResult> ToggleStrategy(Guid id, CancellationToken ct)
    {
        var strategy = await db.UserStrategies
            .FirstOrDefaultAsync(s => s.Id == id && s.UserId == CurrentUserId, ct);

        if (strategy is null) return NotFound();

        // Aktifleştirme ise indikatör aktif mi kontrol et
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

        strategy.IsActive = !strategy.IsActive;
        if (strategy.IsActive)
            strategy.ActivatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);
        return Ok(new { isActive = strategy.IsActive, activatedAt = strategy.ActivatedAt });
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

    // Belirli bir coin'in ReEntryState'ini Normal'e sıfırla
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
        new(CurrentUserId, strategyId, req.Name, req.IndicatorId, req.CoinIds, req.Timeframe, req.TrailingStopPct, req.StopLossPct);
}

public record UpsertStrategyRequest(
    string Name,
    int? IndicatorId,
    List<int> CoinIds,
    string Timeframe,
    decimal TrailingStopPct,
    decimal StopLossPct
);
