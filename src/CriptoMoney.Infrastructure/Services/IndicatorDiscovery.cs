using System.Text.Json;
using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Infrastructure.Indicators;

namespace CriptoMoney.Infrastructure.Services;

// ─── Kural modeli ────────────────────────────────────────────────────────────

public enum RuleOp { GreaterThan, LessThan }

/// <summary>Tek koşul: "rsi14 > 55" gibi.</summary>
public record RuleCondition(string Feature, RuleOp Op, decimal Threshold)
{
    public string Describe(string displayName) =>
        $"{displayName} {(Op == RuleOp.GreaterThan ? ">" : "<")} {Threshold:0.##}";
}

/// <summary>
/// Keşfedilen indikatör: koşulların TAMAMI sağlanırsa pozisyonda kal, biri bozulursa çık.
/// Hazır bir indikatör ailesi değil — veriden türetilmiş özgün bir kural.
/// </summary>
public record DiscoveredRule(List<RuleCondition> Conditions)
{
    public string ToJson() => JsonSerializer.Serialize(this);

    public static DiscoveredRule? FromJson(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try { return JsonSerializer.Deserialize<DiscoveredRule>(json); }
        catch (JsonException) { return null; }
    }
}

// ─── Özellik seti ────────────────────────────────────────────────────────────

/// <summary>
/// Kuralların üzerine kurulduğu ham malzeme. Hepsi yalnızca GEÇMİŞ barlardan
/// hesaplanır — ileriye bakma (look-ahead) yoktur.
/// </summary>
public static class FeatureSet
{
    public record FeatureDef(string Key, string DisplayName, string Unit);

    public static readonly FeatureDef[] Definitions =
    [
        new("rsi14",        "RSI(14)",                  ""),
        new("adx14",        "ADX(14) trend gücü",       ""),
        new("diDelta",      "+DI − −DI (yön)",          ""),
        new("macdHistPct",  "MACD histogram (fiyatın %'si)", "%"),
        new("emaDist20",    "Fiyatın EMA20'ye uzaklığı",  "%"),
        new("emaDist50",    "Fiyatın EMA50'ye uzaklığı",  "%"),
        new("emaDist200",   "Fiyatın EMA200'e uzaklığı",  "%"),
        new("t3SlopePct",   "T3 eğimi",                 "%"),
        new("volRatio20",   "Hacim / 20-bar ortalaması", "x"),
        new("atrPct",       "ATR (fiyatın %'si)",       "%"),
        new("ret1",         "Son barın getirisi",       "%"),
        new("ret5",         "Son 5 barın getirisi",     "%"),
        new("bodyPct",      "Mum gövdesi",              "%"),
        new("rangePct",     "Bar aralığı",              "%"),
    ];

    private static readonly Dictionary<string, FeatureDef> ByKey =
        Definitions.ToDictionary(d => d.Key, StringComparer.OrdinalIgnoreCase);

    public static string Describe(RuleCondition c) =>
        c.Describe(ByKey.TryGetValue(c.Feature, out var d) ? d.DisplayName : c.Feature);

    /// <summary>Tüm barlar için özellik matrisi üretir. Isınmamış barlar null'dır.</summary>
    public static Dictionary<string, decimal[]> Compute(IReadOnlyList<CandleInput> c)
    {
        var n = c.Count;
        var closes = c.Select(x => x.Close).ToArray();

        var rsi = RsiIndicator.ComputeRsi(closes, 14);
        var (adx, pdi, mdi) = TechnicalUtils.ComputeAdxSeries(c, 14);
        var macdHist = TechnicalUtils.ComputeMacdHistSeries(closes);
        var atr = TechnicalUtils.ComputeAtrSeries(c, 14);
        var ema20 = TechnicalUtils.ComputeEma(closes, 20);
        var ema50 = TechnicalUtils.ComputeEma(closes, 50);
        var ema200 = TechnicalUtils.ComputeEma(closes, 200);
        var t3 = TillsonIndicator.ComputeT3(closes, 5, 0.7m);

        var f = Definitions.ToDictionary(d => d.Key, _ => new decimal[n]);

        for (var i = 0; i < n; i++)
        {
            var close = closes[i];
            f["rsi14"][i]       = rsi[i];
            f["adx14"][i]       = adx[i];
            f["diDelta"][i]     = pdi[i] - mdi[i];
            f["macdHistPct"][i] = close > 0 ? macdHist[i] / close * 100m : 0;
            f["emaDist20"][i]   = ema20[i]  > 0 ? (close - ema20[i])  / ema20[i]  * 100m : 0;
            f["emaDist50"][i]   = ema50[i]  > 0 ? (close - ema50[i])  / ema50[i]  * 100m : 0;
            f["emaDist200"][i]  = ema200[i] > 0 ? (close - ema200[i]) / ema200[i] * 100m : 0;
            f["t3SlopePct"][i]  = i > 0 && t3[i - 1] > 0 ? (t3[i] - t3[i - 1]) / t3[i - 1] * 100m : 0;
            f["atrPct"][i]      = close > 0 ? atr[i] / close * 100m : 0;
            f["ret1"][i]        = i > 0 && closes[i - 1] > 0 ? (close - closes[i - 1]) / closes[i - 1] * 100m : 0;
            f["ret5"][i]        = i > 4 && closes[i - 5] > 0 ? (close - closes[i - 5]) / closes[i - 5] * 100m : 0;
            f["bodyPct"][i]     = c[i].Open > 0 ? (close - c[i].Open) / c[i].Open * 100m : 0;
            f["rangePct"][i]    = c[i].Low  > 0 ? (c[i].High - c[i].Low) / c[i].Low * 100m : 0;

            if (i >= 20)
            {
                decimal sum = 0;
                for (var k = i - 20; k < i; k++) sum += c[k].Volume;
                var avg = sum / 20m;
                f["volRatio20"][i] = avg > 0 ? c[i].Volume / avg : 0;
            }
        }

        return f;
    }

