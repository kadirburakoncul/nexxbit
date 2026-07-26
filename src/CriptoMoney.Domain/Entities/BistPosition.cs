using CriptoMoney.Domain.Enums;

namespace CriptoMoney.Domain.Entities;

/// <summary>
/// BIST sinyalinden doğan KAĞIT ÜZERİNDE pozisyon takibi.
///
/// BIST modülü emir göndermez — bu kayıt "AL sinyali verdik, sonra ne oldu?"
/// sorusunu cevaplar. Gerçek alım/satımı kullanıcı kendi aracı kurumunda yapar.
///
/// Neden gerekli: 20 hisse × 2 yıl backtestinde sinyalleri stop-loss ve trailing
/// ile takip etmek, sadece T3 dönüşünde çıkmaya kıyasla belirgin fark yarattı.
/// Takip olmadan sinyalin işe yarayıp yaramadığı da ölçülemiyordu.
/// </summary>
public class BistPosition : BaseEntity
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid UserId { get; set; }
    public Guid BistStrategyId { get; set; }
    public int BistStockId { get; set; }

    public decimal EntryPrice { get; set; }
    public DateTime EntryCandleTime { get; set; }
    public DateTime OpenedAt { get; set; }

    /// <summary>Girişten beri görülen en yüksek fiyat — trailing stop bunu takip eder.</summary>
    public decimal PeakPrice { get; set; }
    public DateTime? PeakPriceAt { get; set; }

    public decimal? StopLossPrice { get; set; }

    public PositionStatus Status { get; set; } = PositionStatus.Open;
    public decimal? ClosePrice { get; set; }
    public DateTime? ClosedAt { get; set; }
    public string? CloseReason { get; set; }

    /// <summary>Komisyon düşülmüş net sonuç (%). BIST gidiş-dönüş ≈ %0.2.</summary>
    public decimal? RealizedPnlPct { get; set; }

    public User User { get; set; } = null!;
    public BistStrategy BistStrategy { get; set; } = null!;
    public BistStock BistStock { get; set; } = null!;
}
