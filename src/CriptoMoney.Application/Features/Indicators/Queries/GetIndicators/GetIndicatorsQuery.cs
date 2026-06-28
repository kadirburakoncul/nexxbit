using CriptoMoney.Application.Common.Models;
using MediatR;

namespace CriptoMoney.Application.Features.Indicators.Queries.GetIndicators;

public record GetIndicatorsQuery(Guid UserId, int? CoinId = null) : IRequest<Result<List<IndicatorSettingDto>>>;

public record IndicatorSettingDto(
    int IndicatorId,
    string Name,
    string DisplayName,
    string Description,
    string? HowItWorks,
    string Category,
    bool IsEnabled,
    decimal Weight,
    List<ParameterValueDto> Parameters,
    bool HasSubscription,
    bool SubscriptionIsActive,
    DateTime? SubscriptionExpiresAt
);

public record ParameterValueDto(
    int DefinitionId,
    string ParameterKey,
    string DisplayName,
    string DataType,
    string Value,
    string DefaultValue,
    string? MinValue,
    string? MaxValue
);
