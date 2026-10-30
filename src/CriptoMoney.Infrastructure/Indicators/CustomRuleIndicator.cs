using System.Text.Json;
using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Infrastructure.Services;

namespace CriptoMoney.Infrastructure.Indicators;

/// <summary>
/// Keşif motorlarının ürettiği özel indikatörü çalıştırır. İki tür destekler:
///
///   • formula — ham OHLCV'den evrimleşen formül (AUTO ailesi).
///     Örn: ((kapanış − endüşük(düşük, 14)) ÷ sapma(kapanış, 20)) > kendi 65. yüzdeliği
///
///   • rule — hazır indikatörlerden kurulan koşul listesi (KURAL ailesi).
///     Örn: RSI(14) > 55  VE  ADX(14) > 22
///
/// Sabit bir formülü yoktur; tanım, indikatör ayarındaki RuleJson parametresinden gelir.
/// </summary>
public class CustomRuleIndicator : IIndicator
{
    public string Name => "CustomRule";

    /// <summary>Formül eşiği ve pencere işlemleri için gereken asgari geçmiş.</summary>
    public int MinCandlesRequired => FeatureSet.WarmupBars + 5;

    public IndicatorResult Calculate(
        IReadOnlyList<CandleInput> candles,
        Dictionary<string, string> parameters)
    {
        if (candles.Count < MinCandlesRequired) return Neutral();

        parameters.TryGetValue("RuleJson", out var json);
        if (string.IsNullOrWhiteSpace(json)) return Neutral();

        // Formül mü koşul listesi mi?
        return IsFormula(json)
            ? EvaluateFormula(candles, json)
            : EvaluateRule(candles, json);
    }

    private static bool IsFormula(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.TryGetProperty("kind", out var k)
                && k.GetString() == "formula";
        }
        catch (JsonException) { return false; }
    }

    // ─── Formül (AUTO) ───────────────────────────────────────────────────────

    private IndicatorResult EvaluateFormula(IReadOnlyList<CandleInput> candles, string json)
    {
        FormulaSpec? spec;
        try { spec = JsonSerializer.Deserialize<FormulaSpec>(json, SpecOptions); }
        catch (JsonException) { return Neutral(); }

        if (spec?.Tree is null) return Neutral();

        var tree = FormulaDiscovery.DeserializeTree(spec.Tree);
        if (tree is null) return Neutral();

        var series = PriceSeries.From(candles);
        var values = tree.Evaluate(series);

        // Eşik, formülün kendi geçmiş dağılımından alınır — mutlak sayı değil,
        // böylece farklı fiyat ölçeklerinde aynı anlamı taşır.
        var sample = values
            .Take(values.Length - 1)
            .Where(v => !double.IsNaN(v) && !double.IsInfinity(v))
            .OrderBy(v => v)
            .ToArray();

        if (sample.Length < 30 || Math.Abs(sample[^1] - sample[0]) < 1e-12) return Neutral();

        var idx = Math.Clamp((int)(sample.Length * spec.Quantile), 0, sample.Length - 1);
        var threshold = sample[idx];

        // Karar son KAPANMIŞ bardan verilir ([^1] devam ediyor olabilir).
        var current = values[^2];
        var inPosition = spec.GreaterThan ? current > threshold : current < threshold;

        // Skor: eşikten uzaklık, dağılımın genişliğine göre normalize edilir.
        var spread = sample[^1] - sample[0];
        var distance = spread > 0 ? (current - threshold) / spread : 0;
        if (!spec.GreaterThan) distance = -distance;
        var score = Math.Clamp((decimal)(distance * 6), -3m, 3m);

        return new IndicatorResult(
            Name,
            Math.Round(score, 3),
            (decimal)Math.Round(current, 6),
            inPosition ? "BUY" : "SELL",
            new Dictionary<string, decimal>
            {
                ["formul_degeri"] = (decimal)Math.Round(current, 6),
                ["esik"]          = (decimal)Math.Round(threshold, 6),
                ["yuzdelik"]      = (decimal)spec.Quantile,
            });
    }

    private record FormulaSpec(string? Kind, string? Expression, string? Tree, double Quantile, bool GreaterThan);

    /// <summary>
    /// Kaydedilen tanım camelCase ("kind", "tree"), kayıt tipi PascalCase.
    /// System.Text.Json varsayılan olarak harf duyarlıdır — eşleşmezse tüm
    /// alanlar boş gelir ve indikatör sessizce çalışmaz.
    /// </summary>
    private static readonly JsonSerializerOptions SpecOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    // ─── Koşul listesi (KURAL) ───────────────────────────────────────────────

    private IndicatorResult EvaluateRule(IReadOnlyList<CandleInput> candles, string json)
    {
        var rule = DiscoveredRule.FromJson(json);
        if (rule is null || rule.Conditions.Count == 0) return Neutral();

        var features = FeatureSet.Compute(candles);
        var i = candles.Count - 2;

        var satisfied = 0;
        var details = new Dictionary<string, decimal>();

        foreach (var c in rule.Conditions)
        {
            if (!features.TryGetValue(c.Feature, out var arr)) continue;

            var value = arr[i];
            details[c.Feature] = Math.Round(value, 4);

            var ok = c.Op == RuleOp.GreaterThan ? value > c.Threshold : value < c.Threshold;
            if (ok) satisfied++;
        }

        var allOk = satisfied == rule.Conditions.Count;
        details["karsilanan_kosul"] = satisfied;
        details["toplam_kosul"] = rule.Conditions.Count;

        var ratio = (decimal)satisfied / rule.Conditions.Count;
        return new IndicatorResult(
            Name,
            Math.Round(ratio * 6m - 3m, 3),
            satisfied,
            allOk ? "BUY" : "SELL",
            details);
    }

    private IndicatorResult Neutral() =>
        new(Name, 0, 0, "HOLD", new Dictionary<string, decimal> { ["hazir_degil"] = 1 });
}
