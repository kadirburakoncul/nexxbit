using CriptoMoney.Domain.Enums;

namespace CriptoMoney.Domain.Entities;

/// <summary>
/// Bir veri seti üzerinde indikatör parametrelerini tarayıp en iyi kombinasyonu arayan iş.
///
/// ÖNEMLİ: "en kârlı parametre" aramak doğası gereği aşırı uyum (overfit) riskini taşır —
/// yeterince kombinasyon denenirse geçmişte iyi görünen bir şey her zaman bulunur.
/// Bu yüzden her sonuç zaman bölmeli (walk-forward) doğrulamadan ve al-tut kıyasından
/// geçirilir; ikisini birden geçemeyen kombinasyon "başarılı" sayılmaz.
/// </summary>
public class IndicatorOptimization : BaseEntity
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid UserId { get; set; }
    public Guid? MarketDataExportId { get; set; }

    public string Name { get; set; } = string.Empty;
    public string Symbols { get; set; } = "[]";
    public string Timeframe { get; set; } = "1h";
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }

    /// <summary>Taranacak indikatör ailesi: T3, RSI, EMA, MACD, ADX...</summary>
    public string IndicatorFamily { get; set; } = "T3";

    public decimal CommissionPct { get; set; } = 0.2m;

    public MarketDataExportStatus Status { get; set; } = MarketDataExportStatus.Pending;
    public int ProgressPct { get; set; }
    public int TestedCombinations { get; set; }

    /// <summary>Tüm kombinasyonların sıralı sonucu — JSON dizi.</summary>
    public string? ResultsJson { get; set; }

    // En iyi kombinasyonun özeti (hızlı gösterim için)
    public string? BestParamsJson { get; set; }
    public decimal? BestReturnPct { get; set; }
    public decimal? BestWinRate { get; set; }
    public int? BestTradeCount { get; set; }
    public decimal? BuyHoldReturnPct { get; set; }
    public decimal? InSampleReturnPct { get; set; }
    public decimal? OutOfSampleReturnPct { get; set; }

    /// <summary>Sonucun güvenilirliğine dair düz Türkçe değerlendirme.</summary>
    public string? Verdict { get; set; }

    public string? ErrorMessage { get; set; }
    public DateTime? CompletedAt { get; set; }

    public User User { get; set; } = null!;
}
