using CriptoMoney.Domain.Entities;

namespace CriptoMoney.Application.Common.Interfaces;

public record SignalIndicatorResult(
    string Name,
    string DisplayName,
    decimal Score,
    bool Passed,
    string Details
);

public record SignalAnalysisResult(
    string Symbol,
    string Timeframe,
    string Verdict,
    string Reason,
    decimal? Score,
    decimal? BuyThreshold,
    decimal? SellThreshold,
    bool Ema200RuleEnabled,
    string? Ema200RuleResult,
    List<SignalIndicatorResult> Indicators
);

public record T3ChartCandleDto(long Time, decimal Open, decimal High, decimal Low, decimal Close, decimal Volume);
public record T3ChartValueDto(long Time, decimal Value);
public record T3ChartMarkerDto(long Time, string Side, decimal Price);

public record T3ChartResult(
    List<T3ChartCandleDto> Candles,
    List<T3ChartValueDto> T3,
    List<T3ChartMarkerDto> Signals,
    bool CurrentT3Up,
    bool T3TurnUp,
    bool T3TurnDown,
    decimal CurrentT3,
    decimal CurrentPrice
);

public interface ISignalEngine
{
    Task<TradeSignal?> GenerateSignalAsync(
        Guid userId,
        int coinId,
        string symbol,
        string timeframe,
        CancellationToken ct = default);

    Task<SignalAnalysisResult> AnalyzeAsync(
        Guid userId,
        int coinId,
        string symbol,
        string timeframe,
        CancellationToken ct = default);

    Task<T3ChartResult?> GetT3ChartAsync(
        Guid userId,
        int coinId,
        string symbol,
        string timeframe,
        int limit = 200,
        CancellationToken ct = default);
}
