using CriptoMoney.Domain.Enums;

namespace CriptoMoney.Domain.Entities;

public class BacktestTrade
{
    public long Id { get; set; }
    public Guid BacktestRunId { get; set; }
    public int CoinId { get; set; }
    public OrderSide Side { get; set; }
    public DateTime EntryTime { get; set; }
    public decimal EntryPrice { get; set; }
    public DateTime? ExitTime { get; set; }
    public decimal? ExitPrice { get; set; }
    public BacktestExitReason? ExitReason { get; set; }
    public decimal Quantity { get; set; }
    public decimal Commission { get; set; }
    public decimal? PnlUsdt { get; set; }
    public decimal? PnlPct { get; set; }
    public decimal? EntryScore { get; set; }
    public string? IndicatorScores { get; set; }

    public BacktestRun BacktestRun { get; set; } = null!;
    public Coin Coin { get; set; } = null!;
}

public enum BacktestExitReason
{
    Signal = 0,
    StopLoss = 1,
    TakeProfit = 2,
    EndOfData = 3
}
