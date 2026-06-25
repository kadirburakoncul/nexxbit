namespace CriptoMoney.Domain.Entities;

public class BalanceSnapshot
{
    public long Id { get; set; }
    public Guid UserId { get; set; }
    public decimal TotalValueUsdt { get; set; }
    public string Assets { get; set; } = "[]";
    public DateTime SnapshotAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
}
