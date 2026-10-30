using CriptoMoney.Domain.Enums;

namespace CriptoMoney.Domain.Entities;

/// <summary>
/// Binance'ten toplu mum verisi çekme işi.
///
/// Tek istekte dönemeyecek kadar büyük olabilir (400 coin × 1 yıl × 15dk ≈ 14M bar),
/// bu yüzden arka planda çalışır ve ilerlemesi buradan izlenir. Sonuç bir dosyaya
/// yazılır; indirilip harici araçlarla analiz edilebilir veya optimizasyon
/// motoruna girdi olur.
/// </summary>
public class MarketDataExport : BaseEntity
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid UserId { get; set; }

    public string Name { get; set; } = string.Empty;

    /// <summary>Seçilen semboller — JSON dizi: ["BTCUSDT","ETHUSDT"]</summary>
    public string Symbols { get; set; } = "[]";
    public int SymbolCount { get; set; }

    /// <summary>15m, 45m, 1h, 4h, 1d, 1w — 45m Binance'te yok, 15m'den türetilir.</summary>
    public string Timeframe { get; set; } = "1h";
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }

    /// <summary>csv | json</summary>
    public string Format { get; set; } = "csv";

    /// <summary>
    /// true ise OHLCV'ye ek olarak hesaplanmış kolonlar yazılır
    /// (getiri, ATR, RSI, EMA, MACD, ADX...). Dosya doğrudan analize hazır gelir.
    /// </summary>
    public bool IncludeIndicators { get; set; } = true;

    public MarketDataExportStatus Status { get; set; } = MarketDataExportStatus.Pending;
    public int ProgressPct { get; set; }
    public int ProcessedSymbols { get; set; }
    public long TotalRows { get; set; }

    public string? FilePath { get; set; }
    public long? FileSizeBytes { get; set; }

    /// <summary>Eksik bar, boşluk, geç listelenen coin gibi veri kalitesi notları.</summary>
    public string? DataQualityNote { get; set; }

    public string? ErrorMessage { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }

    public User User { get; set; } = null!;
}
