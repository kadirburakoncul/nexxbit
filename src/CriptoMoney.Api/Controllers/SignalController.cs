using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Features.Signals.Commands.ApproveSignal;
using CriptoMoney.Application.Features.Signals.Queries.GetMultiTimeframeSignals;
using CriptoMoney.Application.Features.Signals.Queries.GetSignals;
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
public class SignalController(IMediator mediator, ISignalEngine signalEngine, IApplicationDbContext db) : ControllerBase
{
    private Guid CurrentUserId => Guid.Parse(
        User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);

    /// <summary>
    /// Sinyal geçmişini listeler. Strateji ActivatedAt'inden önceki sinyalleri dışlar.
    /// </summary>
    [HttpGet("history")]
    public async Task<IActionResult> GetHistory(
        [FromQuery] int pageSize = 200,
        CancellationToken ct = default)
    {
        var userId = CurrentUserId;

        // Aktif stratejilerin ActivatedAt bilgisini çek
        var strategies = await db.UserStrategies
            .Where(s => s.UserId == userId)
            .Select(s => new { s.Id, s.ActivatedAt, s.Name })
            .ToListAsync(ct);

        var activatedMap = strategies.ToDictionary(s => s.Id, s => s.ActivatedAt);
        var nameMap = strategies.ToDictionary(s => s.Id, s => s.Name);

        var signals = await db.TradeSignals
            .Include(s => s.Coin)
            .Where(s => s.UserId == userId)
            .OrderByDescending(s => s.CandleTime)
            .Take(500)
            .ToListAsync(ct);

        // Her sinyali, ait olduğu stratejinin ActivatedAt'inden sonra üretilmişse dahil et
        var filtered = signals
            .Where(s =>
            {
                if (!activatedMap.TryGetValue(s.StrategyId, out var activatedAt)) return false;
                if (activatedAt is null) return true;
                return s.CandleTime >= activatedAt.Value;
            })
            .Take(pageSize)
            .Select(s => new
            {
                s.Id,
                s.CoinId,
                coinSymbol = s.Coin.Symbol,
                direction = s.Direction.ToString(),
                s.Price,
                candleTime = DateTime.SpecifyKind(s.CandleTime, DateTimeKind.Utc),
                createdAt = DateTime.SpecifyKind(s.CreatedAt, DateTimeKind.Utc),
                s.Timeframe,
                strategyName = nameMap.GetValueOrDefault(s.StrategyId, "—"),
                s.TotalScore,
                s.IsActedUpon,
            })
            .ToList();

        return Ok(filtered);
    }

    /// <summary>
    /// Sinyal istatistiklerini döner (TradeSignals tablosundan).
    /// </summary>
    [HttpGet("history/stats")]
    public async Task<IActionResult> GetHistoryStats(CancellationToken ct = default)
    {
        var userId = CurrentUserId;

        var strategies = await db.UserStrategies
            .Where(s => s.UserId == userId)
            .Select(s => new { s.Id, s.ActivatedAt })
            .ToListAsync(ct);
        var activatedMap = strategies.ToDictionary(s => s.Id, s => s.ActivatedAt);

        var signals = await db.TradeSignals
            .Where(s => s.UserId == userId)
            .Select(s => new { s.StrategyId, s.Direction, s.CandleTime })
            .ToListAsync(ct);

        var filtered = signals.Where(s =>
        {
            if (!activatedMap.TryGetValue(s.StrategyId, out var a)) return false;
            return a is null || s.CandleTime >= a.Value;
        }).ToList();

        return Ok(new
        {
            total = filtered.Count,
            buySignals = filtered.Count(s => s.Direction == SignalDirection.Buy),
            sellSignals = filtered.Count(s => s.Direction == SignalDirection.Sell || s.Direction == SignalDirection.StrongSell),
        });
    }

    [HttpGet]
    public async Task<IActionResult> GetSignals(
        [FromQuery] int? coinId,
        [FromQuery] SignalDirection? direction,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var result = await mediator.Send(
            new GetSignalsQuery(CurrentUserId, coinId, direction, pageNumber, pageSize), ct);
        return result.Succeeded ? Ok(result.Data) : BadRequest(result);
    }

    /// <summary>
    /// Multi-timeframe confluence görünümü: son N saatteki sinyaller coin bazında gruplanır.
    /// </summary>
    [HttpGet("multi-timeframe")]
    public async Task<IActionResult> GetMultiTimeframe(
        [FromQuery] int hours = 24,
        CancellationToken ct = default)
    {
        var result = await mediator.Send(new GetMultiTimeframeSignalsQuery(CurrentUserId, hours), ct);
        return result.Succeeded ? Ok(result.Data) : BadRequest(result);
    }

    [HttpPost("{signalId:guid}/approve")]
    public async Task<IActionResult> ApproveSignal(Guid signalId, CancellationToken ct)
    {
        var result = await mediator.Send(new ApproveSignalCommand(signalId, CurrentUserId), ct);
        return result.Succeeded ? Ok() : BadRequest(result);
    }

    /// <summary>
    /// Belirtilen coin+timeframe için sinyal analizi döner.
    /// Sinyal üretilemese bile neden üretilemediğini açıklar.
    /// </summary>
    [HttpGet("analyze")]
    public async Task<IActionResult> Analyze(
        [FromQuery] int coinId,
        [FromQuery] string symbol,
        [FromQuery] string timeframe = "1h",
        CancellationToken ct = default)
    {
        var result = await signalEngine.AnalyzeAsync(CurrentUserId, coinId, symbol, timeframe, ct);
        return Ok(result);
    }

    /// <summary>
    /// Belirtilen coin+timeframe için T3 çizgisi + OHLCV verisi + sinyal markerları döner.
    /// lightweight-charts ile doğrudan kullanılabilir.
    /// </summary>
    [HttpGet("t3-chart")]
    public async Task<IActionResult> T3Chart(
        [FromQuery] int coinId,
        [FromQuery] string symbol,
        [FromQuery] string timeframe = "1h",
        [FromQuery] int limit = 150,
        CancellationToken ct = default)
    {
        var result = await signalEngine.GetT3ChartAsync(CurrentUserId, coinId, symbol, timeframe, limit, ct);
        if (result is null) return BadRequest("Binance bağlantısı kurulamadı veya veri alınamadı.");
        return Ok(result);
    }
}
