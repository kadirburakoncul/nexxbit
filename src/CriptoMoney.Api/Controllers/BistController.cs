using System.Security.Claims;
using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CriptoMoney.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class BistController(IApplicationDbContext db, IBistDataService bistData) : ControllerBase
{
    private Guid CurrentUserId => Guid.Parse(
        User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);

    // ─── Hisse kataloğu ──────────────────────────────────────────────────────────
    [HttpGet("catalog")]
    public async Task<IActionResult> GetCatalog(CancellationToken ct)
    {
        var stocks = await db.BistStocks
            .OrderBy(s => s.Symbol)
            .Select(s => new BistCatalogStockDto(s.Id, s.Symbol, s.DisplayName, s.Sector))
            .ToListAsync(ct);
        return Ok(stocks);
    }

    // ─── Watchlist ────────────────────────────────────────────────────────────────
    [HttpGet("watchlist")]
    public async Task<IActionResult> GetWatchlist(CancellationToken ct)
    {
        var items = await db.BistWatchlistItems
            .Include(w => w.BistStock)
            .Where(w => w.UserId == CurrentUserId)
            .OrderBy(w => w.BistStock.Symbol)
            .Select(w => new BistCatalogStockDto(w.BistStock.Id, w.BistStock.Symbol, w.BistStock.DisplayName, w.BistStock.Sector))
            .ToListAsync(ct);
        return Ok(items);
    }

    [HttpPost("watchlist/{stockId:int}")]
    public async Task<IActionResult> AddToWatchlist(int stockId, CancellationToken ct)
    {
        var exists = await db.BistWatchlistItems
            .AnyAsync(w => w.UserId == CurrentUserId && w.BistStockId == stockId, ct);
        if (exists) return Conflict();

        var stock = await db.BistStocks.FindAsync([stockId], ct);
        if (stock is null) return NotFound();

        db.BistWatchlistItems.Add(new BistWatchlistItem { UserId = CurrentUserId, BistStockId = stockId });
        await db.SaveChangesAsync(ct);
        return Ok();
    }

    [HttpDelete("watchlist/{stockId:int}")]
    public async Task<IActionResult> RemoveFromWatchlist(int stockId, CancellationToken ct)
    {
        var item = await db.BistWatchlistItems
            .FirstOrDefaultAsync(w => w.UserId == CurrentUserId && w.BistStockId == stockId, ct);
        if (item is null) return NotFound();

        db.BistWatchlistItems.Remove(item);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ─── İndikatör ayarları ──────────────────────────────────────────────────────
    [HttpGet("indicator-settings")]
    public async Task<IActionResult> GetIndicatorSettings(CancellationToken ct)
    {
        var settings = await db.BistIndicatorSettings.FirstOrDefaultAsync(s => s.UserId == CurrentUserId, ct);
        settings ??= new BistIndicatorSetting { UserId = CurrentUserId };
        return Ok(ToIndicatorDto(settings));
    }

    [HttpPut("indicator-settings")]
    public async Task<IActionResult> UpdateIndicatorSettings([FromBody] BistIndicatorSettingDto req, CancellationToken ct)
    {
        var settings = await db.BistIndicatorSettings.FirstOrDefaultAsync(s => s.UserId == CurrentUserId, ct);
        if (settings is null)
        {
            settings = new BistIndicatorSetting { UserId = CurrentUserId };
            db.BistIndicatorSettings.Add(settings);
        }

        settings.T3Period = Math.Clamp(req.T3Period, 3, 50);
        settings.T3Factor = Math.Clamp(req.T3Factor, 0.1m, 1.0m);
        settings.IsRsiFilterEnabled = req.IsRsiFilterEnabled;
        settings.RsiPeriod = Math.Clamp(req.RsiPeriod, 2, 50);
        settings.RsiBuyThreshold = Math.Clamp(req.RsiBuyThreshold, 0, 100);

        await db.SaveChangesAsync(ct);
        return Ok(ToIndicatorDto(settings));
    }

    // ─── Stratejiler ────────────────────────────────────────────────────────────
    [HttpGet("strategies")]
    public async Task<IActionResult> GetStrategies(CancellationToken ct)
    {
        var strategies = await db.BistStrategies
            .Include(s => s.StrategyStocks).ThenInclude(ss => ss.BistStock)
            .Where(s => s.UserId == CurrentUserId)
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync(ct);

        return Ok(strategies.Select(ToStrategyDto));
    }

    [HttpPost("strategies")]
    public async Task<IActionResult> CreateStrategy([FromBody] UpsertBistStrategyRequest req, CancellationToken ct)
    {
        if (req.StockIds.Count == 0)
            return BadRequest(new { errors = new[] { "En az 1 hisse seçin." } });

        var validStockIds = await db.BistStocks
            .Where(s => req.StockIds.Contains(s.Id))
            .Select(s => s.Id)
            .ToListAsync(ct);

        var strategy = new BistStrategy
        {
            UserId = CurrentUserId,
            Name = req.Name.Trim(),
            Timeframe = req.Timeframe,
            IsActive = true,
            ActivatedAt = DateTime.UtcNow,
            IsRsiFilterEnabled = req.IsRsiFilterEnabled,
            UseEma200Filter = req.UseEma200Filter,
            IsPositionTrackingEnabled = req.IsPositionTrackingEnabled,
            StopLossPct = Math.Clamp(req.StopLossPct, 0, 50),
            TrailingStopPct = Math.Clamp(req.TrailingStopPct, 0, 50),
            TrailingActivationPct = Math.Clamp(req.TrailingActivationPct, 0, 50),
            RsiPeriod = Math.Clamp(req.RsiPeriod, 2, 50),
            RsiBuyThreshold = Math.Clamp(req.RsiBuyThreshold, 0, 100),
        };
        db.BistStrategies.Add(strategy);
        await db.SaveChangesAsync(ct);

        foreach (var stockId in validStockIds)
            db.BistStrategyStocks.Add(new BistStrategyStock { BistStrategyId = strategy.Id, BistStockId = stockId });

        await db.SaveChangesAsync(ct);
        return Ok(new { strategyId = strategy.Id });
    }

    [HttpPut("strategies/{id:guid}")]
    public async Task<IActionResult> UpdateStrategy(Guid id, [FromBody] UpsertBistStrategyRequest req, CancellationToken ct)
    {
        var strategy = await db.BistStrategies
            .Include(s => s.StrategyStocks)
            .FirstOrDefaultAsync(s => s.Id == id && s.UserId == CurrentUserId, ct);
        if (strategy is null) return NotFound();

        if (req.StockIds.Count == 0)
            return BadRequest(new { errors = new[] { "En az 1 hisse seçin." } });

        strategy.Name = req.Name.Trim();
        strategy.Timeframe = req.Timeframe;
        strategy.IsRsiFilterEnabled = req.IsRsiFilterEnabled;
        strategy.UseEma200Filter = req.UseEma200Filter;
        strategy.IsPositionTrackingEnabled = req.IsPositionTrackingEnabled;
        strategy.StopLossPct = Math.Clamp(req.StopLossPct, 0, 50);
        strategy.TrailingStopPct = Math.Clamp(req.TrailingStopPct, 0, 50);
        strategy.TrailingActivationPct = Math.Clamp(req.TrailingActivationPct, 0, 50);
        strategy.RsiPeriod = Math.Clamp(req.RsiPeriod, 2, 50);
        strategy.RsiBuyThreshold = Math.Clamp(req.RsiBuyThreshold, 0, 100);

        var existingIds = strategy.StrategyStocks.Select(ss => ss.BistStockId).ToHashSet();
        var requestIds = req.StockIds.ToHashSet();

        foreach (var ss in strategy.StrategyStocks.Where(ss => !requestIds.Contains(ss.BistStockId)).ToList())
            db.BistStrategyStocks.Remove(ss);

        foreach (var stockId in requestIds.Where(sid => !existingIds.Contains(sid)))
            db.BistStrategyStocks.Add(new BistStrategyStock { BistStrategyId = strategy.Id, BistStockId = stockId });

        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPatch("strategies/{id:guid}/toggle")]
    public async Task<IActionResult> ToggleStrategy(Guid id, CancellationToken ct)
    {
        var strategy = await db.BistStrategies.FirstOrDefaultAsync(s => s.Id == id && s.UserId == CurrentUserId, ct);
        if (strategy is null) return NotFound();

        strategy.IsActive = !strategy.IsActive;
        strategy.ActivatedAt = strategy.IsActive ? DateTime.UtcNow : strategy.ActivatedAt;
        await db.SaveChangesAsync(ct);

        return Ok(new { isActive = strategy.IsActive });
    }

    [HttpDelete("strategies/{id:guid}")]
    public async Task<IActionResult> DeleteStrategy(Guid id, CancellationToken ct)
    {
        var strategy = await db.BistStrategies.FirstOrDefaultAsync(s => s.Id == id && s.UserId == CurrentUserId, ct);
        if (strategy is null) return NotFound();

        db.BistStrategies.Remove(strategy);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ─── Sinyaller ──────────────────────────────────────────────────────────────
    [HttpGet("signals")]
    public async Task<IActionResult> GetSignals([FromQuery] int pageSize = 50, CancellationToken ct = default)
    {
        var signals = await db.BistSignals
            .Include(s => s.BistStock)
            .Include(s => s.BistStrategy)
            .Where(s => s.UserId == CurrentUserId)
            .OrderByDescending(s => s.CandleTime)
            .Take(pageSize)
            .Select(s => new BistSignalDto(
                s.Id, s.BistStock.Symbol, s.BistStock.DisplayName, s.BistStrategy.Name,
                s.Direction.ToString(), s.Price, s.CandleTime, s.Reason
            ))
            .ToListAsync(ct);

        return Ok(signals);
    }

    [HttpDelete("signals/{id:guid}")]
    public async Task<IActionResult> DeleteSignal(Guid id, CancellationToken ct)
    {
        var signal = await db.BistSignals.FirstOrDefaultAsync(s => s.Id == id && s.UserId == CurrentUserId, ct);
        if (signal is null) return NotFound();

        db.BistSignals.Remove(signal);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpGet("index")]
    public async Task<IActionResult> GetIndex(CancellationToken ct)
    {
        var price = await bistData.GetCurrentPriceAsync("XU100", ct);
        return Ok(new { symbol = "XU100", price });
    }

    [HttpGet("top-gainers")]
    public async Task<IActionResult> GetTopGainers([FromQuery] int count = 20, CancellationToken ct = default)
    {
        var stocks = await db.BistStocks.Select(s => s.Symbol).ToListAsync(ct);
        var quotes = await bistData.GetBulkQuotesAsync(stocks, ct);
        var top = quotes
            .Where(q => q.ChangePercent.HasValue)
            .OrderByDescending(q => q.ChangePercent)
            .Take(count)
            .Select(q => new { q.Symbol, q.DisplayName, q.Price, changePercent = q.ChangePercent })
            .ToList();
        return Ok(top);
    }

    // ─── Grafik verisi ──────────────────────────────────────────────────────────
    [HttpGet("chart/{symbol}")]
    public async Task<IActionResult> GetChart(
        string symbol,
        [FromQuery] string timeframe = "15m",
        [FromQuery] int limit = 200,
        CancellationToken ct = default)
    {
        var result = await bistData.GetCandlesAsync(symbol.ToUpperInvariant(), timeframe, limit, ct);
        if (!result.Succeeded)
            return BadRequest(new { errors = result.Errors });

        var candles = result.Data!.Select(c => new
        {
            time   = new DateTimeOffset(c.OpenTime, TimeSpan.Zero).ToUnixTimeSeconds(),
            open   = c.Open,
            high   = c.High,
            low    = c.Low,
            close  = c.Close,
            volume = c.Volume,
        });
        return Ok(candles);
    }

    // ─── Helpers ────────────────────────────────────────────────────────────────
    private static BistIndicatorSettingDto ToIndicatorDto(BistIndicatorSetting s) =>
        new(s.T3Period, s.T3Factor, s.IsRsiFilterEnabled, s.RsiPeriod, s.RsiBuyThreshold);

    private static BistStrategyDto ToStrategyDto(BistStrategy s) => new(
        s.Id, s.Name, s.Timeframe, s.IsActive, s.ActivatedAt,
        s.IsRsiFilterEnabled, s.RsiPeriod, s.RsiBuyThreshold,
        s.UseEma200Filter, s.IsPositionTrackingEnabled,
        s.StopLossPct, s.TrailingStopPct, s.TrailingActivationPct,
        s.StrategyStocks.Select(ss => new BistStrategyStockDto(
            ss.BistStockId, ss.BistStock.Symbol, ss.BistStock.DisplayName,
            ss.LastPrice, ss.LastPriceAt, ss.LastT3UpDirection, ss.LastCheckedAt, ss.LastCheckedReason
        )).OrderBy(x => x.Symbol).ToList()
    );
}

public record BistCatalogStockDto(int Id, string Symbol, string DisplayName, string? Sector);

public record BistIndicatorSettingDto(
    int T3Period, decimal T3Factor, bool IsRsiFilterEnabled, int RsiPeriod, decimal RsiBuyThreshold
);

public record UpsertBistStrategyRequest(
    string Name, string Timeframe, List<int> StockIds,
    bool IsRsiFilterEnabled = false, int RsiPeriod = 14, decimal RsiBuyThreshold = 50,
    bool UseEma200Filter = true,
    bool IsPositionTrackingEnabled = true,
    decimal StopLossPct = 8m, decimal TrailingStopPct = 8m,
    decimal TrailingActivationPct = 5m
);

public record BistStrategyDto(
    Guid Id, string Name, string Timeframe, bool IsActive, DateTime? ActivatedAt,
    bool IsRsiFilterEnabled, int RsiPeriod, decimal RsiBuyThreshold,
    bool UseEma200Filter, bool IsPositionTrackingEnabled,
    decimal StopLossPct, decimal TrailingStopPct, decimal TrailingActivationPct,
    List<BistStrategyStockDto> Stocks
);

public record BistStrategyStockDto(
    int StockId, string Symbol, string DisplayName,
    decimal? LastPrice, DateTime? LastPriceAt, bool? LastT3UpDirection,
    DateTime? LastCheckedAt, string? LastCheckedReason
);

public record BistSignalDto(
    Guid Id, string Symbol, string DisplayName, string StrategyName,
    string Direction, decimal Price, DateTime CandleTime, string? Reason
);
