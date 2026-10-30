using CriptoMoney.Application.Common.Interfaces;

namespace CriptoMoney.Infrastructure.Services;

/// <summary>
/// Desteklenen periyotlar ve Binance'in native olarak vermediklerinin türetilmesi.
///
/// Binance native periyotları: 1m,3m,5m,15m,30m,1h,2h,4h,6h,8h,12h,1d,3d,1w,1M
/// 45m bu listede YOKTUR — 15m barların 3'erli gruplanmasıyla üretilir.
/// Gruplama gün başlangıcına hizalanır ki aynı aralık her çağrıda aynı barları versin.
/// </summary>
public static class TimeframeHelper
{
    public record TimeframeSpec(
        string Key,
        string DisplayName,
        TimeSpan Duration,
        /// <summary>Binance'ten çekilecek gerçek periyot.</summary>
        string SourceInterval,
        /// <summary>Kaç kaynak bar birleştirilecek (1 = doğrudan).</summary>
        int AggregateCount);

    private static readonly Dictionary<string, TimeframeSpec> Specs = new(StringComparer.OrdinalIgnoreCase)
    {
        ["15m"] = new("15m", "15 Dakika", TimeSpan.FromMinutes(15), "15m", 1),
        ["45m"] = new("45m", "45 Dakika", TimeSpan.FromMinutes(45), "15m", 3),
        ["1h"]  = new("1h",  "1 Saat",    TimeSpan.FromHours(1),    "1h",  1),
        ["4h"]  = new("4h",  "4 Saat",    TimeSpan.FromHours(4),    "4h",  1),
        ["1d"]  = new("1d",  "Günlük",    TimeSpan.FromDays(1),     "1d",  1),
        ["1w"]  = new("1w",  "Haftalık",  TimeSpan.FromDays(7),     "1w",  1),
    };

    public static IReadOnlyCollection<TimeframeSpec> All => Specs.Values;

    public static TimeframeSpec? Get(string timeframe)
        => Specs.TryGetValue(timeframe, out var s) ? s : null;

    public static bool IsSupported(string timeframe) => Specs.ContainsKey(timeframe);

    /// <summary>Aralıkta kaç bar oluşacağının tahmini (tatil/kesinti yok sayılır).</summary>
    public static long EstimateBarCount(string timeframe, DateTime startUtc, DateTime endUtc)
    {
        var spec = Get(timeframe);
        if (spec is null || endUtc <= startUtc) return 0;
        return (long)((endUtc - startUtc).TotalMinutes / spec.Duration.TotalMinutes);
    }

    /// <summary>
    /// Kaynak barları hedef periyoda göre birleştirir (OHLCV kuralları:
    /// open=ilk, high=max, low=min, close=son, volume=toplam).
    /// Eksik kalan son grup atılır — yarım bar yanıltıcı sinyal üretir.
    /// </summary>
    public static List<BinanceCandle> Aggregate(IReadOnlyList<BinanceCandle> source, TimeframeSpec spec)
    {
        if (spec.AggregateCount <= 1) return [.. source];
        if (source.Count == 0) return [];

        var result = new List<BinanceCandle>(source.Count / spec.AggregateCount + 1);
        var stepMinutes = (int)spec.Duration.TotalMinutes;

        // Gün başına hizala: bar başlangıcı, gün içi dakikanın periyoda bölümüyle belirlenir
        var groups = source
            .GroupBy(c =>
            {
                var day = c.OpenTime.Date;
                var minuteOfDay = (int)(c.OpenTime - day).TotalMinutes;
                return day.AddMinutes(minuteOfDay / stepMinutes * stepMinutes);
            })
            .OrderBy(g => g.Key);

        foreach (var g in groups)
        {
            var bars = g.OrderBy(c => c.OpenTime).ToList();
            if (bars.Count < spec.AggregateCount) continue; // tamamlanmamış grup

            result.Add(new BinanceCandle(
                g.Key,
                bars[0].Open,
                bars.Max(b => b.High),
                bars.Min(b => b.Low),
                bars[^1].Close,
                bars.Sum(b => b.Volume),
                bars[^1].CloseTime,
                bars.Sum(b => b.QuoteVolume),
                bars.Sum(b => b.TradeCount),
                true));
        }

        return result;
    }
}
