using CriptoMoney.Application.Features.Backtest.Commands.DeleteBacktest;
using CriptoMoney.Application.Features.Backtest.Commands.StartBacktest;
using CriptoMoney.Application.Features.Backtest.Queries.GetBacktestResult;
using CriptoMoney.Application.Features.Backtest.Queries.ListBacktestRuns;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using System.Security.Claims;

namespace CriptoMoney.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class BacktestController(IMediator mediator) : ControllerBase
{
    private Guid CurrentUserId => Guid.Parse(
        User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var result = await mediator.Send(new ListBacktestRunsQuery(CurrentUserId), ct);
        return result.Succeeded ? Ok(result.Data) : BadRequest(result);
    }

    [HttpPost]
    [EnableRateLimiting("backtest")]
    public async Task<IActionResult> Start([FromBody] StartBacktestRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new StartBacktestCommand(
            CurrentUserId,
            req.Name,
            req.CoinIds,
            req.Timeframe,
            req.StartDate,
            req.EndDate,
            req.InitialCapital,
            req.CommissionRate,
            req.SlippagePct,
            req.StopLossPct,
            req.TakeProfitPct,
            req.StrategyConfig ?? "{}"
        ), ct);

        return result.Succeeded
            ? AcceptedAtAction(nameof(GetResult), new { runId = result.Data }, new { runId = result.Data })
            : BadRequest(result);
    }

    [HttpGet("{runId:guid}")]
    public async Task<IActionResult> GetResult(Guid runId, CancellationToken ct)
    {
        var result = await mediator.Send(new GetBacktestResultQuery(runId, CurrentUserId), ct);
        return result.Succeeded ? Ok(result.Data) : NotFound(result);
    }

    [HttpDelete("{runId:guid}")]
    public async Task<IActionResult> Delete(Guid runId, CancellationToken ct)
    {
        var result = await mediator.Send(new DeleteBacktestCommand(runId, CurrentUserId), ct);
        return result.Succeeded ? NoContent() : NotFound(result);
    }
}

public record StartBacktestRequest(
    string? Name,
    List<int> CoinIds,
    string Timeframe,
    DateTime StartDate,
    DateTime EndDate,
    decimal InitialCapital,
    decimal CommissionRate = 0.001m,
    decimal SlippagePct = 0.05m,
    decimal? StopLossPct = null,
    decimal? TakeProfitPct = null,
    string? StrategyConfig = null
);