    /// <summary>Isınma tamamlanmadan önceki barlar kuralda kullanılamaz.</summary>
    public const int WarmupBars = 210;
}

// ─── Keşif motoru ────────────────────────────────────────────────────────────

public record DiscoveryOutcome(
    DiscoveredRule Rule,
    string RuleText,
    decimal TrainPct,
    decimal ValidationPct,
    decimal TestPct,
    decimal BuyHoldPct,
    decimal EdgePct,
    decimal WinRate,
    int TradeCount,
    int SymbolsBeatingBuyHold,
    int SymbolCount);

public interface IIndicatorDiscovery
{
    Task<List<DiscoveryOutcome>> DiscoverAsync(
        IReadOnlyDictionary<string, List<CandleInput>> dataBySymbol,
        decimal commissionPct,
        IProgress<int>? progress = null,
        CancellationToken ct = default);
}

/// <summary>
/// Hazır bir indikatör ailesi seçmeden, veriden kural üretir.
///
/// YÖNTEM — ışın araması (beam search):
///   1. Her özellik için eğitim verisinin yüzdeliklerinden eşik adayları çıkarılır.
///   2. Tek koşullu tüm kurallar denenir, en iyi K tanesi tutulur.
///   3. Her biri bir koşul daha eklenerek genişletilir; 3 koşula kadar sürer.
///
/// AŞIRI UYUM NEDEN BURADA DAHA TEHLİKELİ:
/// Hazır ailede birkaç düzine kombinasyon denenir; burada binlerce kural üretilir.
/// Ne kadar çok denenirse, geçmişte şans eseri iyi görünen bir kural bulma ihtimali
/// o kadar artar. Bu yüzden veri ÜÇE bölünür:
///   • eğitim (%50)   — kurallar burada aranır
///   • doğrulama (%25) — en iyiler burada seçilir
///   • test (%25)      — seçimde HİÇ kullanılmaz; raporlanan dürüst tahmin budur
/// </summary>
public class IndicatorDiscovery : IIndicatorDiscovery
{
    private const int BeamWidth = 10;
    private const int MaxDepth = 3;
    private const int MinTradesPerSymbol = 3;

    /// <summary>Eşik adayları: eğitim verisinin bu yüzdelikleri.</summary>
    private static readonly decimal[] Quantiles = [0.2m, 0.35m, 0.5m, 0.65m, 0.8m];

