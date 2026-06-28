using CriptoMoney.Application.Common.Interfaces;

namespace CriptoMoney.Infrastructure.Indicators;

/// <summary>
/// RSI (Relative Strength Index) — Wilder smoothing.
/// Score: pozitif = al bölgesi (RSI>50), negatif = sat bölgesi (RSI<50).
/// T3+RSI kombine kullanımda: T3 yön dönüşü + RSI > 50 → AL sinyali.
/// </summary>
public class RsiIndicator : IIndicator
{
    public string Name => "RSI";
    public int MinCandlesRequired => 50;

    public IndicatorResult Calculate(
        IReadOnlyList<CandleInput> candles,
        Dictionary<string, string> parameters)
    {
        var period = parameters.TryGetValue("Period", out var p) ? int.Parse(p) : 14;
        period = Math.Clamp(period, 2, 50);

        if (candles.Count < period + 1)
            return new IndicatorResult(Name, 0, 0, "HOLD", []);

        var rsi = ComputeRsi(candles.Select(c => c.Close).ToArray(), period);
        var current = rsi[^1];

        // Normalize [-3, 3]: RSI=50 → score=0, RSI=70 → score≈3, RSI=30 → score≈-3
        var score = Math.Clamp((current - 50m) / 6.667m, -3m, 3m);
        var signal = current >= 60 ? "BUY" : current <= 40 ? "SELL" : "HOLD";

        return new IndicatorResult(
            Name,
            Math.Round(score, 3),
            Math.Round(current, 2),
            signal,
            new Dictionary<string, decimal>
            {
                ["rsi"] = Math.Round(current, 2),
                ["overbought"] = current >= 70 ? 1 : 0,
                ["oversold"]   = current <= 30 ? 1 : 0,
            });
    }

    public static decimal[] ComputeRsi(decimal[] closes, int period)
    {
        var n = closes.Length;
        var rsi = new decimal[n];

        var avgGain = 0m;
        var avgLoss = 0m;

        for (var i = 1; i <= period; i++)
        {
            var diff = closes[i] - closes[i - 1];
            if (diff > 0) avgGain += diff;
            else          avgLoss -= diff;
        }

        avgGain /= period;
        avgLoss /= period;

        rsi[period] = avgLoss == 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

        for (var i = period + 1; i < n; i++)
        {
            var diff = closes[i] - closes[i - 1];
            var gain = diff > 0 ? diff : 0;
            var loss = diff < 0 ? -diff : 0;

            avgGain = (avgGain * (period - 1) + gain) / period;
            avgLoss = (avgLoss * (period - 1) + loss) / period;

            rsi[i] = avgLoss == 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
        }

        return rsi;
    }
}
