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
    bool IsRsiFilterEnabled = true,
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
    int MaxHoldHours = 24,
    int SlCooldownHours = 4,
    bool IsGreenCandleFilterEnabled = true,
    // Pozisyon limitleri
    int MaxOpenPositions = 3,
    decimal? MaxPositionSizeUsdt = null,
    decimal? MaxPositionSizePct = null,
    decimal MinPositionSizeUsdt = 10m,
    // ADX filtresi
    bool UseAdxFilter = true,
    int AdxPeriod = 14,
    decimal AdxMinValue = 25m,
    // MACD filtresi
    bool UseMacdFilter = true,
    // Breakeven stop
    bool UseBreakevenStop = true,
    decimal BreakevenTriggerPct = 1.5m,
    decimal TrailingActivationPct = 1.0m,
    decimal RsiMaxValue = 75m,
    bool UseHigherTfConfirm = true,
    string HigherTimeframe = "1h",
    bool UseRiskBasedSizing = false,
    decimal RiskPerTradePct = 1.0m,
    int MaxConsecutiveLosses = 5,
    decimal PauseOnDrawdownPct = 15m
) : IRequest<Result<Guid>>;