    public async Task<List<DiscoveryOutcome>> DiscoverAsync(
        IReadOnlyDictionary<string, List<CandleInput>> dataBySymbol,
        decimal commissionPct,
        IProgress<int>? progress = null,
        CancellationToken ct = default)
    {
        // Her sembol için özellikleri bir kez hesapla
        var prepared = new List<SymbolData>();
        foreach (var (symbol, candles) in dataBySymbol)
        {
            if (candles.Count < FeatureSet.WarmupBars + 120) continue;
            prepared.Add(SymbolData.Build(symbol, candles));
        }

        if (prepared.Count == 0) return [];

        var thresholds = BuildThresholdCandidates(prepared);

        // ── 1. seviye: tek koşullu kurallar ──────────────────────────────────
        var beam = new List<(DiscoveredRule rule, decimal score)>();

        var total = thresholds.Count;
        var done = 0;

        foreach (var cond in thresholds)
        {
            ct.ThrowIfCancellationRequested();
            var rule = new DiscoveredRule([cond]);
            var s = ScoreOnSegment(rule, prepared, commissionPct, Segment.Train);
            if (s is not null) beam.Add((rule, s.Value));

            if (++done % 20 == 0)
            {
                progress?.Report((int)(done * 25.0 / total));
                await Task.Yield();
            }
        }

        beam = [.. beam.OrderByDescending(x => x.score).Take(BeamWidth)];
        if (beam.Count == 0) return [];

        // ── 2. ve 3. seviye: koşul ekleyerek genişlet ────────────────────────
        var all = new List<(DiscoveredRule rule, decimal score)>(beam);

        for (var depth = 2; depth <= MaxDepth; depth++)
        {
            var next = new List<(DiscoveredRule rule, decimal score)>();
            var step = 0;

            foreach (var (rule, _) in beam)
            {
                ct.ThrowIfCancellationRequested();
                var usedFeatures = rule.Conditions.Select(c => c.Feature).ToHashSet(StringComparer.OrdinalIgnoreCase);

                foreach (var cond in thresholds)
                {
                    // Aynı özelliği iki kez kullanmak daraltmaktan çok gürültü ekler
                    if (usedFeatures.Contains(cond.Feature)) continue;

                    var extended = new DiscoveredRule([.. rule.Conditions, cond]);
                    var s = ScoreOnSegment(extended, prepared, commissionPct, Segment.Train);
                    if (s is not null) next.Add((extended, s.Value));
                }

                progress?.Report(25 + (depth - 2) * 25 + (int)(++step * 25.0 / beam.Count));
                await Task.Yield();
            }

            if (next.Count == 0) break;
            beam = [.. next.OrderByDescending(x => x.score).Take(BeamWidth)];
            all.AddRange(beam);
        }

        // ── Seçim doğrulama setinde, rapor test setinde ──────────────────────
        var candidates = new List<DiscoveryOutcome>();

        foreach (var (rule, _) in all.DistinctBy(x => x.rule.ToJson()))
        {
            ct.ThrowIfCancellationRequested();
            var outcome = Evaluate(rule, prepared, commissionPct);
            if (outcome is not null) candidates.Add(outcome);
        }

        progress?.Report(100);

        // Doğrulama setindeki üstünlüğe göre sırala — test seti seçime karışmaz
        return [.. candidates.OrderByDescending(c => c.ValidationPct).Take(25)];
    }

    // ─── Eşik adayları ───────────────────────────────────────────────────────

    private static List<RuleCondition> BuildThresholdCandidates(List<SymbolData> data)
    {
        var result = new List<RuleCondition>();

        foreach (var def in FeatureSet.Definitions)
        {
            // Tüm sembollerin eğitim bölümünden örnek topla
            var samples = new List<decimal>();
            foreach (var d in data)
            {
                var arr = d.Features[def.Key];
                for (var i = FeatureSet.WarmupBars; i < d.TrainEnd; i += 3)
                    samples.Add(arr[i]);
            }

            if (samples.Count < 50) continue;
            samples.Sort();

            foreach (var q in Quantiles)
            {
                var idx = Math.Clamp((int)(samples.Count * q), 0, samples.Count - 1);
                var th = Math.Round(samples[idx], 2);

                result.Add(new RuleCondition(def.Key, RuleOp.GreaterThan, th));
                result.Add(new RuleCondition(def.Key, RuleOp.LessThan, th));
            }
        }

        return result;
    }

    // ─── Değerlendirme ───────────────────────────────────────────────────────

    private enum Segment { Train, Validation, Test, All }

    /// <summary>Arama sırasında kullanılan hızlı puan — eğitim setindeki üstünlük.</summary>
    private static decimal? ScoreOnSegment(
        DiscoveredRule rule, List<SymbolData> data, decimal commissionPct, Segment seg)
    {
        decimal edgeSum = 0;
        var trades = 0;
        var used = 0;

        foreach (var d in data)
        {
            var (from, to) = d.Range(seg);
            var r = Simulate(rule, d, from, to, commissionPct);
            if (r is null) continue;

            edgeSum += r.Value.strategyPct - r.Value.holdPct;
            trades += r.Value.trades;
            used++;
        }

        if (used == 0 || trades < used * MinTradesPerSymbol) return null;
        return edgeSum / used;
    }

