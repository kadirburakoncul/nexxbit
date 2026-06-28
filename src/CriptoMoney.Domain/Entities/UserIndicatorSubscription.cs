namespace CriptoMoney.Domain.Entities;

public class UserIndicatorSubscription
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid UserId { get; set; }
    public int IndicatorId { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime? ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
    public Indicator Indicator { get; set; } = null!;
}
