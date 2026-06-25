using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using CriptoMoney.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CriptoMoney.Application.Features.Indicators.Commands.UpdateIndicatorSetting;

public class UpdateIndicatorSettingCommandHandler(IApplicationDbContext db)
    : IRequestHandler<UpdateIndicatorSettingCommand, Result>
{
    public async Task<Result> Handle(UpdateIndicatorSettingCommand request, CancellationToken cancellationToken)
    {
        var setting = await db.UserIndicatorSettings
            .Include(s => s.ParameterValues)
            .FirstOrDefaultAsync(s =>
                s.UserId == request.UserId
                && s.IndicatorId == request.IndicatorId
                && s.CoinId == request.CoinId,
                cancellationToken);

        if (setting is null)
        {
            setting = new UserIndicatorSetting
            {
                UserId = request.UserId,
                IndicatorId = request.IndicatorId,
                CoinId = request.CoinId,
                IsEnabled = request.IsEnabled,
                Weight = request.Weight,
            };
            db.UserIndicatorSettings.Add(setting);
        }
        else
        {
            setting.IsEnabled = request.IsEnabled;
            setting.Weight = request.Weight;
            db.UserIndicatorSettings.Update(setting);
        }

        // Parametre değerlerini güncelle (upsert)
        foreach (var param in request.Parameters)
        {
            var existing = setting.ParameterValues
                .FirstOrDefault(pv => pv.ParameterDefinitionId == param.DefinitionId);

            if (existing is null)
            {
                setting.ParameterValues.Add(new UserIndicatorParameterValue
                {
                    UserIndicatorSettingId = setting.Id,
                    ParameterDefinitionId = param.DefinitionId,
                    Value = param.Value,
                });
            }
            else
            {
                existing.Value = param.Value;
            }
        }

        await db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}
