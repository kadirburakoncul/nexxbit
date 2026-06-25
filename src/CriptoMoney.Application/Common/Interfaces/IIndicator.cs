namespace CriptoMoney.Application.Common.Interfaces;

public record CandleInput(
    DateTime OpenTime,
    decimal Open,
    decimal High,
    decimal Low,
    decimal Close,
    decimal Volume);

public record IndicatorResult(
    string IndicatorName,
    decimal Score,           // -3..+3 arası normalize edilmiş skor
    decimal RawValue,        // hesaplanan ham değer (EMA değeri, T3 değeri vb.)
    string Signal,           // "BUY" | "SELL" | "HOLD"
    Dictionary<string, decimal> Extra); // ek debug bilgisi

public interface IIndicator
{
    string Name { get; }
    int MinCandlesRequired { get; }

    IndicatorResult Calculate(
        IReadOnlyList<CandleInput> candles,
        Dictionary<string, string> parameters);
}
