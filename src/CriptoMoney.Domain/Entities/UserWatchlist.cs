namespace CriptoMoney.Domain.Entities;

public class UserWatchlist : BaseEntity
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid UserId { get; set; }
    public int CoinId { get; set; }
    public bool IsActive { get; set; } = true;

    public User User { get; set; } = null!;
    public Coin Coin { get; set; } = null!;
}
