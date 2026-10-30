using System.Globalization;
using System.Text;
using System.Text.Json;
using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Domain.Enums;
using CriptoMoney.Infrastructure.Indicators;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CriptoMoney.BackgroundJobs.Jobs;

/// <summary>
/// Seçilen coinlerin verisini çekip tek bir dosyaya yazar.
///
/// Dosya milyonlarca satır olabileceği için bellekte biriktirilmez, akış halinde
/// yazılır. Her sembol bittiğinde ilerleme kaydedilir; kullanıcı sayfadan ayrılsa
/// bile iş devam eder.
/// </summary>
public class MarketDataExportJob(
    IApplicationDbContext db,
    IMarketDataService marketData,
    ILogger<MarketDataExportJob> logger)
{
    /// <summary>Sayısal alanlar her zaman nokta ayraçlı yazılır (Excel/Python uyumu).</summary>
    private static readonly CultureInfo Inv = CultureInfo.InvariantCulture;

    public async Task ExecuteAsync(Guid exportId, CancellationToken ct = default)
    {
        var export = await db.MarketDataExports.FirstOrDefaultAsync(e => e.Id == exportId, ct);
        if (export is null)
        {
            logger.LogWarning("MarketDataExportJob: kayıt bulunamadı {Id}", exportId);
            return;
        }

        var symbols = JsonSerializer.Deserialize<List<string>>(export.Symbols) ?? [];
        if (symbols.Count == 0)
        {
            await FailAsync(export, "Sembol seçilmemiş.", ct);
            return;
        }

        export.Status = MarketDataExportStatus.Running;
        export.StartedAt = DateTime.UtcNow;
        export.ProgressPct = 0;
        await db.SaveChangesAsync(ct);

        var dir = GetExportDirectory();
        Directory.CreateDirectory(dir);
        var fileName = $"{Slug(export.Name)}_{export.Timeframe}_{export.Id:N}.{(export.Format == "json" ? "json" : "csv")}";
        var path = Path.Combine(dir, fileName);

        long totalRows = 0;
        var notes = new List<string>();

        try
        {
            await using var stream = new FileStream(path, FileMode.Create, FileAccess.Write, FileShare.Read, 64 * 1024);
            await using var writer = new StreamWriter(stream, new UTF8Encoding(true));

            var json = export.Format == "json";
            if (json) await writer.WriteLineAsync("[");
            else await writer.WriteLineAsync(BuildHeader(export.IncludeIndicators));

            var first = true;

            for (var i = 0; i < symbols.Count; i++)
            {
                ct.ThrowIfCancellationRequested();
                var symbol = symbols[i];

                var result = await marketData.GetCandlesRangeAsync(
                    symbol, export.Timeframe, export.StartDate, export.EndDate, ct);

                if (!result.Succeeded || result.Data is null)
                {
                    notes.Add($"{symbol}: veri alınamadı ({result.Errors.FirstOrDefault()})");
                    logger.LogWarning("Export {Id}: {Symbol} atlandı", exportId, symbol);
                }
                else
                {
                    var candles = result.Data;

                    if (candles.Count == 0)
                    {
                        notes.Add($"{symbol}: seçilen aralıkta veri yok (coin daha sonra listelenmiş olabilir)");
                    }
                    else
                    {
                        var expected = TimeframeHelperBarCount(export);
                        if (expected > 0 && candles.Count < expected * 0.9)
                            notes.Add($"{symbol}: {candles.Count}/{expected} bar (eksik veri veya geç listeleme)");

                        var rows = export.IncludeIndicators
                            ? BuildRowsWithIndicators(symbol, export.Timeframe, candles)
                            : BuildRowsPlain(symbol, export.Timeframe, candles);

                        foreach (var row in rows)
                        {
                            if (json)
                            {
                                if (!first) await writer.WriteLineAsync(",");
                                await writer.WriteAsync(row);
                                first = false;
                            }
                            else
                            {
                                await writer.WriteLineAsync(row);
                            }
                            totalRows++;
                        }
                    }
                }

                export.ProcessedSymbols = i + 1;
                export.ProgressPct = (int)((i + 1) * 100.0 / symbols.Count);
                export.TotalRows = totalRows;
                await db.SaveChangesAsync(ct);
            }

            if (json)
            {
                await writer.WriteLineAsync();
                await writer.WriteLineAsync("]");
            }

            await writer.FlushAsync(ct);
        }
        catch (OperationCanceledException)
        {
            export.Status = MarketDataExportStatus.Cancelled;
            export.ErrorMessage = "İşlem iptal edildi.";
            await db.SaveChangesAsync(CancellationToken.None);
            TryDelete(path);
            return;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Export {Id} başarısız", exportId);
            await FailAsync(export, ex.Message, CancellationToken.None);
            TryDelete(path);
            return;
        }

        var info = new FileInfo(path);
        export.Status = MarketDataExportStatus.Completed;
        export.ProgressPct = 100;
        export.FilePath = path;
        export.FileSizeBytes = info.Exists ? info.Length : 0;
        export.TotalRows = totalRows;
        export.CompletedAt = DateTime.UtcNow;
        export.DataQualityNote = notes.Count == 0
            ? "Tüm semboller eksiksiz alındı."
            : string.Join(" | ", notes.Take(25)) + (notes.Count > 25 ? $" (+{notes.Count - 25} not daha)" : "");

        await db.SaveChangesAsync(CancellationToken.None);

        logger.LogInformation("Export tamamlandı: {Id} {Rows:N0} satır, {Size:N0} bayt",
            exportId, totalRows, export.FileSizeBytes);
    }

    private static long TimeframeHelperBarCount(Domain.Entities.MarketDataExport e)
        => Infrastructure.Services.TimeframeHelper.EstimateBarCount(e.Timeframe, e.StartDate, e.EndDate);

    private async Task FailAsync(Domain.Entities.MarketDataExport export, string message, CancellationToken ct)
    {
        export.Status = MarketDataExportStatus.Failed;
        export.ErrorMessage = message;
        export.CompletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
    }

    private static void TryDelete(string path)
    {
        try { if (File.Exists(path)) File.Delete(path); } catch { /* temizlik hatası önemsiz */ }
    }

    public static string GetExportDirectory()
        => Path.Combine(AppContext.BaseDirectory, "data-exports");

    private static string Slug(string name)
    {
        var clean = new string(name.Where(c => char.IsLetterOrDigit(c) || c is '-' or '_').ToArray());
        return string.IsNullOrWhiteSpace(clean) ? "export" : clean[..Math.Min(clean.Length, 40)];
    }

    // ─── Satır üretimi ───────────────────────────────────────────────────────────

    private static string BuildHeader(bool withIndicators)
    {
        var baseCols = "symbol,timeframe,open_time,open,high,low,close,volume,quote_volume,trade_count";
        if (!withIndicators) return baseCols;

        // Hesaplanmış kolonlar: dosyayı doğrudan analize hazır hale getirir.
        // forward_return_1/5/10, veriyi etiketlemek için — bir sonraki barlarda
        // fiyatın ne yaptığını gösterir, indikatör arayışının hedef değişkenidir.
        return baseCols +
            ",return_pct,range_pct,body_pct" +
            ",ema20,ema50,ema200,rsi14,atr14,atr_pct" +
            ",macd,macd_signal,macd_hist,adx14,plus_di,minus_di,t3" +
            ",volume_ratio20" +
            ",forward_return_1,forward_return_5,forward_return_10";
    }

    private static IEnumerable<string> BuildRowsPlain(string symbol, string tf, List<BinanceCandle> c)
    {
        foreach (var k in c)
            yield return string.Join(',',
                symbol, tf, k.OpenTime.ToString("yyyy-MM-dd HH:mm:ss", Inv),
                F(k.Open), F(k.High), F(k.Low), F(k.Close),
                F(k.Volume), F(k.QuoteVolume), k.TradeCount.ToString(Inv));
    }

    private static IEnumerable<string> BuildRowsWithIndicators(string symbol, string tf, List<BinanceCandle> c)
    {
        var n = c.Count;
        var closes = c.Select(x => x.Close).ToArray();
        var inputs = c.Select(x => new CandleInput(x.OpenTime, x.Open, x.High, x.Low, x.Close, x.Volume)).ToList();

        var ema20  = TechnicalUtils.ComputeEma(closes, 20);
        var ema50  = TechnicalUtils.ComputeEma(closes, 50);
        var ema200 = TechnicalUtils.ComputeEma(closes, 200);
        var rsi    = RsiIndicator.ComputeRsi(closes, 14);
        var t3     = TillsonIndicator.ComputeT3(closes, 5, 0.7m);

        for (var i = 0; i < n; i++)
        {
            var k = c[i];

            // Pencereli göstergeler her bar için baştan hesaplanamaz (O(n^2) olur);
            // yeterli geçmiş biriktikten sonra son 200 barlık dilim kullanılır.
            decimal atr = 0, macd = 0, macdSig = 0, macdHist = 0, adx = 0, pdi = 0, mdi = 0;
            if (i >= 60)
            {
                var from = Math.Max(0, i - 199);
                var slice = inputs.GetRange(from, i - from + 1);
                var sliceCloses = closes[from..(i + 1)];

                atr = TechnicalUtils.ComputeAtr(slice, 14);
                (macd, macdSig, macdHist, _) = TechnicalUtils.ComputeMacdFull(sliceCloses);
                (adx, pdi, mdi) = TechnicalUtils.ComputeAdxFull(slice, 14);
            }

            var prevClose = i > 0 ? c[i - 1].Close : k.Close;
            var retPct   = prevClose > 0 ? (k.Close - prevClose) / prevClose * 100m : 0m;
            var rangePct = k.Low > 0 ? (k.High - k.Low) / k.Low * 100m : 0m;
            var bodyPct  = k.Open > 0 ? (k.Close - k.Open) / k.Open * 100m : 0m;
            var atrPct   = k.Close > 0 ? atr / k.Close * 100m : 0m;

            var volAvg20 = i >= 20 ? c.Skip(i - 20).Take(20).Average(x => x.Volume) : 0m;
            var volRatio = volAvg20 > 0 ? k.Volume / volAvg20 : 0m;

            // İleriye dönük getiriler: bu bardan sonra ne olduğunu gösterir.
            // İndikatör ararken "tahmin edilmeye çalışılan" değer budur.
            var f1  = Forward(c, i, 1);
            var f5  = Forward(c, i, 5);
            var f10 = Forward(c, i, 10);

            yield return string.Join(',',
                symbol, tf, k.OpenTime.ToString("yyyy-MM-dd HH:mm:ss", Inv),
                F(k.Open), F(k.High), F(k.Low), F(k.Close),
                F(k.Volume), F(k.QuoteVolume), k.TradeCount.ToString(Inv),
                F(retPct), F(rangePct), F(bodyPct),
                F(ema20[i]), F(ema50[i]), F(ema200[i]), F(rsi[i]), F(atr), F(atrPct),
                F(macd), F(macdSig), F(macdHist), F(adx), F(pdi), F(mdi), F(t3[i]),
                F(volRatio),
                F(f1), F(f5), F(f10));
        }
    }

    private static decimal Forward(List<BinanceCandle> c, int i, int ahead)
    {
        var j = i + ahead;
        if (j >= c.Count || c[i].Close <= 0) return 0m;
        return (c[j].Close - c[i].Close) / c[i].Close * 100m;
    }

    private static string F(decimal v) => Math.Round(v, 8).ToString(Inv);
}
