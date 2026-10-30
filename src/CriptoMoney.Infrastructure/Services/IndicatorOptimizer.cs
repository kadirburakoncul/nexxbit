using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Infrastructure.Indicators;

namespace CriptoMoney.Infrastructure.Services;

/// <summary>Tek bir parametre kombinasyonunun sonucu.</summary>
public record OptimizationCandidate(
    string Family,
    Dictionary<string, decimal> Parameters,
    string ParamsLabel,
    decimal ReturnPct,
    decimal BuyHoldPct,
    decimal EdgePct,
    decimal WinRate,
    int TradeCount,
    decimal MaxDrawdownPct,
    decimal InSamplePct,
    decimal OutOfSamplePct,
    int SymbolsBeatingBuyHold,
    int SymbolCount);

public interface IIndicatorOptimizer
{
    IReadOnlyList<string> Families { get; }

    Task<List<OptimizationCandidate>> RunAsync(
        IReadOnlyDictionary<string, List<CandleInput>> dataBySymbol,
        string family,
        decimal commissionPct,
        IProgress<int>? progress = null,
        CancellationToken ct = default);
}

/// <summary>
/// Parametre ızgarasını tarayıp her kombinasyonu geçmiş veride dener.
///
/// NEDEN SADECE "EN YÜKSEK GETİRİ" YETERLİ DEĞİL:
/// Yeterince kombinasyon denenirse, tamamen rastgele bir kuralın bile geçmişte
/// iyi göründüğü bir ayar bulunur (aşırı uyum). Bu yüzden her kombinasyon
///   1) zaman olarak ikiye bölünüp ayrı ayrı ölçülür (walk-forward),
///   2) aynı dönemde coini alıp tutmakla karşılaştırılır (al-tut),
///   3) kaç coinde al-tut'u geçtiği sayılır.
/// Sıralama ham getiriye göre değil, al-tut'a göre ÜSTÜNLÜK (edge) üzerinden yapılır.
/// </summary>
public class IndicatorOptimizer : IIndicatorOptimizer
{
    public IReadOnlyList<string> Families { get; } = ["T3", "EMA", "RSI", "MACD", "ADX"];

    public async Task<List<OptimizationCandidate>> RunAsync(
        IReadOnlyDictionary<string, List<CandleInput>> dataBySymbol,
        string family,
        decimal commissionPct,
        IProgress<int>? progress = null,
        CancellationToken ct = default)
    {
        var grid = BuildGrid(family);
        var results = new List<OptimizationCandidate>(grid.Count);

        for (var g = 0; g < grid.Count; g++)
        {
            ct.ThrowIfCancellationRequested();
            var p = grid[g];

            var perSymbol = new List<(decimal strat, decimal hold, decimal wr, int trades, decimal dd, decimal isPct, decimal oosPct)>();

            foreach (var (symbol, candles) in dataBySymbol)
            {
                if (candles.Count < 250) continue;   // ısınma + anlamlı örneklem

                var r = Evaluate(candles, family, p, commissionPct);
                if (r is not null) perSymbol.Add(r.Value);
            }

            if (perSymbol.Count == 0) continue;

            var avgStrat = perSymbol.Average(x => x.strat);
            var avgHold  = perSymbol.Average(x => x.hold);
            var totalTrades = perSymbol.Sum(x => x.trades);

            // Hiç işlem açmayan ya da tek tük işlem açan kombinasyonlar
            // istatistiksel olarak anlamsızdır; listeye alınmaz.
            if (totalTrades < perSymbol.Count * 3) continue;

            results.Add(new OptimizationCandidate(
                family,
                p,
                Label(family, p),
                Math.Round(avgStrat, 2),
                Math.Round(avgHold, 2),
                Math.Round(avgStrat - avgHold, 2),
                Math.Round(perSymbol.Average(x => x.wr), 1),
                totalTrades,
                Math.Round(perSymbol.Average(x => x.dd), 2),
                Math.Round(perSymbol.Average(x => x.isPct), 2),
                Math.Round(perSymbol.Average(x => x.oosPct), 2),
                perSymbol.Count(x => x.strat > x.hold),
                perSymbol.Count));

            progress?.Report((int)((g + 1) * 100.0 / grid.Count));
            if (g % 8 == 0) await Task.Yield();
        }

        // Ham getiri değil, al-tut'a üstünlük sıralanır.
        return [.. results.OrderByDescending(r => r.EdgePct)];
    }

