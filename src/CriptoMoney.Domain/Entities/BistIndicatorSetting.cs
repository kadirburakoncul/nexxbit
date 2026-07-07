namespace CriptoMoney.Domain.Entities;

/// <summary>
/// Kullanıcının BIST sinyalleri için kendi T3/RSI parametreleri — kripto indikatör ayarlarından
/// tamamen bağımsız. Kullanıcı başına tek satır.
/// </summary>
public class BistIndicatorSetting : BaseEntity
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid UserId { get; set; }

    public int T3Period { get; set; } = 5;
    public decimal T3Factor { get; set; } = 0.7m;

    public bool IsRsiFilterEnabled { get; set; } = false;
    public int RsiPeriod { get; set; } = 14;
    public decimal RsiBuyThreshold { get; set; } = 50m;

    public User User { get; set; } = null!;
}
