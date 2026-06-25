using CriptoMoney.Application.Features.Positions.Commands.DeletePosition;
using CriptoMoney.Application.Features.Positions.Queries.GetPositions;
using CriptoMoney.Application.Features.Positions.Queries.GetPositionStats;
using CriptoMoney.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace CriptoMoney.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PositionController(IMediator mediator) : ControllerBase
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
}

public record BulkDeleteRequest(List<Guid> Ids);
