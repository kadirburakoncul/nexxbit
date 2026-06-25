using CriptoMoney.Application.Features.Balance.Queries.GetBalanceHistory;
using CriptoMoney.Application.Features.BinanceAccount.Commands.DeleteApiKey;
using CriptoMoney.Application.Features.BinanceAccount.Commands.SaveApiKey;
using CriptoMoney.Application.Features.BinanceAccount.Queries.GetAccountStatus;
using CriptoMoney.Application.Features.BinanceAccount.Queries.GetBalances;
using CriptoMoney.Application.Common.Interfaces;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace CriptoMoney.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class BinanceAccountController(IMediator mediator, IBinanceService binanceService) : ControllerBase
{
    private Guid CurrentUserId => Guid.Parse(
        User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);

    [HttpGet("status")]
    public async Task<IActionResult> GetStatus(CancellationToken ct)
    {
        var result = await mediator.Send(new GetAccountStatusQuery(CurrentUserId), ct);
        return Ok(result.Data);
    }

    [HttpPost("api-key")]
    public async Task<IActionResult> SaveApiKey([FromBody] SaveApiKeyRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(
            new SaveBinanceApiKeyCommand(CurrentUserId, req.ApiKey, req.ApiSecret, req.IsTestnet), ct);

        if (!result.Succeeded)
            return BadRequest(new { errors = result.Errors });

        return Ok(result.Data);
    }

    [HttpDelete("api-key")]
    public async Task<IActionResult> DeleteApiKey(CancellationToken ct)
    {
        await mediator.Send(new DeleteBinanceApiKeyCommand(CurrentUserId), ct);
        return NoContent();
    }

    [HttpGet("balances")]
    public async Task<IActionResult> GetBalances(CancellationToken ct)
    {
        var result = await mediator.Send(new GetBalancesQuery(CurrentUserId), ct);
        if (!result.Succeeded)
            return BadRequest(new { errors = result.Errors });

        return Ok(result.Data);
    }

    [HttpGet("debug-balances")]
    public async Task<IActionResult> DebugBalances(CancellationToken ct)
    {
        var result = await binanceService.GetBalancesAsync(CurrentUserId, ct);
        return Ok(new {
            succeeded = result.Succeeded,
            errors = result.Errors,
            totalCount = result.Data?.Count ?? 0,
            all = result.Data,
        });
    }

    [HttpGet("balance-history")]
    public async Task<IActionResult> GetBalanceHistory([FromQuery] int days = 30, CancellationToken ct = default)
    {
        var result = await mediator.Send(new GetBalanceHistoryQuery(CurrentUserId, days), ct);
        return result.Succeeded ? Ok(result.Data) : BadRequest(result);
    }
}

public record SaveApiKeyRequest(string ApiKey, string ApiSecret, bool IsTestnet = false);
