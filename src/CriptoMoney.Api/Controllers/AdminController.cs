using CriptoMoney.Application.Features.Admin.Commands.SetUserRole;
using CriptoMoney.Application.Features.Admin.Commands.SoftDeleteUser;
using CriptoMoney.Application.Features.Admin.Commands.UpdateUserCredentials;
using CriptoMoney.Application.Features.Admin.Queries.GetDashboard;
using CriptoMoney.Application.Features.Admin.Queries.GetUsers;
using CriptoMoney.Application.Features.Balance.Queries.GetBalanceHistory;
using CriptoMoney.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace CriptoMoney.API.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize(Roles = "Admin")]
public class AdminController(IMediator mediator) : ControllerBase
{
    private Guid CurrentUserId => Guid.Parse(
        User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);

    [HttpGet("dashboard")]
    public async Task<IActionResult> Dashboard(CancellationToken ct)
    {
        var result = await mediator.Send(new GetDashboardQuery(), ct);
        return result.Succeeded ? Ok(result.Data) : BadRequest(result);
    }

    [HttpGet("users")]
    public async Task<IActionResult> GetUsers(
        [FromQuery] string? search,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var result = await mediator.Send(new GetUsersQuery(search, pageNumber, pageSize), ct);
        return result.Succeeded ? Ok(result.Data) : BadRequest(result);
    }

    [HttpPut("users/{userId:guid}/role")]
    public async Task<IActionResult> SetRole(Guid userId, [FromBody] SetRoleRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new SetUserRoleCommand(userId, req.Role), ct);
        return result.Succeeded ? NoContent() : BadRequest(result);
    }

    [HttpDelete("users/{userId:guid}")]
    public async Task<IActionResult> DeleteUser(Guid userId, CancellationToken ct)
    {
        if (userId == CurrentUserId)
            return BadRequest(new { errors = new[] { "Kendi hesabınızı silemezsiniz." } });

        var result = await mediator.Send(new SoftDeleteUserCommand(userId), ct);
        return result.Succeeded ? NoContent() : BadRequest(result);
    }

    [HttpPost("users/{userId:guid}/restore")]
    public async Task<IActionResult> RestoreUser(Guid userId, CancellationToken ct)
    {
        var result = await mediator.Send(new SoftDeleteUserCommand(userId, Restore: true), ct);
        return result.Succeeded ? NoContent() : BadRequest(result);
    }

    [HttpPut("users/{userId:guid}/credentials")]
    public async Task<IActionResult> UpdateCredentials(Guid userId, [FromBody] UpdateCredentialsRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.NewEmail) && string.IsNullOrWhiteSpace(req.NewPassword))
            return BadRequest(new { errors = new[] { "E-posta veya şifre girilmelidir." } });

        var result = await mediator.Send(new UpdateUserCredentialsCommand(userId, req.NewEmail, req.NewPassword), ct);
        return result.Succeeded ? NoContent() : BadRequest(result);
    }
}

public record SetRoleRequest(UserRole Role);
public record UpdateCredentialsRequest(string? NewEmail, string? NewPassword);
