using CriptoMoney.Application.Common.Models;
using CriptoMoney.Domain.Enums;
using MediatR;

namespace CriptoMoney.Application.Features.Strategy.Queries.GetStrategies;

public record GetStrategiesQuery(Guid UserId) : IRequest<Result<List<StrategyDto>>>;

public record StrategyDto(
    Guid Id,
    string Name,
    int? IndicatorId,
    string? IndicatorDisplayName,
    string Timeframe,
    decimal TrailingStopPct,
    decimal StopLossPct,
    decimal? TakeProfitPct,
    decimal? MinVolumeUsdt,
    decimal? VolatilePositionSizePct,
    decimal VolatileMinChangePct,
    int VolatileGainerLimit,
    bool IsRsiFilterEnabled,
    int MomentumFreshFilterMinutes,
    // ATR tabanlı stop
    bool UseAtrBasedStops,
    int AtrPeriod,
    decimal AtrSlMultiplier,
    decimal AtrTpMultiplier,
    // Partial TP
    decimal? PartialTpPct,
    decimal PartialTpClosePct,
    // Volume surge
    bool IsVolumeSurgeFilterEnabled,
    decimal VolumeSurgeMultiplier,
    // Market regime
    bool UseMarketRegimeFilter,
    bool IsActive,
    bool IsRealTradeEnabled,
    bool IsVolatileMode,
    DateTime? ActivatedAt,
    List<StrategyCoinDto> Coins
);

public record StrategyCoinDto(
    int CoinId,
    string Symbol,
    string DisplayName,
    ReEntryState ReEntryState
);