    private static DiscoveryOutcome? Evaluate(
        DiscoveredRule rule, List<SymbolData> data, decimal commissionPct)
    {
        decimal trainSum = 0, valSum = 0, testSum = 0, holdSum = 0;
        decimal winSum = 0;
        int trades = 0, used = 0, beating = 0;

        foreach (var d in data)
        {
            var (tf, tt) = d.Range(Segment.Train);
            var (vf, vt) = d.Range(Segment.Validation);
            var (sf, st) = d.Range(Segment.Test);

            var tr = Simulate(rule, d, tf, tt, commissionPct);
            var va = Simulate(rule, d, vf, vt, commissionPct);
            var te = Simulate(rule, d, sf, st, commissionPct);
            if (tr is null || va is null || te is null) continue;

            trainSum += tr.Value.strategyPct - tr.Value.holdPct;
            valSum   += va.Value.strategyPct - va.Value.holdPct;
            testSum  += te.Value.strategyPct - te.Value.holdPct;
            holdSum  += te.Value.holdPct;

            var totalTrades = tr.Value.trades + va.Value.trades + te.Value.trades;
            var totalWins = tr.Value.wins + va.Value.wins + te.Value.wins;
            trades += totalTrades;
            if (totalTrades > 0) winSum += totalWins * 100m / totalTrades;

            if (te.Value.strategyPct > te.Value.holdPct) beating++;
            used++;
        }

        if (used == 0 || trades < used * MinTradesPerSymbol) return null;

        var text = string.Join("  VE  ", rule.Conditions.Select(FeatureSet.Describe));

        return new DiscoveryOutcome(
            rule,
            text,
            Math.Round(trainSum / used, 2),
            Math.Round(valSum / used, 2),
            Math.Round(testSum / used, 2),
            Math.Round(holdSum / used, 2),
            Math.Round(testSum / used, 2),
            Math.Round(winSum / used, 1),
            trades,
            beating,
            used);
    }

    /// <summary>
    /// Kural doğruyken pozisyonda kal, bozulunca çık. Giriş/çıkış bir SONRAKİ barın
    /// açılışından yapılır — sinyalin oluştuğu barın kapanışından işlem yapmak
    /// gerçekte mümkün değildir.
    /// </summary>
    private static (decimal strategyPct, decimal holdPct, int trades, int wins)? Simulate(
        DiscoveredRule rule, SymbolData d, int from, int to, decimal commissionPct)
    {
        if (to - from < 30) return null;

        decimal equity = 100m;
        decimal? entry = null;
        int trades = 0, wins = 0;
        var fee = commissionPct / 100m;

        for (var i = from; i < to - 1; i++)
        {
            var hold = Matches(rule, d, i);

            if (entry is null && hold)
            {
                entry = d.Candles[i + 1].Open;
            }
            else if (entry is not null && !hold)
            {
                var exit = d.Candles[i + 1].Open;
                var factor = 1m + (exit - entry.Value) / entry.Value - fee;
                equity *= factor;
                trades++;
                if (factor > 1m) wins++;
                entry = null;
            }
        }

        if (entry is not null)
        {
            var factor = 1m + (d.Candles[to - 1].Close - entry.Value) / entry.Value - fee;
            equity *= factor;
            trades++;
            if (factor > 1m) wins++;
        }

        var startPrice = d.Candles[from].Close;
        var holdPct = startPrice > 0 ? (d.Candles[to - 1].Close - startPrice) / startPrice * 100m : 0m;

        return (equity - 100m, holdPct, trades, wins);
    }

    private static bool Matches(DiscoveredRule rule, SymbolData d, int i)
    {
        foreach (var c in rule.Conditions)
        {
            if (!d.Features.TryGetValue(c.Feature, out var arr)) return false;
            var v = arr[i];
            if (c.Op == RuleOp.GreaterThan ? v <= c.Threshold : v >= c.Threshold) return false;
        }
        return true;
    }

    // ─── Sembol verisi + bölme ───────────────────────────────────────────────

    private sealed class SymbolData
    {
        public required string Symbol { get; init; }
        public required List<CandleInput> Candles { get; init; }
        public required Dictionary<string, decimal[]> Features { get; init; }
        public int TrainEnd { get; private set; }
        public int ValidationEnd { get; private set; }

        public static SymbolData Build(string symbol, List<CandleInput> candles)
        {
            var usable = candles.Count - FeatureSet.WarmupBars;
            var d = new SymbolData
            {
                Symbol = symbol,
                Candles = candles,
                Features = FeatureSet.Compute(candles),
            };
            d.TrainEnd = FeatureSet.WarmupBars + (int)(usable * 0.50);
            d.ValidationEnd = FeatureSet.WarmupBars + (int)(usable * 0.75);
            return d;
        }

        public (int from, int to) Range(Segment seg) => seg switch
        {
            Segment.Train      => (FeatureSet.WarmupBars, TrainEnd),
            Segment.Validation => (TrainEnd, ValidationEnd),
            Segment.Test       => (ValidationEnd, Candles.Count),
            _                  => (FeatureSet.WarmupBars, Candles.Count),
        };
    }
}
