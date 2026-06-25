using CriptoMoney.Domain.Enums;

namespace CriptoMoney.Domain.Entities;

public class TradeOrder : BaseEntity
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid UserId { get; set; }
    public int CoinId { get; set; }
    public Guid? SignalId { get; set; }
    public long? BinanceOrderId { get; set; }
    public string? ClientOrderId { get; set; }
    public OrderSide Side { get; set; }
    public OrderType Type { get; set; }
    public OrderStatus Status { get; set; } = OrderStatus.Pending;
    public decimal Quantity { get; set; }
    public decimal? Price { get; set; }
    public decimal? FilledQuantity { get; set; }
    public decimal? FilledPrice { get; set; }
    public decimal? Commission { get; set; }
    public string? CommissionAsset { get; set; }
    public bool IsAutomatic { get; set; } = false;
    public string? ErrorMessage { get; set; }
    public DateTime? BinanceCreatedAt { get; set; }

    public User User { get; set; } = null!;
    public Coin Coin { get; set; } = null!;
    public TradeSignal? Signal { get; set; }
}
