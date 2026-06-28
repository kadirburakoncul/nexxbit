using CriptoMoney.Application.Features.Coins.Commands.AddCoin;
using CriptoMoney.Application.Features.Coins.Commands.DeleteCoin;
using CriptoMoney.Application.Features.Coins.Commands.SyncCoins;
using CriptoMoney.Application.Features.Coins.Commands.ToggleWatchlist;
using CriptoMoney.Application.Features.Coins.Queries.GetCandles;
using CriptoMoney.Application.Features.Coins.Queries.GetCoins;
using CriptoMoney.Application.Common.Interfaces;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace CriptoMoney.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class CoinController(IMediator mediator, IBinanceService binanceService) : ControllerBase
{
    private Guid CurrentUserId => Guid.Parse(
        User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);

    [HttpGet]
    public async Task<IActionResult> GetCoins(CancellationToken ct)
    {
        var result = await mediator.Send(new GetCoinsQuery(CurrentUserId), ct);
        return result.Succeeded ? Ok(result.Data) : BadRequest(result);
    }

    [HttpGet("candles/{symbol}")]
    public async Task<IActionResult> GetCandles(
        string symbol,
        [FromQuery] string interval = "1h",
        [FromQuery] int limit = 200,
        CancellationToken ct = default)
    {
        var result = await mediator.Send(new GetCandlesQuery(symbol.ToUpper(), interval, limit), ct);
        return result.Succeeded ? Ok(result.Data) : BadRequest(result);
    }

    [HttpGet("binance")]
    public async Task<IActionResult> GetBinancePairs(CancellationToken ct)
    {
        var result = await binanceService.GetUsdtTradingPairsAsync(ct);
        return result.Succeeded ? Ok(result.Data) : BadRequest(result);
    }

    [HttpPost("sync")]
    public async Task<IActionResult> SyncCoins(CancellationToken ct)
    {
        var result = await mediator.Send(new SyncCoinsCommand(), ct);
        return result.Succeeded ? Ok(result.Data) : BadRequest(result);
    }

    [HttpPost("add")]
    public async Task<IActionResult> AddCoin([FromBody] AddCoinRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new AddCoinCommand(req.Symbol, req.BaseAsset, req.QuoteAsset, CurrentUserId), ct);
        return result.Succeeded ? Ok(result.Data) : BadRequest(result);
    }

    [HttpDelete("{coinId:int}")]
    public async Task<IActionResult> DeleteCoin(int coinId, CancellationToken ct)
    {
        var result = await mediator.Send(new DeleteCoinCommand(coinId, CurrentUserId), ct);
        return result.Succeeded ? NoContent() : BadRequest(result);
    }

    [HttpPost("{coinId:int}/watchlist")]
    public async Task<IActionResult> ToggleWatchlist(int coinId, CancellationToken ct)
    {
        var result = await mediator.Send(new ToggleWatchlistCommand(CurrentUserId, coinId), ct);
        if (!result.Succeeded) return BadRequest(result);
        return Ok(new { added = result.Data, message = result.Data ? "İzleme listesine eklendi." : "İzleme listesinden kaldırıldı." });
    }

    // 24s en fazla yükselen coinler — momentum tarayıcısı
    [HttpGet("momentum")]
    public async Task<IActionResult> GetMomentumCoins(
        [FromQuery] decimal minChange = 3,
        [FromQuery] int limit = 25,
        CancellationToken ct = default)
    {
        var result = await binanceService.GetTopGainersAsync(minChange, limit, ct);
        return Ok(result);
    }
}

public record AddCoinRequest(string Symbol, string BaseAsset, string QuoteAsset);
