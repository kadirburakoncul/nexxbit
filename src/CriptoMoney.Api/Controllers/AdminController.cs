using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Features.Admin.Commands.SetUserRole;
using CriptoMoney.Application.Features.Admin.Commands.SoftDeleteUser;
using CriptoMoney.Application.Features.Admin.Commands.UpdateUserCredentials;
using CriptoMoney.Application.Features.Admin.Queries.GetDashboard;
using CriptoMoney.Application.Features.Admin.Queries.GetUsers;
using CriptoMoney.Domain.Entities;
using CriptoMoney.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace CriptoMoney.API.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize(Roles = "Admin")]
public class AdminController(IMediator mediator, IApplicationDbContext db) : ControllerBase
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

    // ─── Sistem Ayarları ─────────────────────────────────────────────────────

    [HttpGet("settings")]
    public async Task<IActionResult> GetSettings(CancellationToken ct)
    {
        var config = await db.SystemConfigs.FirstOrDefaultAsync(ct);
        return Ok(new { requireLoginOtp = config?.RequireLoginOtp ?? false });
    }

    [HttpPut("settings/email-verification")]
    public async Task<IActionResult> SetEmailVerification([FromBody] SetEmailVerificationRequest req, CancellationToken ct)
    {
        var config = await db.SystemConfigs.FirstOrDefaultAsync(ct);
        if (config is null)
        {
            config = new SystemConfig { Id = 1, RequireLoginOtp = req.Required };
            db.SystemConfigs.Add(config);
        }
        else
        {
            config.RequireLoginOtp = req.Required;
        }
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPut("users/{userId:guid}/email-bypass")]
    public async Task<IActionResult> SetEmailBypass(Guid userId, [FromBody] SetEmailBypassRequest req, CancellationToken ct)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null)
            return NotFound(new { errors = new[] { "Kullanıcı bulunamadı." } });

        user.SkipLoginOtp = req.Bypassed;
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ─── İndikatör Yönetimi (Admin) ──────────────────────────────────────────

    [HttpPut("indicators/{indicatorId:int}")]
    public async Task<IActionResult> UpdateIndicator(int indicatorId, [FromBody] AdminUpdateIndicatorRequest req, CancellationToken ct)
    {
        var indicator = await db.Indicators
            .Include(i => i.ParameterDefinitions)
            .FirstOrDefaultAsync(i => i.Id == indicatorId, ct);
        if (indicator is null)
            return NotFound(new { errors = new[] { "İndikatör bulunamadı." } });

        if (req.DisplayName is not null) indicator.DisplayName = req.DisplayName;
        if (req.Description is not null) indicator.Description = req.Description;
        if (req.HowItWorks is not null) indicator.HowItWorks = req.HowItWorks;

        if (req.DefaultParameters is not null)
        {
            foreach (var p in req.DefaultParameters)
            {
                var def = indicator.ParameterDefinitions.FirstOrDefault(d => d.Id == p.DefinitionId);
                if (def is not null) def.DefaultValue = p.Value;
            }
        }

        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ─── Abonelik Yönetimi ────────────────────────────────────────────────────

    [HttpGet("users/{userId:guid}/indicator-subscriptions")]
    public async Task<IActionResult> GetUserSubscriptions(Guid userId, CancellationToken ct)
    {
        var indicators = await db.Indicators.Where(i => i.IsActive).OrderBy(i => i.DisplayName).ToListAsync(ct);
        var subs = await db.UserIndicatorSubscriptions.Where(s => s.UserId == userId).ToListAsync(ct);
        var subMap = subs.ToDictionary(s => s.IndicatorId);

        var result = indicators.Select(ind =>
        {
            var sub = subMap.GetValueOrDefault(ind.Id);
            return new
            {
                indicatorId = ind.Id,
                displayName = ind.DisplayName,
                hasSubscription = sub != null,
                isActive = sub?.IsActive ?? false,
                expiresAt = sub?.ExpiresAt,
            };
        });

        return Ok(result);
    }

    [HttpPut("users/{userId:guid}/indicator-subscriptions/{indicatorId:int}")]
    public async Task<IActionResult> SetUserSubscription(
        Guid userId, int indicatorId, [FromBody] SetSubscriptionRequest req, CancellationToken ct)
    {
        var sub = await db.UserIndicatorSubscriptions
            .FirstOrDefaultAsync(s => s.UserId == userId && s.IndicatorId == indicatorId, ct);

        if (req.Remove)
        {
            if (sub is not null) db.UserIndicatorSubscriptions.Remove(sub);
        }
        else
        {
            if (sub is null)
            {
                sub = new Domain.Entities.UserIndicatorSubscription
                {
                    UserId = userId,
                    IndicatorId = indicatorId,
                    IsActive = req.IsActive,
                    ExpiresAt = req.ExpiresAt,
                };
                db.UserIndicatorSubscriptions.Add(sub);
            }
            else
            {
                sub.IsActive = req.IsActive;
                sub.ExpiresAt = req.ExpiresAt;
            }
        }

        await db.SaveChangesAsync(ct);
        return NoContent();
    }
}

public record SetRoleRequest(UserRole Role);
public record UpdateCredentialsRequest(string? NewEmail, string? NewPassword);
public record SetEmailVerificationRequest(bool Required);
public record SetEmailBypassRequest(bool Bypassed);
public record AdminUpdateIndicatorRequest(string? DisplayName, string? Description, string? HowItWorks, List<AdminParamUpdate>? DefaultParameters);
public record AdminParamUpdate(int DefinitionId, string Value);
public record SetSubscriptionRequest(bool IsActive, DateTime? ExpiresAt, bool Remove = false);
