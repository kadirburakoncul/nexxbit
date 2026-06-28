using CriptoMoney.Domain.Enums;

namespace CriptoMoney.Domain.Entities;

public class BacktestRun : BaseEntity
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid UserId { get; set; }
    public string? Name { get; set; }
    public string CoinIds { get; set; } = "[]";
    public string Timeframe { get; set; } = string.Empty;
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public decimal InitialCapital { get; set; }
    public decimal CommissionRate { get; set; } = 0.001m;
    public decimal SlippagePct { get; set; } = 0.05m;
    public decimal? StopLossPct { get; set; }
    public decimal? TakeProfitPct { get; set; }
    public string StrategyConfig { get; set; } = "{}";
    public BacktestStatus Status { get; set; } = BacktestStatus.Pending;
    public decimal? FinalCapital { get; set; }
    public decimal? NetPnl { get; set; }
    public decimal? NetPnlPct { get; set; }
    public decimal? WinRate { get; set; }
    public int? TotalTrades { get; set; }
    public int? WinningTrades { get; set; }
    public decimal? MaxDrawdown { get; set; }
    public decimal? SharpeRatio { get; set; }
    public string? ErrorMessage { get; set; }
    public DateTime? CompletedAt { get; set; }

    public User User { get; set; } = null!;
    public ICollection<BacktestTrade> Trades { get; set; } = [];
}
