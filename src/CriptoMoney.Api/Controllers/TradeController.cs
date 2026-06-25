using CriptoMoney.Application.Features.Trades.Commands.PlaceManualOrder;
using CriptoMoney.Application.Features.Trades.Queries.GetOrders;
using CriptoMoney.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace CriptoMoney.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TradeController(IMediator mediator) : ControllerBase
{
    private Guid CurrentUserId => Guid.Parse(
        User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);

    [HttpGet("orders")]
    public async Task<IActionResult> GetOrders(
        [FromQuery] int? coinId,
        [FromQuery] OrderStatus? status,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var result = await mediator.Send(
            new GetOrdersQuery(CurrentUserId, coinId, status, pageNumber, pageSize), ct);
        return result.Succeeded ? Ok(result.Data) : BadRequest(result);
    }

    [HttpPost("manual")]
    public async Task<IActionResult> PlaceManualOrder(
        [FromBody] ManualOrderRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(
            new PlaceManualOrderCommand(CurrentUserId, req.CoinId, req.Symbol, req.Side, req.QuoteQty), ct);
        return result.Succeeded
            ? CreatedAtAction(nameof(GetOrders), new { }, new { orderId = result.Data })
            : BadRequest(result);
    }
}

public record ManualOrderRequest(int CoinId, string Symbol, OrderSide Side, decimal QuoteQty);
