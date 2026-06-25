namespace CriptoMoney.Domain.Entities;

public class Coin : BaseEntity
{
    public int Id { get; set; }
    public string Symbol { get; set; } = string.Empty;
    public string BaseAsset { get; set; } = string.Empty;
    public string QuoteAsset { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;

    public ICollection<CandleData> Candles { get; set; } = [];
    public ICollection<UserWatchlist> Watchlists { get; set; } = [];
}
