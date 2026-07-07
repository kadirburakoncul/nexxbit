using CriptoMoney.Domain.Enums;

namespace CriptoMoney.Domain.Entities;

/// <summary>
/// BIST hissesi için üretilen sinyal kaydı — al-sat motoruna bağlı değil, bilgi amaçlıdır.
/// Hangi kullanıcının hangi stratejisinden geldiği belli olsun diye UserId + BistStrategyId taşır.
/// </summary>
public class BistSignal : BaseEntity
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid UserId { get; set; }
    public Guid BistStrategyId { get; set; }
    public int BistStockId { get; set; }
    public SignalDirection Direction { get; set; }
    public decimal Price { get; set; }
    public DateTime CandleTime { get; set; }
    public string? Reason { get; set; }

    public User User { get; set; } = null!;
    public BistStrategy BistStrategy { get; set; } = null!;
    public BistStock BistStock { get; set; } = null!;
}
