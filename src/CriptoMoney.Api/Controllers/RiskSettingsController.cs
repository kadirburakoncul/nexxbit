using CriptoMoney.Application.Features.RiskSettings.Commands.UpdateCoinLists;
using CriptoMoney.Application.Features.RiskSettings.Commands.UpdateRiskSettings;
using CriptoMoney.Application.Features.RiskSettings.Queries.GetRiskSettings;
using CriptoMoney.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace CriptoMoney.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class RiskSettingsController(IMediator mediator) : ControllerBase
{
    private Guid CurrentUserId => Guid.Parse(
        User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var result = await mediator.Send(new GetRiskSettingsQuery(CurrentUserId), ct);
        return result.Succeeded ? Ok(result.Data) : BadRequest(result);
    }

    [HttpPut]
    public async Task<IActionResult> Update([FromBody] UpdateRiskSettingsRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new UpdateRiskSettingsCommand(
            CurrentUserId,
            req.TradeMode,
            req.IsAutoTradeEnabled,
            req.MaxDailyLossUsdt,
            req.MaxDailyLossPct,
            req.MaxOpenPositions,
            req.MaxPositionSizeUsdt,
            req.MaxPositionSizePct,
            req.DefaultStopLossPct,
            req.DefaultTakeProfitPct,
            req.IsStopLossRequired,
            req.CloseOnDisconnect,
            req.FlashCrashProtectionEnabled,
            req.FlashCrashDropPct,
            req.FlashCrashWindowMinutes
        ), ct);
        return result.Succeeded ? NoContent() : BadRequest(result);
    }

    [HttpPut("coin-lists")]
    public async Task<IActionResult> UpdateCoinLists([FromBody] UpdateCoinListsRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(
            new UpdateCoinListsCommand(CurrentUserId, req.AllowedCoinIds, req.BlockedCoinIds), ct);
        return result.Succeeded ? NoContent() : BadRequest(result);
    }
}

public record UpdateCoinListsRequest(
    List<int> AllowedCoinIds,
    List<int> BlockedCoinIds
);

public record UpdateRiskSettingsRequest(
    TradeMode TradeMode,
    bool IsAutoTradeEnabled,
    decimal? MaxDailyLossUsdt,
    decimal? MaxDailyLossPct,
    int MaxOpenPositions,
    decimal? MaxPositionSizeUsdt,
    decimal? MaxPositionSizePct,
    decimal? DefaultStopLossPct,
    decimal? DefaultTakeProfitPct,
    bool IsStopLossRequired,
    bool CloseOnDisconnect,
    bool FlashCrashProtectionEnabled = true,
    decimal FlashCrashDropPct = 5.0m,
    int FlashCrashWindowMinutes = 15
);
