using CriptoMoney.Domain.Enums;

namespace CriptoMoney.Domain.Entities;

public class Position : BaseEntity
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid UserId { get; set; }
    public int CoinId { get; set; }
    public Guid? EntryOrderId { get; set; }
    public decimal EntryPrice { get; set; }
    public decimal EntryQuantity { get; set; }
    public decimal EntryValueUsdt { get; set; }
    public decimal? StopLossPrice { get; set; }
    public decimal? TakeProfitPrice { get; set; }
    public decimal? TrailingStopPct { get; set; }
    public decimal? TrailingStopHighWatermark { get; set; }
    public PositionStatus Status { get; set; } = PositionStatus.Open;
    public Guid? CloseOrderId { get; set; }
    public decimal? ClosePrice { get; set; }
    public decimal? CloseValueUsdt { get; set; }
    public decimal? RealizedPnl { get; set; }
    public decimal? RealizedPnlPct { get; set; }
    public bool IsVirtual { get; set; } = false;
    public DateTime OpenedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ClosedAt { get; set; }
    public string? CloseReason { get; set; }

    public User User { get; set; } = null!;
    public Coin Coin { get; set; } = null!;
    public TradeOrder? EntryOrder { get; set; }
    public TradeOrder? CloseOrder { get; set; }
}
