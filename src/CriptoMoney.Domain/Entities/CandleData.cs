namespace CriptoMoney.Domain.Entities;

public class CandleData
{
    public long Id { get; set; }
    public int CoinId { get; set; }
    public string Timeframe { get; set; } = string.Empty;
    public DateTime OpenTime { get; set; }
    public DateTime CloseTime { get; set; }
    public decimal Open { get; set; }
    public decimal High { get; set; }
    public decimal Low { get; set; }
    public decimal Close { get; set; }
    public decimal Volume { get; set; }
    public decimal QuoteVolume { get; set; }
    public int TradeCount { get; set; }
    public bool IsClosed { get; set; } = true;

    public Coin Coin { get; set; } = null!;
}
