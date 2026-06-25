using CriptoMoney.Domain.Enums;

namespace CriptoMoney.Domain.Entities;

public class UserStrategyCoin
{
    public int Id { get; set; }
    public Guid UserStrategyId { get; set; }
    public int CoinId { get; set; }
    public ReEntryState ReEntryState { get; set; } = ReEntryState.Normal;
    public DateTime? LastCheckedAt { get; set; }
    public decimal? LastCheckedPrice { get; set; }
    public string? LastCheckedReason { get; set; }

    public UserStrategy UserStrategy { get; set; } = null!;
    public Coin Coin { get; set; } = null!;
}
