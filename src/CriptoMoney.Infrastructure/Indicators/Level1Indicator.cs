using CriptoMoney.Application.Common.Interfaces;

namespace CriptoMoney.Infrastructure.Indicators;

/// <summary>
/// Level 1 — Mum kapanışında T3 yön dönüşü bazlı sinyal.
/// Kaynak: (High + Low + 2*Close) / 4 (HLCC/4)
/// T3 yukarı döndüğünde: skor +1.0 (AL), aşağı döndüğünde: skor -1.0 (SAT).
/// Yön değişmiyorsa devam eden trend skoru döner (±0.5).
/// </summary>
public class Level1Indicator : IIndicator
{
    public string Name => "Level1";
    public int MinCandlesRequired => 50;

    public IndicatorResult Calculate(
        IReadOnlyList<CandleInput> candles,
        Dictionary<string, string> parameters)
    {
        var period = parameters.TryGetValue("Period", out var p) ? int.Parse(p) : 5;
        var factor = parameters.TryGetValue("Factor", out var f)
            ? decimal.Parse(f, System.Globalization.CultureInfo.InvariantCulture) : 0.7m;
        period = Math.Clamp(period, 2, 50);
        factor = Math.Clamp(factor, 0.1m, 1.0m);

        if (candles.Count < period * 6 + 4)
            return Neutral();

        // HLCC/4 kaynak
        var src = candles.Select(c => (c.High + c.Low + 2m * c.Close) / 4m).ToArray();
        var t3 = TillsonIndicator.ComputeT3(src, period, factor);

        // Son kapanmış mum: [^2] — [^1] henüz kapanmamış (açık mum)
        var t3UpCurr = t3[^2] > t3[^3];
        var t3UpPrev = t3[^3] > t3[^4];

        var turnUp   = t3UpCurr && !t3UpPrev;
        var turnDown = !t3UpCurr && t3UpPrev;

        decimal score = turnUp   ? 1.0m
                      : turnDown ? -1.0m
                      : t3UpCurr ? 0.5m
                      : -0.5m;

        var signal = turnUp ? "BUY" : turnDown ? "SELL" : t3UpCurr ? "HOLD_UP" : "HOLD_DOWN";

        return new IndicatorResult(
            Name,
            score,
            Math.Round(t3[^2], 8),
            signal,
            new Dictionary<string, decimal>
            {
                ["t3"]        = Math.Round(t3[^2], 8),
                ["turnUp"]    = turnUp ? 1 : 0,
                ["turnDown"]  = turnDown ? 1 : 0,
                ["direction"] = t3UpCurr ? 1 : -1,
            });
    }

    private static IndicatorResult Neutral() =>
        new("Level1", 0, 0, "HOLD", new Dictionary<string, decimal>());
}
