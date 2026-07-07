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
    public string Timeframe { get; set; } = "15m";
    public bool IsActive { get; set; } = true;
    public DateTime? ActivatedAt { get; set; }

    public bool IsRsiFilterEnabled { get; set; } = false;
    public int RsiPeriod { get; set; } = 14;
    public decimal RsiBuyThreshold { get; set; } = 50m;

    public User User { get; set; } = null!;
    public ICollection<BistStrategyStock> StrategyStocks { get; set; } = [];
}
