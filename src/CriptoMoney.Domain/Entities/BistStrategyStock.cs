namespace CriptoMoney.Domain.Entities;

/// <summary>
/// Bir BIST stratejisinin izlediği hisse + o çift için tarama durumu (son fiyat/T3/sinyal nedeni).
/// Aynı hisse farklı stratejilerde farklı T3 ayarlarıyla bağımsız izlenebilir.
/// </summary>
public class BistStrategyStock : BaseEntity
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid BistStrategyId { get; set; }
    public int BistStockId { get; set; }

    public decimal? LastPrice { get; set; }
    public DateTime? LastPriceAt { get; set; }
    public decimal? LastT3 { get; set; }
    public bool? LastT3UpDirection { get; set; }
    public DateTime? LastCheckedAt { get; set; }
    public string? LastCheckedReason { get; set; }

    public BistStrategy BistStrategy { get; set; } = null!;
    public BistStock BistStock { get; set; } = null!;
}
