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
    decimal TrailingStopPct = 2.5m,
    decimal StopLossPct = 3.0m,
    bool IsVolatileMode = false,
    decimal? TakeProfitPct = null,
    decimal? MinVolumeUsdt = null,
    decimal? VolatilePositionSizePct = null,
    decimal VolatileMinChangePct = 5.0m,
    int VolatileGainerLimit = 20,
    bool IsRsiFilterEnabled = false,
    int MomentumFreshFilterMinutes = 5,
    // ATR
    bool UseAtrBasedStops = false,
    int AtrPeriod = 14,
    decimal AtrSlMultiplier = 1.5m,
    decimal AtrTpMultiplier = 3.0m,
    // Partial TP
    decimal? PartialTpPct = 2.0m,
    decimal PartialTpClosePct = 50m,
    // Volume surge
    bool IsVolumeSurgeFilterEnabled = true,
    decimal VolumeSurgeMultiplier = 2.0m,
    // Market regime
    bool UseMarketRegimeFilter = true,
    // EMA200 filtresi
    bool IsEma200RuleEnabled = true,
    // Koruma ayarları
    int MaxHoldHours = 8,
    int SlCooldownHours = 4,
    bool IsGreenCandleFilterEnabled = true,
    // Pozisyon limitleri
    int MaxOpenPositions = 5,
    decimal? MaxPositionSizeUsdt = null,
    decimal? MaxPositionSizePct = null,
    decimal MinPositionSizeUsdt = 10m,
    // ADX filtresi
    bool UseAdxFilter = false,
    int AdxPeriod = 14,
    decimal AdxMinValue = 25m,
    // MACD filtresi
    bool UseMacdFilter = false,
    // Breakeven stop
    bool UseBreakevenStop = false,
    decimal BreakevenTriggerPct = 1.5m,
    decimal TrailingActivationPct = 1.0m
) : IRequest<Result<Guid>>;
