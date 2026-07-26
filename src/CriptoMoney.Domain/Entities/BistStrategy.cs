namespace CriptoMoney.Domain.Entities;

/// <summary>
/// BIST sinyal stratejisi — kripto UserStrategy'den tamamen bağımsız.
/// Al-sat içermez, sadece hangi hisseler hangi zaman diliminde taranacak bilgisini tutar.
/// </summary>
public class BistStrategy : BaseEntity
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    /// <summary>
    /// Varsayılan günlük: 20 hisse × 2 yıl backtestinde 1h zararlı (−89.6%),
    /// 4h Yahoo'da BIST seansıyla hizasız (09:30/13:30/17:30 + artık bar),
    /// günlük ise temiz veri ve tek anlamlı sonuç veren periyot.
    /// </summary>
    public string Timeframe { get; set; } = "1d";
    public bool IsActive { get; set; } = true;
    public DateTime? ActivatedAt { get; set; }

    public bool IsRsiFilterEnabled { get; set; } = false;
    public int RsiPeriod { get; set; } = 14;
    public decimal RsiBuyThreshold { get; set; } = 50m;

    /// <summary>
    /// EMA200 trend filtresi — fiyat 200 periyotluk ortalamanın üstündeyken AL.
    /// Backtestte tek başına en büyük fark: saf T3 −6.8% → +163.5%.
    /// </summary>
    public bool UseEma200Filter { get; set; } = true;

    // Pozisyon takibi — sinyal üretmek yetmiyor, çıkış kuralı da gerekiyor.
    // Backtestte SL%8 + trailing%8 eklemek +163.5% → +263.9% fark yarattı.
    public bool IsPositionTrackingEnabled { get; set; } = true;
    public decimal StopLossPct { get; set; } = 8m;
    public decimal TrailingStopPct { get; set; } = 8m;

    /// <summary>
    /// Trailing stop bu kâr eşiği aşılmadan devreye girmez.
    /// Eşik olmadan, zirve girişin bir tık üstüne çıktığı anda tetik giriş
    /// fiyatına yapışıyor ve ilk geri çekilmede pozisyon başabaşta kapanıyordu
    /// (ölçümde işlemlerin çoğu ≈ −%0.1 ile sonuçlandı).
    /// </summary>
    public decimal TrailingActivationPct { get; set; } = 5m;

    public User User { get; set; } = null!;
    public ICollection<BistStrategyStock> StrategyStocks { get; set; } = [];
}
