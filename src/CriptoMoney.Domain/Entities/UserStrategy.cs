namespace CriptoMoney.Domain.Entities;

public class UserStrategy : BaseEntity
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid UserId { get; set; }
    public int? CoinId { get; set; }  // Legacy: artık StrategyCoins kullanılıyor
    public int? IndicatorId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Timeframe { get; set; } = "1h";
    public decimal TrailingStopPct { get; set; } = 0.30m;
    public decimal StopLossPct { get; set; } = 0.30m;

    // Eski skor tabanlı sistem alanları (backtest için tutuldu)
    public decimal BuyThreshold { get; set; } = 3.0m;
    public decimal SellThreshold { get; set; } = -3.0m;
    public decimal StrongSellThreshold { get; set; } = -6.0m;
    public bool IsEma200RuleEnabled { get; set; } = false;
    public int Ema200MinCandles { get; set; } = 2;
    public int Ema200MaxCandles { get; set; } = 5;
    public string Ema200Timeframe { get; set; } = "15m";
    public bool IsActive { get; set; } = true;
    public bool IsRealTradeEnabled { get; set; } = false;
    public DateTime? ActivatedAt { get; set; }

    public User User { get; set; } = null!;
    public Coin? Coin { get; set; }
    public ICollection<TradeSignal> Signals { get; set; } = [];
    public ICollection<UserStrategyCoin> StrategyCoins { get; set; } = [];
}
