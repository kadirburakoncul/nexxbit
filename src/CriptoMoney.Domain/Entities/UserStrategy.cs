namespace CriptoMoney.Domain.Entities;

public class UserStrategy : BaseEntity
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid UserId { get; set; }
    public int? CoinId { get; set; }  // Legacy: artık StrategyCoins kullanılıyor
    public int? IndicatorId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Timeframe { get; set; } = "1h";
    public decimal TrailingStopPct { get; set; } = 2.5m;
    public decimal StopLossPct { get; set; } = 1.5m;
    public decimal? TakeProfitPct { get; set; } = 3.0m;
    public int MomentumFreshFilterMinutes { get; set; } = 5;
    public decimal? MinVolumeUsdt { get; set; }
    public decimal? VolatilePositionSizePct { get; set; }
    public decimal VolatileMinChangePct { get; set; } = 3.0m;   // Minimum 24s % yükseliş filtresi
    public int VolatileGainerLimit { get; set; } = 20;          // Kaç top-gainer işlensin

    // Eski skor tabanlı sistem alanları (backtest için tutuldu)
    public decimal BuyThreshold { get; set; } = 3.0m;
    public decimal SellThreshold { get; set; } = -3.0m;
    public decimal StrongSellThreshold { get; set; } = -6.0m;
    public bool IsEma200RuleEnabled { get; set; } = false;
    public int Ema200MinCandles { get; set; } = 2;
    public int Ema200MaxCandles { get; set; } = 5;
    public string Ema200Timeframe { get; set; } = "15m";
    // ATR tabanlı dinamik stop
    public bool UseAtrBasedStops { get; set; } = false;
    public int AtrPeriod { get; set; } = 14;
    public decimal AtrSlMultiplier { get; set; } = 1.5m;
    public decimal AtrTpMultiplier { get; set; } = 3.0m;

    // Kısmi kâr al (Partial TP)
    public decimal? PartialTpPct { get; set; }
    public decimal PartialTpClosePct { get; set; } = 50m;

    // Hacim artışı filtresi
    public bool IsVolumeSurgeFilterEnabled { get; set; } = false;
    public decimal VolumeSurgeMultiplier { get; set; } = 1.5m;

    // Piyasa rejimi filtresi (BTC EMA200'e göre bull/bear)
    public bool UseMarketRegimeFilter { get; set; } = false;

    public bool IsActive { get; set; } = true;
    public bool IsRealTradeEnabled { get; set; } = false;
    public bool IsVolatileMode { get; set; } = false;
    public bool IsRsiFilterEnabled { get; set; } = false;
    public DateTime? ActivatedAt { get; set; }

    public User User { get; set; } = null!;
    public Coin? Coin { get; set; }
    public ICollection<TradeSignal> Signals { get; set; } = [];
    public ICollection<UserStrategyCoin> StrategyCoins { get; set; } = [];
}
