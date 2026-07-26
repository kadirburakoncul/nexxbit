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

    /// <summary>
    /// Wilder ADX — Average Directional Index.
    /// Sadece ADX değerini döndürür (geriye dönük uyumluluk).
    /// YÖN bilgisi gerekiyorsa <see cref="ComputeAdxFull"/> kullanın: ADX trendin
    /// GÜCÜNÜ ölçer, YÖNÜNÜ değil — sert düşüşte de ADX yüksektir.
    /// </summary>
    public static decimal ComputeAdx(IReadOnlyList<CandleInput> candles, int period = 14)
        => ComputeAdxFull(candles, period).adx;

    /// <summary>
    /// Wilder ADX + yön göstergeleri.
    /// adx: trend gücü (0–100, 25+ = trend var)
    /// plusDi &gt; minusDi ise trend YUKARI, tersi ise AŞAĞI.
    /// AL sinyalinde her ikisi de kontrol edilmelidir.
    /// </summary>
    public static (decimal adx, decimal plusDi, decimal minusDi) ComputeAdxFull(
        IReadOnlyList<CandleInput> candles, int period = 14)
    {
        int n = candles.Count;
        if (n < period * 2 + 2) return (0m, 0m, 0m);

        var plusDm  = new decimal[n];
        var minusDm = new decimal[n];
        var tr      = new decimal[n];

        for (int i = 1; i < n; i++)
        {
            var upMove   = candles[i].High - candles[i - 1].High;
            var downMove = candles[i - 1].Low - candles[i].Low;
            plusDm[i]  = upMove   > downMove && upMove   > 0 ? upMove   : 0;
            minusDm[i] = downMove > upMove   && downMove > 0 ? downMove : 0;

            var hl  = candles[i].High - candles[i].Low;
            var hpc = Math.Abs(candles[i].High - candles[i - 1].Close);
            var lpc = Math.Abs(candles[i].Low  - candles[i - 1].Close);
            tr[i] = Math.Max(hl, Math.Max(hpc, lpc));
        }

        // Wilder smoothing seed (ilk period bar)
        decimal trSmooth = 0, plusSmooth = 0, minusSmooth = 0;
        for (int i = 1; i <= period; i++)
        {
            trSmooth    += tr[i];
            plusSmooth  += plusDm[i];
            minusSmooth += minusDm[i];
        }

        var adxSmooth = 0m;
        var dxSeed = new List<decimal>(period);
        decimal lastPlusDi = 0m, lastMinusDi = 0m;

        for (int i = period + 1; i < n; i++)
        {
            trSmooth    = trSmooth    - trSmooth    / period + tr[i];
            plusSmooth  = plusSmooth  - plusSmooth  / period + plusDm[i];
            minusSmooth = minusSmooth - minusSmooth / period + minusDm[i];

            lastPlusDi  = trSmooth > 0 ? plusSmooth  / trSmooth * 100m : 0;
            lastMinusDi = trSmooth > 0 ? minusSmooth / trSmooth * 100m : 0;
            var dx = (lastPlusDi + lastMinusDi) > 0
                ? Math.Abs(lastPlusDi - lastMinusDi) / (lastPlusDi + lastMinusDi) * 100m
                : 0;

            // Wilder standardı: ADX ilk `period` adet DX'in ORTALAMASIYLA başlatılır.
            // Tek DX ile başlatmak TradingView/Binance değerlerinden sapmaya yol açıyordu.
            if (dxSeed.Count < period)
            {
                dxSeed.Add(dx);
                if (dxSeed.Count == period)
                    adxSmooth = dxSeed.Average();
            }
            else
            {
                adxSmooth = (adxSmooth * (period - 1) + dx) / period;
            }
        }

        // Seed tamamlanmadıysa eldeki DX ortalaması en iyi tahmindir
        if (dxSeed.Count < period && dxSeed.Count > 0)
            adxSmooth = dxSeed.Average();

        return (Math.Round(adxSmooth, 4), Math.Round(lastPlusDi, 4), Math.Round(lastMinusDi, 4));
    }

    /// <summary>
    /// MACD — Moving Average Convergence Divergence.
    /// Returns (macdLine, signalLine, histogram) for the last bar.
    /// Bullish when macd > signal (histogram > 0).
    /// </summary>
    public static (decimal macd, decimal signal, decimal histogram) ComputeMacd(
        decimal[] closes, int fast = 12, int slow = 26, int signalPeriod = 9)
    {
        var (m, s, h, _) = ComputeMacdFull(closes, fast, slow, signalPeriod);
        return (m, s, h);
    }

    /// <summary>
    /// MACD + önceki barın histogramı.
    /// Yalnızca histogram &gt; 0 bakmak yetersizdir: 20 bardır pozitif ama KÜÇÜLEN
    /// histogram trendin bittiğini gösterir. Momentum onayı için
    /// histogram &gt; 0 VE histogram &gt; prevHistogram aranmalıdır.
    /// </summary>
    public static (decimal macd, decimal signal, decimal histogram, decimal prevHistogram) ComputeMacdFull(
        decimal[] closes, int fast = 12, int slow = 26, int signalPeriod = 9)
    {
        if (closes.Length < slow + signalPeriod + 1) return (0, 0, 0, 0);

        var emaFast   = ComputeEma(closes, fast);
        var emaSlow   = ComputeEma(closes, slow);
        var macdLine  = new decimal[closes.Length];
        for (int i = slow - 1; i < closes.Length; i++)
            macdLine[i] = emaFast[i] - emaSlow[i];

        // Signal = EMA(macdLine, signalPeriod)
        var macdSlice = macdLine.Skip(slow - 1).ToArray();
        var signalArr = ComputeEma(macdSlice, signalPeriod);

        var lastMacd   = macdLine[^1];
        var lastSignal = signalArr[^1];
        var prevHist   = signalArr.Length >= 2 && macdLine.Length >= 2
            ? macdLine[^2] - signalArr[^2]
            : 0m;

        return (lastMacd, lastSignal, lastMacd - lastSignal, prevHist);
    }
}
