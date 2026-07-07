namespace CriptoMoney.Domain.Entities;

public class BistWatchlistItem : BaseEntity
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid UserId { get; set; }
    public int BistStockId { get; set; }

    public User User { get; set; } = null!;
    public BistStock BistStock { get; set; } = null!;
}
