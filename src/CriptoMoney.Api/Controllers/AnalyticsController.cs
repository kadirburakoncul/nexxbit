using CriptoMoney.Application.Features.Analytics.Queries.GetAnalytics;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace CriptoMoney.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AnalyticsController(IMediator mediator) : ControllerBase
{
    private Guid CurrentUserId => Guid.Parse(
        User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);

    [HttpGet]
    public async Task<IActionResult> GetAnalytics(
        [FromQuery] bool virtualOnly = false,
        CancellationToken ct = default)
    {
        var result = await mediator.Send(new GetAnalyticsQuery(CurrentUserId, virtualOnly), ct);
        return result.Succeeded ? Ok(result.Data) : BadRequest(result);
    }
}
