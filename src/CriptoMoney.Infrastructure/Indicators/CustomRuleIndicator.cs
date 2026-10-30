using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Infrastructure.Services;

namespace CriptoMoney.Infrastructure.Indicators;

/// <summary>
/// Keşif motorunun ürettiği özel kuralı çalıştıran indikatör.
///
/// Sabit bir formülü yoktur — kural, kullanıcının indikatör ayarındaki
/// <c>RuleJson</c> parametresinden gelir. Bu sayede "kendi indikatörüm"
/// uygulamanın normal indikatör altyapısında çalışır: Analiz ekranında
/// görünür, backtest'te kullanılabilir.
///
/// Kural doğruyken AL (pozisyonda kal), bozulduğunda SAT sinyali üretir.
/// </summary>
public class CustomRuleIndicator : IIndicator
{
    public string Name => "CustomRule";

    /// <summary>EMA200 ve ADX ısınması için gereken asgari bar sayısı.</summary>
    public int MinCandlesRequired => FeatureSet.WarmupBars + 5;

    public IndicatorResult Calculate(
        IReadOnlyList<CandleInput> candles,
        Dictionary<string, string> parameters)
    {
        if (candles.Count < MinCandlesRequired)
            return Neutral("Yetersiz mum: kural için en az " + MinCandlesRequired + " bar gerekli.");

        parameters.TryGetValue("RuleJson", out var json);
        var rule = DiscoveredRule.FromJson(json);

        if (rule is null || rule.Conditions.Count == 0)
            return Neutral("Kural tanımlı değil — Veri & Lab sayfasından bir kural keşfedip uygulayın.");

        var features = FeatureSet.Compute(candles);

        // [^1] devam eden bar olabilir; karar son KAPANMIŞ bardan verilir.
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

        // Skor, kaç koşulun sağlandığına göre -3..+3 aralığına yayılır.
        // Tamamı sağlanmadan AL sinyali verilmez.
        var ratio = rule.Conditions.Count > 0 ? (decimal)satisfied / rule.Conditions.Count : 0m;
        var score = Math.Round(ratio * 6m - 3m, 3);

        return new IndicatorResult(
            Name,
            score,
            satisfied,
            allOk ? "BUY" : "SELL",
            details);
    }

    private IndicatorResult Neutral(string reason) =>
        new(Name, 0, 0, "HOLD", new Dictionary<string, decimal> { ["hazir_degil"] = 1 });
}
