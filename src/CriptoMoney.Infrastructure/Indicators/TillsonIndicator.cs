using CriptoMoney.Application.Common.Interfaces;

namespace CriptoMoney.Infrastructure.Indicators;

/// <summary>
/// Tillson T3 yumuşatılmış hareketli ortalama.
/// T3 = c1*e6 + c2*e5 + c3*e4 + c4*e3
/// burada e1..e6 ardışık EMA katmanları, c1..c4 Tillson katsayıları.
/// </summary>
public class TillsonIndicator : IIndicator
{
    public string Name => "Tillson";
    public int MinCandlesRequired => 100;

    public IndicatorResult Calculate(
        IReadOnlyList<CandleInput> candles,
        Dictionary<string, string> parameters)
    {
        var period = parameters.TryGetValue("Period", out var p) ? int.Parse(p) : 5;
        var factor = parameters.TryGetValue("Factor", out var f) ? decimal.Parse(f, System.Globalization.CultureInfo.InvariantCulture) : 0.7m;
        period = Math.Clamp(period, 3, 50);
        factor = Math.Clamp(factor, 0.1m, 1.0m);

        var needed = period * 6 + 1;
        if (candles.Count < needed)
            return Neutral();

        var closes = candles.Select(c => c.Close).ToArray();
        var t3 = ComputeT3(closes, period, factor);

        var current = t3[^1];
        var prev = t3[^2];
        var currentClose = closes[^1];

        var deviation = (currentClose - current) / current * 100m;
        var rawScore = Math.Clamp(deviation / 0.667m, -3m, 3m);

        var crossedUp = closes[^2] < t3[^2] && currentClose > current;
        var crossedDown = closes[^2] > t3[^2] && currentClose < current;

        var signal = rawScore >= 1m ? "BUY" : rawScore <= -1m ? "SELL" : "HOLD";
        if (crossedUp) signal = "BUY";
        if (crossedDown) signal = "SELL";

        return new IndicatorResult(
            Name,
            Math.Round(rawScore, 2),
            Math.Round(current, 8),
            signal,
            new Dictionary<string, decimal>
            {
                ["t3"] = Math.Round(current, 8),
                ["deviationPct"] = Math.Round(deviation, 4),
                ["trend"] = current > prev ? 1 : -1,
            });
    }

    public static decimal[] ComputeT3(decimal[] closes, int period, decimal factor)
    {
        var k = 2m / (period + 1);
        var f2 = factor * factor;
        var c1 = -(f2 * factor);
        var c2 = 3m * f2 + 3m * f2 * factor;
        var c3 = -6m * f2 - 3m * factor - 3m * f2 * factor;
        var c4 = 1m + 3m * factor + f2 + 3m * f2 * factor;

        var n = closes.Length;
        var e1 = new decimal[n];
        var e2 = new decimal[n];
        var e3 = new decimal[n];
        var e4 = new decimal[n];
        var e5 = new decimal[n];
        var e6 = new decimal[n];
        var t3 = new decimal[n];

        // Başlangıç değerleri olarak ilk `period` kapanışın ortalaması kullanılır
        var seed = closes.Take(period).Average();
        e1[0] = e2[0] = e3[0] = e4[0] = e5[0] = e6[0] = seed;
        t3[0] = c1 * e6[0] + c2 * e5[0] + c3 * e4[0] + c4 * e3[0];

        for (var i = 1; i < n; i++)
        {
            e1[i] = e1[i - 1] + k * (closes[i] - e1[i - 1]);
            e2[i] = e2[i - 1] + k * (e1[i] - e2[i - 1]);
            e3[i] = e3[i - 1] + k * (e2[i] - e3[i - 1]);
            e4[i] = e4[i - 1] + k * (e3[i] - e4[i - 1]);
            e5[i] = e5[i - 1] + k * (e4[i] - e5[i - 1]);
            e6[i] = e6[i - 1] + k * (e5[i] - e6[i - 1]);
            t3[i] = c1 * e6[i] + c2 * e5[i] + c3 * e4[i] + c4 * e3[i];
        }

        return t3;
    }

    private static IndicatorResult Neutral() =>
        new("Tillson", 0, 0, "HOLD", new Dictionary<string, decimal>());
}
