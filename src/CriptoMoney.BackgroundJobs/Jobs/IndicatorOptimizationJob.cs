using System.Text.Json;
using System.Text.Json.Serialization;
using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Domain.Enums;
using CriptoMoney.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CriptoMoney.BackgroundJobs.Jobs;

/// <summary>
/// Seçilen coinler üzerinde indikatör parametrelerini tarar ve sonuçları
/// aşırı uyum (overfit) kontrolünden geçirerek kaydeder.
/// </summary>
public class IndicatorOptimizationJob(
    IApplicationDbContext db,
    IMarketDataService marketData,
    IIndicatorOptimizer optimizer,
    ILogger<IndicatorOptimizationJob> logger)
{
    private static readonly JsonSerializerOptions CamelCase = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.Never,
    };

    public async Task ExecuteAsync(Guid optimizationId, CancellationToken ct = default)
    {
        var run = await db.IndicatorOptimizations.FirstOrDefaultAsync(o => o.Id == optimizationId, ct);
        if (run is null)
        {
            logger.LogWarning("IndicatorOptimizationJob: kayıt bulunamadı {Id}", optimizationId);
            return;
        }

        var symbols = JsonSerializer.Deserialize<List<string>>(run.Symbols) ?? [];
        if (symbols.Count == 0)
        {
            run.Status = MarketDataExportStatus.Failed;
            run.ErrorMessage = "Sembol seçilmemiş.";
            await db.SaveChangesAsync(ct);
            return;
        }

        run.Status = MarketDataExportStatus.Running;
        run.ProgressPct = 0;
        await db.SaveChangesAsync(ct);

        try
        {
            // 1) Veriyi topla
            var data = new Dictionary<string, List<CandleInput>>();
            for (var i = 0; i < symbols.Count; i++)
            {
                ct.ThrowIfCancellationRequested();

                var res = await marketData.GetCandlesRangeAsync(
                    symbols[i], run.Timeframe, run.StartDate, run.EndDate, ct);

                if (res.Succeeded && res.Data is { Count: > 250 })
                    data[symbols[i]] = res.Data
                        .Select(k => new CandleInput(k.OpenTime, k.Open, k.High, k.Low, k.Close, k.Volume))
                        .ToList();

                // Veri toplama toplam sürenin ~yarısı
                run.ProgressPct = (int)((i + 1) * 45.0 / symbols.Count);
                await db.SaveChangesAsync(ct);
            }

            if (data.Count == 0)
            {
                run.Status = MarketDataExportStatus.Failed;
                run.ErrorMessage = "Hiçbir sembol için yeterli veri alınamadı (en az 250 bar gerekli).";
                run.CompletedAt = DateTime.UtcNow;
                await db.SaveChangesAsync(ct);
                return;
            }

            // 2) Parametre taraması
            var progress = new Progress<int>(pct =>
            {
                run.ProgressPct = 45 + (int)(pct * 0.55);
            });

            var results = await optimizer.RunAsync(data, run.IndicatorFamily, run.CommissionPct, progress, ct);

            if (results.Count == 0)
            {
                run.Status = MarketDataExportStatus.Completed;
                run.ProgressPct = 100;
                run.TestedCombinations = 0;
                run.Verdict = "Anlamlı sonuç üretilemedi — hiçbir parametre kombinasyonu yeterli sayıda işlem açmadı. "
                            + "Daha uzun bir tarih aralığı veya daha kısa bir periyot deneyin.";
                run.CompletedAt = DateTime.UtcNow;
                await db.SaveChangesAsync(ct);
                return;
            }

            var best = results[0];

            run.TestedCombinations = results.Count;
            // Frontend camelCase bekliyor (API genelinde olduğu gibi);
            // varsayılan serileştirme PascalCase üretip alanları eşleşmez hale getiriyordu.
            run.ResultsJson = JsonSerializer.Serialize(results.Take(50), CamelCase);
            // AUTO'da parametre sözlüğü boştur; taşınan şey kuralın kendisidir.
            run.BestParamsJson = best.RuleJson ?? JsonSerializer.Serialize(best.Parameters);
            run.BestReturnPct = best.ReturnPct;
            run.BestWinRate = best.WinRate;
            run.BestTradeCount = best.TradeCount;
            run.BuyHoldReturnPct = best.BuyHoldPct;
            run.InSampleReturnPct = best.InSamplePct;
            run.OutOfSampleReturnPct = best.OutOfSamplePct;
            run.Verdict = BuildVerdict(best, results.Count);

            run.Status = MarketDataExportStatus.Completed;
            run.ProgressPct = 100;
            run.CompletedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(CancellationToken.None);

            logger.LogInformation(
                "Optimizasyon bitti: {Id} {Count} kombinasyon, en iyi {Label} edge={Edge:F2}%",
                optimizationId, results.Count, best.ParamsLabel, best.EdgePct);
        }
        catch (OperationCanceledException)
        {
            run.Status = MarketDataExportStatus.Cancelled;
            await db.SaveChangesAsync(CancellationToken.None);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Optimizasyon başarısız: {Id}", optimizationId);
            run.Status = MarketDataExportStatus.Failed;
            run.ErrorMessage = ex.Message;
            run.CompletedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(CancellationToken.None);
        }
    }

    /// <summary>
    /// Sonucu düz Türkçe değerlendirir. Amaç kullanıcıyı ham sayıyla baş başa
    /// bırakmamak: yüksek getiri tek başına bir şey ifade etmez, al-tut'u geçmesi
    /// ve ikinci dönemde de ayakta kalması gerekir.
    /// </summary>
    private static string BuildVerdict(OptimizationCandidate b, int combinationCount)
    {
        var beatsHold = b.EdgePct > 0;
        var oosOk = b.OutOfSamplePct > 0;
        var isOk = b.InSamplePct > 0;
        var majority = b.SymbolsBeatingBuyHold * 2 >= b.SymbolCount;

        var parts = new List<string>();

        var isAuto = b.Family.Equals("AUTO", StringComparison.OrdinalIgnoreCase);
        var firstLabel  = isAuto ? "doğrulama seti" : "ilk dönem";
        var secondLabel = isAuto ? "test seti" : "ikinci dönem";

        if (!beatsHold)
        {
            parts.Add($"KULLANMAYIN: En iyi kombinasyon bile al-tut'un altında kaldı "
                    + $"(strateji {b.ReturnPct:+0.0;-0.0;0.0}%, al-tut {b.BuyHoldPct:+0.0;-0.0;0.0}%). "
                    + "Bu veri setinde bu indikatör ailesi değer katmıyor.");
        }
        else if (isOk && oosOk && majority)
        {
            parts.Add($"UMUT VERİCİ: Al-tut'u {b.EdgePct:+0.0;-0.0;0.0} puan geçti, her iki zaman diliminde de "
                    + $"pozitif ({firstLabel} {b.InSamplePct:+0.0;-0.0;0.0}%, {secondLabel} {b.OutOfSamplePct:+0.0;-0.0;0.0}%) "
                    + $"ve {b.SymbolCount} coinin {b.SymbolsBeatingBuyHold} tanesinde al-tut'u geçti.");
        }
        else if (!oosOk)
        {
            parts.Add($"ŞÜPHELİ: {firstLabel}nde {b.InSamplePct:+0.0;-0.0;0.0}% kazandırmış ama {secondLabel}nde "
                    + $"{b.OutOfSamplePct:+0.0;-0.0;0.0}%. Bu, parametrelerin geçmişe aşırı uydurulduğunun "
                    + "(overfit) klasik işaretidir.");
        }
        else
        {
            parts.Add($"KARARSIZ: Al-tut'u {b.EdgePct:+0.0;-0.0;0.0} puan geçiyor ama sonuç tutarlı değil "
                    + $"({firstLabel} {b.InSamplePct:+0.0;-0.0;0.0}%, {secondLabel} {b.OutOfSamplePct:+0.0;-0.0;0.0}%, "
                    + $"{b.SymbolCount} coinin {b.SymbolsBeatingBuyHold} tanesinde üstün).");
        }

        parts.Add(isAuto
            ? $"{combinationCount} aday kural üretildi — veri üçe bölündü: kurallar eğitim setinde arandı, "
              + "en iyiler doğrulama setinde seçildi, test seti seçime hiç karışmadı. "
              + "Raporlanan test sonucu bu yüzden daha güvenilirdir ama yine de garanti değildir."
            : $"{combinationCount} kombinasyon denendi — ne kadar çok denenirse, "
                + "şans eseri iyi görünen bir ayar bulma ihtimali o kadar artar. "
                + "Gerçek parayla kullanmadan önce farklı bir tarih aralığında tekrar ölçün.");

        return string.Join(" ", parts);
    }
}