    // ─── Parametre ızgaraları ────────────────────────────────────────────────────

    private static List<Dictionary<string, decimal>> BuildGrid(string family)
    {
        var grid = new List<Dictionary<string, decimal>>();

        switch (family.ToUpperInvariant())
        {
            case "T3":
                foreach (var period in new[] { 3, 5, 8, 10, 13, 18 })
                foreach (var factor in new[] { 0.3m, 0.5m, 0.7m, 0.9m })
                foreach (var confirm in new[] { 1, 2, 3 })
                    grid.Add(new() { ["Period"] = period, ["Factor"] = factor, ["ConfirmBars"] = confirm });
                break;

            case "EMA":
                foreach (var fast in new[] { 5, 9, 12, 20, 26 })
                foreach (var slow in new[] { 21, 50, 100, 200 })
                    if (fast < slow)
                        grid.Add(new() { ["Fast"] = fast, ["Slow"] = slow });
                break;

            case "RSI":
                foreach (var period in new[] { 7, 14, 21 })
                foreach (var buy in new[] { 30m, 40m, 50m, 55m })
                foreach (var sell in new[] { 60m, 70m, 75m, 80m })
                    grid.Add(new() { ["Period"] = period, ["BuyLevel"] = buy, ["SellLevel"] = sell });
                break;

            case "MACD":
                foreach (var fast in new[] { 8, 12, 16 })
                foreach (var slow in new[] { 21, 26, 34 })
                foreach (var signal in new[] { 7, 9, 12 })
                    if (fast < slow)
                        grid.Add(new() { ["Fast"] = fast, ["Slow"] = slow, ["Signal"] = signal });
                break;

            case "ADX":
                foreach (var period in new[] { 10, 14, 20 })
                foreach (var threshold in new[] { 15m, 20m, 25m, 30m })
                    grid.Add(new() { ["Period"] = period, ["Threshold"] = threshold });
                break;
        }

        return grid;
    }

    private static string Label(string family, Dictionary<string, decimal> p) => family.ToUpperInvariant() switch
    {
        "T3"   => $"period={p["Period"]:0} factor={p["Factor"]:0.0} onay={p["ConfirmBars"]:0} bar",
        "EMA"  => $"hızlı={p["Fast"]:0} yavaş={p["Slow"]:0}",
        "RSI"  => $"period={p["Period"]:0} al>{p["BuyLevel"]:0} sat<{p["SellLevel"]:0}",
        "MACD" => $"{p["Fast"]:0}/{p["Slow"]:0}/{p["Signal"]:0}",
        "ADX"  => $"period={p["Period"]:0} eşik={p["Threshold"]:0}",
        _      => string.Join(' ', p.Select(kv => $"{kv.Key}={kv.Value}")),
    };

    // ─── Değerlendirme ───────────────────────────────────────────────────────────

    /// <summary>
    /// Tek coin üzerinde kombinasyonu dener. Giriş/çıkış sinyali bir sonraki barın
    /// AÇILIŞINDAN uygulanır — sinyalin oluştuğu barın kapanışından işlem yapmak
    /// gerçekte mümkün olmadığı için ileriye bakma (look-ahead) hatası doğurur.
    /// </summary>
    private static (decimal strat, decimal hold, decimal wr, int trades, decimal dd, decimal isPct, decimal oosPct)?
        Evaluate(List<CandleInput> c, string family, Dictionary<string, decimal> p, decimal commissionPct)
    {
        var n = c.Count;
        var signals = BuildSignals(c, family, p);
        if (signals is null) return null;

        var warmup = 210;
        var splitIdx = warmup + (int)((n - warmup) * 0.7);

        decimal equity = 100m, peak = 100m, maxDd = 0m;
        decimal isEquity = 100m, oosEquity = 100m;
        decimal? entry = null;
        int entryIdx = 0, trades = 0, wins = 0;

        for (var i = warmup; i < n - 1; i++)
        {
            var sig = signals[i];

            if (entry is null && sig > 0)
            {
                entry = c[i + 1].Open;
                entryIdx = i;
            }
            else if (entry is not null && sig < 0)
            {
                var exit = c[i + 1].Open;
                var r = (exit - entry.Value) / entry.Value * (1m - commissionPct / 100m);
                var factor = 1m + r - commissionPct / 100m;

                equity *= factor;
                if (entryIdx < splitIdx) isEquity *= factor; else oosEquity *= factor;

                trades++;
                if (factor > 1m) wins++;
                entry = null;

                peak = Math.Max(peak, equity);
                if (peak > 0)
                {
                    var dd = (peak - equity) / peak * 100m;
                    maxDd = Math.Max(maxDd, dd);
                }
            }
        }

        // Açık pozisyon son fiyattan kapatılır
        if (entry is not null)
        {
            var factor = 1m + (c[^1].Close - entry.Value) / entry.Value - commissionPct / 100m;
            equity *= factor;
            if (entryIdx < splitIdx) isEquity *= factor; else oosEquity *= factor;
            trades++;
            if (factor > 1m) wins++;
        }

        var holdStart = c[warmup].Close;
        var hold = holdStart > 0 ? (c[^1].Close - holdStart) / holdStart * 100m : 0m;

        return (equity - 100m, hold, trades > 0 ? wins * 100m / trades : 0m, trades, maxDd,
                isEquity - 100m, oosEquity - 100m);
    }

