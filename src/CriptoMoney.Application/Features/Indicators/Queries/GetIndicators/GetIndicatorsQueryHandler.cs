using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CriptoMoney.Application.Features.Indicators.Queries.GetIndicators;

public class GetIndicatorsQueryHandler(IApplicationDbContext db)
    : IRequestHandler<GetIndicatorsQuery, Result<List<IndicatorSettingDto>>>
{
    public async Task<Result<List<IndicatorSettingDto>>> Handle(
        GetIndicatorsQuery request, CancellationToken cancellationToken)
    {
        // Mevcut tüm indikatörleri yükle
        var indicators = await db.Indicators
            .Include(i => i.ParameterDefinitions.OrderBy(p => p.SortOrder))
            .Where(i => i.IsActive)
            .ToListAsync(cancellationToken);

        // Kullanıcının mevcut ayarlarını yükle
        var userSettings = await db.UserIndicatorSettings
            .Include(s => s.ParameterValues)
                .ThenInclude(v => v.ParameterDefinition)
            .Where(s => s.UserId == request.UserId
                && (s.CoinId == request.CoinId || s.CoinId == null))
            .ToListAsync(cancellationToken);

        // Kullanıcının aboneliklerini yükle
        var subscriptions = await db.UserIndicatorSubscriptions
            .Where(s => s.UserId == request.UserId)
            .ToListAsync(cancellationToken);

        var settingsMap = userSettings.ToDictionary(s => s.IndicatorId);
        var subscriptionMap = subscriptions.ToDictionary(s => s.IndicatorId);

        var result = indicators.Select(indicator =>
        {
            var setting = settingsMap.GetValueOrDefault(indicator.Id);
            var subscription = subscriptionMap.GetValueOrDefault(indicator.Id);
            var paramValues = setting?.ParameterValues.ToDictionary(pv => pv.ParameterDefinitionId)
                              ?? new Dictionary<int, Domain.Entities.UserIndicatorParameterValue>();

            var parameters = indicator.ParameterDefinitions.Select(def => new ParameterValueDto(
                def.Id,
                def.ParameterKey,
                def.DisplayName,
                def.DataType,
                paramValues.TryGetValue(def.Id, out var pv) ? pv.Value : def.DefaultValue,
                def.DefaultValue,
                def.MinValue,
                def.MaxValue
            )).ToList();

            return new IndicatorSettingDto(
                indicator.Id,
                indicator.Name,
                indicator.DisplayName,
                indicator.Description ?? string.Empty,
                indicator.HowItWorks,
                indicator.Category,
                setting?.IsEnabled ?? true,
                setting?.Weight ?? indicator.DefaultWeight,
                parameters,
                subscription != null,
                subscription?.IsActive ?? false,
                subscription?.ExpiresAt
            );
        }).ToList();

        return Result<List<IndicatorSettingDto>>.Success(result);
    }
}
