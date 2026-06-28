using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Features.Positions.Commands.DeletePosition;
using CriptoMoney.Application.Features.Positions.Queries.GetPositions;
using CriptoMoney.Application.Features.Positions.Queries.GetPositionStats;
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
public class PositionController(IMediator mediator, IApplicationDbContext db, IBinanceService binanceService) : ControllerBase
{
    private Guid CurrentUserId => Guid.Parse(
        User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);

    [HttpGet]
    public async Task<IActionResult> GetPositions(
        [FromQuery] PositionStatus? status,
        [FromQuery] bool? isVirtual = null,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 200,
        CancellationToken ct = default)
    {
        var result = await mediator.Send(
            new GetPositionsQuery(CurrentUserId, status, isVirtual, pageNumber, pageSize), ct);
        return result.Succeeded ? Ok(result.Data) : BadRequest(result);
    }

    [HttpGet("stats")]
    public async Task<IActionResult> GetStats(CancellationToken ct)
    {
        var result = await mediator.Send(new GetPositionStatsQuery(CurrentUserId), ct);
        return result.Succeeded ? Ok(result.Data) : BadRequest(result);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeletePosition(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new DeletePositionCommand(id, CurrentUserId), ct);
        return result.Succeeded ? NoContent() : BadRequest(result);
    }

    [HttpDelete("bulk")]
    public async Task<IActionResult> DeletePositions([FromBody] BulkDeleteRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new DeletePositionsCommand(req.Ids, CurrentUserId), ct);
        return result.Succeeded ? NoContent() : BadRequest(result);
    }

    /// <summary>
    /// Manuel sat/kapat. Sanal pozisyon için Binance emri gönderilmez — sadece DB kapatılır.
    /// Gerçek pozisyon için: type="market" anında satar; type="limit" fiyatı kontrol eder.
    /// Her iki durumda da strateji ReEntryState'i WaitingForSell'e çekilir.
    /// </summary>
    [HttpPost("{id:guid}/manual-sell")]
    public async Task<IActionResult> ManualSell(Guid id, [FromBody] ManualSellRequest req, CancellationToken ct)
    {
        var userId = CurrentUserId;

        var position = await db.Positions
            .Include(p => p.Coin)
            .FirstOrDefaultAsync(p => p.Id == id && p.UserId == userId && p.Status == PositionStatus.Open, ct);

        if (position is null)
            return NotFound(new { errors = new[] { "Pozisyon bulunamadı veya zaten kapalı." } });

        var symbol = position.Coin.Symbol;
        decimal fillPrice;

        if (position.IsVirtual)
        {
            // Sanal pozisyon: fiyat al, Binance emri yok
            var price = await binanceService.GetCurrentPriceAsync(symbol, ct) ?? position.EntryPrice;
            fillPrice = price;

            position.Status = PositionStatus.Closed;
            position.ClosedAt = DateTime.UtcNow;
            position.ClosePrice = fillPrice;
            position.CloseReason = "Manuel kapatıldı";
            if (position.EntryPrice > 0)
            {
                position.RealizedPnlPct = Math.Round((fillPrice - position.EntryPrice) / position.EntryPrice * 100m, 4);
                position.RealizedPnl = position.EntryQuantity > 0
                    ? (fillPrice - position.EntryPrice) * position.EntryQuantity
                    : null;
            }
        }
        else
        {
            // Gerçek pozisyon: Binance'te market sat
            var currentPrice = await binanceService.GetCurrentPriceAsync(symbol, ct);
            if (currentPrice is null or 0)
                return BadRequest(new { errors = new[] { $"{symbol} için güncel fiyat alınamadı." } });

            // Limit hedef kontrolü — hedef fiyata ulaşılmadıysa 422 ile uyarı dön
            if (req.Type == "limit" && req.LimitPrice.HasValue && currentPrice < req.LimitPrice.Value && !req.Force)
            {
                return UnprocessableEntity(new
                {
                    belowTarget = true,
                    currentPrice,
                    limitPrice = req.LimitPrice.Value,
                    diff = Math.Round((currentPrice.Value - req.LimitPrice.Value) / req.LimitPrice.Value * 100m, 2),
                });
            }

            var baseAsset = symbol.EndsWith("USDT") ? symbol[..^4] : symbol;
            var qty = await binanceService.GetCoinBalanceAsync(userId, baseAsset, ct);
            if (qty <= 0) qty = position.EntryQuantity;
            if (qty <= 0)
                return BadRequest(new { errors = new[] { $"Binance'te satılacak {baseAsset} bakiyesi bulunamadı." } });
            qty = Math.Floor(qty * 100_000_000m) / 100_000_000m;

            var orderResult = await binanceService.PlaceMarketOrderAsync(userId, symbol, OrderSide.Sell, qty, ct);
            if (!orderResult.Succeeded)
                return BadRequest(new { errors = new[] { orderResult.Errors.FirstOrDefault() ?? "Emir gönderilemedi." } });

            fillPrice = orderResult.Data!.CummulativeQuoteQty > 0 && orderResult.Data!.ExecutedQty > 0
                ? orderResult.Data!.CummulativeQuoteQty / orderResult.Data!.ExecutedQty
                : currentPrice!.Value;

            position.Status = PositionStatus.Closed;
            position.ClosedAt = DateTime.UtcNow;
            position.ClosePrice = fillPrice;
            position.CloseValueUsdt = orderResult.Data.CummulativeQuoteQty > 0
                ? orderResult.Data.CummulativeQuoteQty
                : qty * fillPrice;
            position.CloseReason = req.Type == "limit" ? "Manuel satış (limit hedefli)" : "Manuel satış";

            if (position.EntryValueUsdt > 0 && position.EntryPrice > 0)
            {
                position.RealizedPnl = position.CloseValueUsdt - position.EntryValueUsdt;
                position.RealizedPnlPct = Math.Round((fillPrice - position.EntryPrice) / position.EntryPrice * 100m, 4);
            }
        }

        // Strateji re-entry: bir sonraki alış için SAT sinyali bekle
        if (position.StrategyId.HasValue)
        {
            var strategyCoin = await db.UserStrategyCoins
                .FirstOrDefaultAsync(sc =>
                    sc.UserStrategyId == position.StrategyId.Value &&
                    sc.CoinId == position.CoinId, ct);

            if (strategyCoin is not null)
            {
                strategyCoin.ReEntryState = ReEntryState.WaitingForSell;
                strategyCoin.LastCheckedReason = "Manuel satış — SAT sinyali bekleniliyor, sonrasında AL sinyalinde girilecek";
            }
        }

        await db.SaveChangesAsync(ct);

        return Ok(new
        {
            success = true,
            fillPrice,
            closeValueUsdt = position.CloseValueUsdt,
            realizedPnl = position.RealizedPnl,
            realizedPnlPct = position.RealizedPnlPct,
            isVirtual = position.IsVirtual,
        });
    }
}

public record BulkDeleteRequest(List<Guid> Ids);

public class ManualSellRequest
{
    public string Type { get; set; } = "market";      // "market" | "limit"
    public decimal? LimitPrice { get; set; }           // "limit" tipinde gerekli
    public bool Force { get; set; } = false;           // true = fiyat düşük olsa bile sat
}