    /// <summary>
    /// Her bar için sinyal dizisi: +1 al, -1 sat, 0 bekle.
    /// Tüm hesap kapanmış barlarla yapılır.
    /// </summary>
    private static int[]? BuildSignals(List<CandleInput> c, string family, Dictionary<string, decimal> p)
    {
        var n = c.Count;
        var closes = c.Select(x => x.Close).ToArray();
        var sig = new int[n];

        switch (family.ToUpperInvariant())
        {
            case "T3":
            {
                var t3 = TillsonIndicator.ComputeT3(closes, (int)p["Period"], p["Factor"]);
                var confirm = (int)p["ConfirmBars"];
                for (var i = confirm + 1; i < n; i++)
                {
                    var up = true; var down = true;
                    for (var k = 0; k < confirm; k++)
                    {
                        if (!(t3[i - k] > t3[i - k - 1])) up = false;
                        if (!(t3[i - k] < t3[i - k - 1])) down = false;
                    }
                    sig[i] = up ? 1 : down ? -1 : 0;
                }
                return sig;
            }

            case "EMA":
            {
                var fast = TechnicalUtils.ComputeEma(closes, (int)p["Fast"]);
                var slow = TechnicalUtils.ComputeEma(closes, (int)p["Slow"]);
                for (var i = 1; i < n; i++)
                {
                    if (slow[i] <= 0 || slow[i - 1] <= 0) continue;
                    var now = fast[i] > slow[i];
                    var prev = fast[i - 1] > slow[i - 1];
                    sig[i] = now && !prev ? 1 : !now && prev ? -1 : 0;
                }
                return sig;
            }

            case "RSI":
            {
                var rsi = RsiIndicator.ComputeRsi(closes, (int)p["Period"]);
                var buy = p["BuyLevel"]; var sell = p["SellLevel"];
                for (var i = 1; i < n; i++)
                {
                    if (rsi[i] > buy && rsi[i - 1] <= buy) sig[i] = 1;
                    else if (rsi[i] < sell && rsi[i - 1] >= sell) sig[i] = -1;
                }
                return sig;
            }

            case "MACD":
            {
                var f = (int)p["Fast"]; var s = (int)p["Slow"]; var sg = (int)p["Signal"];
                for (var i = 60; i < n; i++)
                {
                    var from = Math.Max(0, i - 199);
                    var slice = closes[from..(i + 1)];
                    var (_, _, hist, prevHist) = TechnicalUtils.ComputeMacdFull(slice, f, s, sg);
                    sig[i] = hist > 0 && prevHist <= 0 ? 1 : hist < 0 && prevHist >= 0 ? -1 : 0;
                }
                return sig;
            }

            case "ADX":
            {
                var period = (int)p["Period"]; var th = p["Threshold"];
                for (var i = 60; i < n; i++)
                {
                    var from = Math.Max(0, i - 199);
                    var slice = c.GetRange(from, i - from + 1);
                    var (adx, pdi, mdi) = TechnicalUtils.ComputeAdxFull(slice, period);
                    sig[i] = adx >= th && pdi > mdi ? 1 : (adx >= th && mdi > pdi) || adx < th ? -1 : 0;
                }
                return sig;
            }
        }

        return null;
    }
}
