using CriptoMoney.Domain.Enums;

namespace CriptoMoney.Domain.Entities;

public class TradeSignal : BaseEntity
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid UserId { get; set; }
    public int CoinId { get; set; }
    public Guid StrategyId { get; set; }
    public string Timeframe { get; set; } = string.Empty;
    public SignalDirection Direction { get; set; }
    public decimal TotalScore { get; set; }
    public DateTime CandleTime { get; set; }
    public decimal Price { get; set; }
    public string IndicatorScores { get; set; } = "[]";
    public bool IsActedUpon { get; set; } = false;

    public User User { get; set; } = null!;
    public Coin Coin { get; set; } = null!;
    public UserStrategy Strategy { get; set; } = null!;
    public ICollection<TradeOrder> Orders { get; set; } = [];
}
