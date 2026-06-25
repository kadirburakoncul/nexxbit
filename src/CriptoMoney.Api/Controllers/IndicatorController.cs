using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Features.Indicators.Commands.UpdateIndicatorSetting;
using CriptoMoney.Application.Features.Indicators.Queries.GetIndicators;
using CriptoMoney.Domain.Entities;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace CriptoMoney.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class IndicatorController(IMediator mediator, IApplicationDbContext db) : ControllerBase
{
    private Guid CurrentUserId => Guid.Parse(
        User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);

    [HttpGet]
    public async Task<IActionResult> GetIndicators([FromQuery] int? coinId, CancellationToken ct)
    {
        var result = await mediator.Send(new GetIndicatorsQuery(CurrentUserId, coinId), ct);
        return result.Succeeded ? Ok(result.Data) : BadRequest(result);
    }

    [HttpPatch("{indicatorId:int}/toggle")]
    public async Task<IActionResult> ToggleIndicator(int indicatorId, CancellationToken ct)
    {
        var setting = await db.UserIndicatorSettings
            .FirstOrDefaultAsync(s => s.UserId == CurrentUserId && s.IndicatorId == indicatorId && s.CoinId == null, ct);

        bool currentlyEnabled = setting?.IsEnabled ?? true;

        // Pasife çekilmek isteniyorsa aktif strateji kontrolü
        if (currentlyEnabled)
        {
            var activeStrategyNames = await db.UserStrategies
                .Where(s => s.UserId == CurrentUserId && s.IndicatorId == indicatorId && s.IsActive)
                .Select(s => s.Name)
                .ToListAsync(ct);

            if (activeStrategyNames.Count > 0)
                return Conflict(new
                {
                    errors = new[] { $"Bu indikatör şu aktif stratejilerde kullanılıyor: {string.Join(", ", activeStrategyNames)}. Önce stratejiyi durdurun." }
                });
        }

        if (setting is null)
        {
            setting = new UserIndicatorSetting
            {
                UserId = CurrentUserId,
                IndicatorId = indicatorId,
                IsEnabled = false,
                Weight = 1.0m,
            };
            db.UserIndicatorSettings.Add(setting);
        }
        else
        {
            setting.IsEnabled = !setting.IsEnabled;
        }

        await db.SaveChangesAsync(ct);
        return Ok(new { isEnabled = setting.IsEnabled });
    }

    [HttpPut("{indicatorId:int}")]
    public async Task<IActionResult> UpdateIndicator(
        int indicatorId,
        [FromBody] UpdateIndicatorRequest req,
        CancellationToken ct)
    {
        var result = await mediator.Send(new UpdateIndicatorSettingCommand(
            CurrentUserId,
            indicatorId,
            req.CoinId,
            req.IsEnabled,
            req.Weight,
            req.Parameters.Select(p => new ParameterUpdate(p.DefinitionId, p.Value)).ToList()
        ), ct);

        return result.Succeeded ? NoContent() : BadRequest(result);
    }
}

public record UpdateIndicatorRequest(
    int? CoinId,
    bool IsEnabled,
    decimal Weight,
    List<ParameterUpdateRequest> Parameters
);

public record ParameterUpdateRequest(int DefinitionId, string Value);
