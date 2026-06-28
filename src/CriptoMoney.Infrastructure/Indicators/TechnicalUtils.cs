using CriptoMoney.Application.Common.Interfaces;

namespace CriptoMoney.Infrastructure.Indicators;

/// <summary>
/// Teknik analiz yardımcı hesaplamalar (ATR, EMA, vb.)
/// </summary>
public static class TechnicalUtils
{
    /// <summary>
    /// Wilder's ATR (Average True Range) hesaplar.
    /// True Range = max(High-Low, |High-PrevClose|, |Low-PrevClose|)
    /// </summary>
    public static decimal ComputeAtr(IReadOnlyList<CandleInput> candles, int period = 14)
    {
        if (candles.Count < period + 2) return 0m;

        var trs = new decimal[candles.Count];
        for (int i = 1; i < candles.Count; i++)
        {
            var hl  = candles[i].High - candles[i].Low;
            var hpc = Math.Abs(candles[i].High - candles[i - 1].Close);
            var lpc = Math.Abs(candles[i].Low  - candles[i - 1].Close);
            trs[i] = Math.Max(hl, Math.Max(hpc, lpc));
        }

        // İlk ATR = basit ortalama
        decimal sum = 0;
        for (int i = 1; i <= period; i++) sum += trs[i];
        var atr = sum / period;

        // Sonraki barlar: Wilder smoothing (alpha = 1/period)
        for (int i = period + 1; i < candles.Count; i++)
            atr = (atr * (period - 1) + trs[i]) / period;

        return Math.Round(atr, 8);
    }

    /// <summary>
    /// Exponential Moving Average.
    /// </summary>
    public static decimal[] ComputeEma(decimal[] values, int period)
    {
        var ema = new decimal[values.Length];
        if (values.Length < period) return ema;
        decimal sum = 0;
        for (int i = 0; i < period; i++) sum += values[i];
        ema[period - 1] = sum / period;
        var k = 2m / (period + 1);
        for (int i = period; i < values.Length; i++)
            ema[i] = values[i] * k + ema[i - 1] * (1 - k);
        return ema;
    }
}
