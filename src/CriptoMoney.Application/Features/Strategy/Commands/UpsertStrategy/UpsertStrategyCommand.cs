using CriptoMoney.Application.Common.Models;
using MediatR;

namespace CriptoMoney.Application.Features.Strategy.Commands.UpsertStrategy;

public record UpsertStrategyCommand(
    Guid UserId,
    Guid? StrategyId,
    string Name,
    int? IndicatorId,
    List<int> CoinIds,
    string Timeframe,
    decimal TrailingStopPct,
    decimal StopLossPct,
    bool IsVolatileMode,
    decimal? TakeProfitPct,
    decimal? MinVolumeUsdt,
    decimal? VolatilePositionSizePct,
    decimal VolatileMinChangePct = 3.0m,
    int VolatileGainerLimit = 20,
    bool IsRsiFilterEnabled = false,
    int MomentumFreshFilterMinutes = 5,
    // ATR
    bool UseAtrBasedStops = false,
    int AtrPeriod = 14,
    decimal AtrSlMultiplier = 1.5m,
    decimal AtrTpMultiplier = 3.0m,
    // Partial TP
    decimal? PartialTpPct = null,
    decimal PartialTpClosePct = 50m,
    // Volume surge
    bool IsVolumeSurgeFilterEnabled = false,
    decimal VolumeSurgeMultiplier = 1.5m,
    // Market regime
    bool UseMarketRegimeFilter = false
) : IRequest<Result<Guid>>;
