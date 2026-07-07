namespace CriptoMoney.Domain.Entities;

/// <summary>
/// BIST hisse kataloğu — kripto Coin tablosundan tamamen bağımsız.
/// Al-sat motoruna bağlı değil, sadece sinyal/izleme amaçlı.
/// Tarama durumu (son fiyat/T3/sinyal) burada değil, BistStrategyStock'ta tutulur —
/// aynı hisse farklı stratejilerde farklı T3 ayarlarıyla izlenebilir.
/// </summary>
public class BistStock : BaseEntity
{
    public int Id { get; set; }
    public string Symbol { get; set; } = string.Empty;       // "THYAO" (Yahoo'da THYAO.IS)
    public string DisplayName { get; set; } = string.Empty;  // "Türk Hava Yolları"
    public string? Sector { get; set; }

    public ICollection<BistStrategyStock> StrategyStocks { get; set; } = [];
    public ICollection<BistSignal> Signals { get; set; } = [];
    public ICollection<BistWatchlistItem> WatchlistItems { get; set; } = [];
}
