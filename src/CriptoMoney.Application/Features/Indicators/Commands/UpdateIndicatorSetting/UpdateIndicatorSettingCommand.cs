using CriptoMoney.Application.Common.Models;
using MediatR;

namespace CriptoMoney.Application.Features.Indicators.Commands.UpdateIndicatorSetting;

public record UpdateIndicatorSettingCommand(
    Guid UserId,
    int IndicatorId,
    int? CoinId,
    bool IsEnabled,
    decimal Weight,
    List<ParameterUpdate> Parameters
) : IRequest<Result>;

public record ParameterUpdate(int DefinitionId, string Value);
