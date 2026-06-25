using CriptoMoney.Application.Features.Notifications.Commands.MarkAsRead;
using CriptoMoney.Application.Features.Notifications.Queries.GetNotifications;
using CriptoMoney.Application.Common.Interfaces;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace CriptoMoney.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class NotificationController(IMediator mediator, IApplicationDbContext db) : ControllerBase
{
    private Guid CurrentUserId => Guid.Parse(
        User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);

    [HttpGet]
    public async Task<IActionResult> Get(
        [FromQuery] bool? unreadOnly,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 30,
        CancellationToken ct = default)
    {
        var result = await mediator.Send(
            new GetNotificationsQuery(CurrentUserId, unreadOnly, pageNumber, pageSize), ct);
        return result.Succeeded ? Ok(result.Data) : BadRequest(result);
    }

    [HttpPut("{id:guid}/read")]
    public async Task<IActionResult> MarkRead(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new MarkAsReadCommand(CurrentUserId, id), ct);
        return result.Succeeded ? NoContent() : BadRequest(result);
    }

    [HttpPut("read-all")]
    public async Task<IActionResult> MarkAllRead(CancellationToken ct)
    {
        var result = await mediator.Send(new MarkAsReadCommand(CurrentUserId, null), ct);
        return result.Succeeded ? NoContent() : BadRequest(result);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var notification = await db.Notifications
            .FirstOrDefaultAsync(n => n.Id == id && n.UserId == CurrentUserId, ct);
        if (notification is null) return NotFound();
        db.Notifications.Remove(notification);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpDelete]
    public async Task<IActionResult> DeleteAll(CancellationToken ct)
    {
        var notifications = await db.Notifications
            .Where(n => n.UserId == CurrentUserId)
            .ToListAsync(ct);
        db.Notifications.RemoveRange(notifications);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }
}
