namespace CriptoMoney.Domain.Entities;

public class UserIndicatorSetting : BaseEntity
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid UserId { get; set; }
    public int IndicatorId { get; set; }
    public int? CoinId { get; set; }
    public bool IsEnabled { get; set; } = true;
    public decimal Weight { get; set; } = 1.0m;

    public User User { get; set; } = null!;
    public Indicator Indicator { get; set; } = null!;
    public Coin? Coin { get; set; }
    public ICollection<UserIndicatorParameterValue> ParameterValues { get; set; } = [];
}
